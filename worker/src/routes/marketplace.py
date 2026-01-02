"""
Marketplace API routes
Listings, offers, transactions, and seller ratings for buying/selling/trading collectibles
"""

import json
from datetime import datetime
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from routes.auth import require_auth, require_csrf
from utils.conversions import to_python_value, convert_row, convert_rows
from services.email import send_offer_notification, send_offer_response_notification, send_transaction_complete_notification


router = APIRouter()


# --- Enums ---

class ListingType(str, Enum):
    SALE = "sale"
    TRADE = "trade"
    BOTH = "both"


class ListingStatus(str, Enum):
    ACTIVE = "active"
    SOLD = "sold"
    CANCELLED = "cancelled"


class OfferType(str, Enum):
    BUY = "buy"
    TRADE = "trade"


class OfferStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COUNTERED = "countered"
    WITHDRAWN = "withdrawn"


class Condition(str, Enum):
    MINT = "Mint"
    NEAR_MINT = "Near Mint"
    VG_PLUS = "VG+"
    VG = "VG"
    GOOD = "Good"
    FAIR = "Fair"
    POOR = "Poor"


# --- Request/Response Models ---

class ListingImage(BaseModel):
    """Listing image"""
    id: int
    image_url: str
    position: int


class SellerInfo(BaseModel):
    """Seller information"""
    id: int
    name: Optional[str] = None
    picture: Optional[str] = None
    rating_average: Optional[float] = None
    rating_count: int = 0


class CollectionItemInfo(BaseModel):
    """Linked collection item info"""
    id: int
    artist: str
    album: str
    cover: Optional[str] = None
    year: Optional[int] = None


class ListingResponse(BaseModel):
    """Full listing response"""
    id: int
    user_id: int
    seller: SellerInfo
    collection_item: Optional[CollectionItemInfo] = None
    title: str
    description: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    condition: Optional[str] = None
    listing_type: str
    status: str
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    shipping_available: bool = True
    view_count: int = 0
    images: list[ListingImage] = []
    offer_count: int = 0
    created_at: str
    updated_at: str


class ListingListResponse(BaseModel):
    """Paginated listing list response"""
    listings: list[ListingResponse]
    total: int
    page: int
    limit: int
    has_more: bool


class CreateListingRequest(BaseModel):
    """Create listing request"""
    collection_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    price: Optional[float] = Field(None, ge=0)
    currency: str = Field("USD", max_length=3)
    condition: Optional[str] = Field(None, max_length=50)
    listing_type: str = Field("sale", pattern="^(sale|trade|both)$")
    location_city: Optional[str] = Field(None, max_length=100)
    location_state: Optional[str] = Field(None, max_length=100)
    shipping_available: bool = True
    images: list[str] = Field(default=[], max_length=10)


class UpdateListingRequest(BaseModel):
    """Update listing request"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    price: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    condition: Optional[str] = Field(None, max_length=50)
    listing_type: Optional[str] = Field(None, pattern="^(sale|trade|both)$")
    location_city: Optional[str] = Field(None, max_length=100)
    location_state: Optional[str] = Field(None, max_length=100)
    shipping_available: Optional[bool] = None
    images: Optional[list[str]] = Field(None, max_length=10)


class BuyerInfo(BaseModel):
    """Buyer information"""
    id: int
    name: Optional[str] = None
    picture: Optional[str] = None


class TradeItem(BaseModel):
    """Item offered in trade"""
    artist: str
    album: str
    condition: Optional[str] = None
    estimated_value: Optional[float] = None


class OfferResponse(BaseModel):
    """Offer response"""
    id: int
    listing_id: int
    listing_title: str
    buyer: BuyerInfo
    seller: SellerInfo
    offer_type: str
    offer_amount: Optional[float] = None
    trade_items: list[TradeItem] = []
    message: Optional[str] = None
    status: str
    counter_amount: Optional[float] = None
    counter_message: Optional[str] = None
    created_at: str
    updated_at: str


class CreateOfferRequest(BaseModel):
    """Create offer request"""
    offer_type: str = Field("buy", pattern="^(buy|trade)$")
    offer_amount: Optional[float] = Field(None, ge=0)
    trade_items: list[TradeItem] = []
    message: Optional[str] = Field(None, max_length=1000)


class UpdateOfferRequest(BaseModel):
    """Update offer status request"""
    status: str = Field(..., pattern="^(accepted|rejected|countered|withdrawn)$")
    counter_amount: Optional[float] = Field(None, ge=0)
    counter_message: Optional[str] = Field(None, max_length=1000)


class TransactionResponse(BaseModel):
    """Transaction response"""
    id: int
    listing_id: int
    listing_title: str
    offer_id: Optional[int] = None
    seller: SellerInfo
    buyer: BuyerInfo
    final_price: Optional[float] = None
    commission_amount: float = 0
    payment_status: str
    shipping_status: Optional[str] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str


class CompleteTransactionRequest(BaseModel):
    """Complete transaction request"""
    tracking_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)


class RatingResponse(BaseModel):
    """Rating response"""
    id: int
    transaction_id: int
    rater: BuyerInfo
    rated_user: SellerInfo
    rating: int
    review_text: Optional[str] = None
    created_at: str


class CreateRatingRequest(BaseModel):
    """Create rating request"""
    transaction_id: int
    rating: int = Field(..., ge=1, le=5)
    review_text: Optional[str] = Field(None, max_length=1000)


class UserRatingsResponse(BaseModel):
    """User ratings summary"""
    user_id: int
    average_rating: Optional[float] = None
    total_ratings: int = 0
    rating_breakdown: dict[int, int] = {}  # 1-5 star counts
    recent_reviews: list[RatingResponse] = []


# --- Helper Functions ---

async def get_seller_rating_info(env, user_id: int) -> tuple[Optional[float], int]:
    """Get a user's average rating and count"""
    result = await env.DB.prepare(
        """SELECT AVG(rating) as avg_rating, COUNT(*) as count
           FROM seller_ratings WHERE rated_user_id = ?"""
    ).bind(user_id).first()

    if result:
        result = convert_row(result)
        average = to_python_value(result.get("avg_rating"))
        count = to_python_value(result.get("count"), 0)
        return (round(average, 2) if average else None, count)
    return (None, 0)


async def build_listing_response(env, row: dict, images: list = None) -> ListingResponse:
    """Build a ListingResponse from a database row"""
    user_id = row["user_id"]

    # Get seller info with ratings
    rating_avg, rating_count = await get_seller_rating_info(env, user_id)

    seller = SellerInfo(
        id=user_id,
        name=to_python_value(row.get("seller_name")),
        picture=to_python_value(row.get("seller_picture")),
        rating_average=rating_avg,
        rating_count=rating_count
    )

    # Get collection item info if linked
    collection_item = None
    collection_id = to_python_value(row.get("collection_id"))
    if collection_id:
        collection_item = CollectionItemInfo(
            id=collection_id,
            artist=to_python_value(row.get("collection_artist"), "Unknown"),
            album=to_python_value(row.get("collection_album"), "Unknown"),
            cover=to_python_value(row.get("collection_cover")),
            year=to_python_value(row.get("collection_year"))
        )

    # Get images if not provided
    if images is None:
        images_result = await env.DB.prepare(
            "SELECT id, image_url, position FROM listing_images WHERE listing_id = ? ORDER BY position"
        ).bind(row["id"]).all()
        images_result = convert_rows(images_result)
        images = [
            ListingImage(
                id=img["id"],
                image_url=img["image_url"],
                position=to_python_value(img.get("position"), 0)
            )
            for img in images_result
        ]

    # Get offer count
    offer_result = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM listing_offers WHERE listing_id = ? AND status = 'pending'"
    ).bind(row["id"]).first()
    offer_result = convert_row(offer_result)
    offer_count = to_python_value(offer_result.get("count"), 0) if offer_result else 0

    return ListingResponse(
        id=row["id"],
        user_id=user_id,
        seller=seller,
        collection_item=collection_item,
        title=row["title"],
        description=to_python_value(row.get("description")),
        price=to_python_value(row.get("price")),
        currency=to_python_value(row.get("currency"), "USD"),
        condition=to_python_value(row.get("condition")),
        listing_type=row["listing_type"],
        status=row["status"],
        location_city=to_python_value(row.get("location_city")),
        location_state=to_python_value(row.get("location_state")),
        shipping_available=bool(to_python_value(row.get("shipping_available"), 1)),
        view_count=to_python_value(row.get("view_count"), 0),
        images=images,
        offer_count=offer_count,
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"])
    )


# --- Listing Endpoints ---

@router.post("/listings")
async def create_listing(
    request: Request,
    body: CreateListingRequest,
    user_id: int = Depends(require_csrf)
) -> ListingResponse:
    """
    Create a new marketplace listing.
    Optionally link to an existing collection item.
    """
    env = request.scope["env"]

    # Validate listing type requirements
    if body.listing_type == "sale" and body.price is None:
        raise HTTPException(status_code=400, detail="Price is required for sale listings")

    try:
        # Verify collection item ownership if provided
        if body.collection_id:
            collection = await env.DB.prepare(
                "SELECT id, artist, album, cover, year FROM collections WHERE id = ? AND user_id = ?"
            ).bind(body.collection_id, user_id).first()
            collection = convert_row(collection)

            if not collection:
                raise HTTPException(status_code=404, detail="Collection item not found or not owned by you")

            # Check if already listed
            existing = await env.DB.prepare(
                "SELECT id FROM listings WHERE collection_id = ? AND status = 'active'"
            ).bind(body.collection_id).first()
            existing = convert_row(existing)

            if existing:
                raise HTTPException(status_code=400, detail="This collection item is already listed")

        # Build insert query - handle optional fields for D1
        fields = ["user_id", "title", "listing_type", "status"]
        values = [user_id, body.title, body.listing_type, "active"]

        if body.collection_id:
            fields.append("collection_id")
            values.append(body.collection_id)
        if body.description:
            fields.append("description")
            values.append(body.description)
        if body.price is not None:
            fields.append("price")
            values.append(body.price)
        if body.currency:
            fields.append("currency")
            values.append(body.currency)
        if body.condition:
            fields.append("condition")
            values.append(body.condition)
        if body.location_city:
            fields.append("location_city")
            values.append(body.location_city)
        if body.location_state:
            fields.append("location_state")
            values.append(body.location_state)

        fields.append("shipping_available")
        values.append(1 if body.shipping_available else 0)

        placeholders = ", ".join(["?" for _ in fields])
        field_names = ", ".join(fields)

        result = await env.DB.prepare(
            f"INSERT INTO listings ({field_names}) VALUES ({placeholders}) RETURNING id, created_at, updated_at"
        ).bind(*values).first()
        result = convert_row(result)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create listing")

        listing_id = result["id"]

        # Add images
        images = []
        for position, image_url in enumerate(body.images):
            img_result = await env.DB.prepare(
                "INSERT INTO listing_images (listing_id, image_url, position) VALUES (?, ?, ?) RETURNING id"
            ).bind(listing_id, image_url, position).first()
            img_result = convert_row(img_result)

            if img_result:
                images.append(ListingImage(
                    id=img_result["id"],
                    image_url=image_url,
                    position=position
                ))

        # Get user info for response
        user = await env.DB.prepare(
            "SELECT name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()
        user = convert_row(user)

        # Build response
        rating_avg, rating_count = await get_seller_rating_info(env, user_id)

        collection_item = None
        if body.collection_id:
            collection = await env.DB.prepare(
                "SELECT id, artist, album, cover, year FROM collections WHERE id = ?"
            ).bind(body.collection_id).first()
            collection = convert_row(collection)
            if collection:
                collection_item = CollectionItemInfo(
                    id=collection["id"],
                    artist=collection["artist"],
                    album=collection["album"],
                    cover=to_python_value(collection.get("cover")),
                    year=to_python_value(collection.get("year"))
                )

        return ListingResponse(
            id=listing_id,
            user_id=user_id,
            seller=SellerInfo(
                id=user_id,
                name=to_python_value(user.get("name")) if user else None,
                picture=to_python_value(user.get("picture")) if user else None,
                rating_average=rating_avg,
                rating_count=rating_count
            ),
            collection_item=collection_item,
            title=body.title,
            description=body.description,
            price=body.price,
            currency=body.currency,
            condition=body.condition,
            listing_type=body.listing_type,
            status="active",
            location_city=body.location_city,
            location_state=body.location_state,
            shipping_available=body.shipping_available,
            view_count=0,
            images=images,
            offer_count=0,
            created_at=str(result["created_at"]),
            updated_at=str(result["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error creating listing: {str(error)}")


@router.get("/listings")
async def browse_listings(
    request: Request,
    listing_type: Optional[str] = Query(None, pattern="^(sale|trade|both)$"),
    condition: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    location_state: Optional[str] = None,
    shipping_only: bool = False,
    search: Optional[str] = None,
    sort: str = Query("newest", pattern="^(newest|oldest|price_low|price_high)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: int = Depends(require_auth)
) -> ListingListResponse:
    """
    Browse marketplace listings with filters.
    Excludes the current user's own listings.
    """
    env = request.scope["env"]

    try:
        conditions = ["l.status = 'active'", "l.user_id != ?"]
        params = [user_id]

        if listing_type:
            if listing_type == "sale":
                conditions.append("(l.listing_type = 'sale' OR l.listing_type = 'both')")
            elif listing_type == "trade":
                conditions.append("(l.listing_type = 'trade' OR l.listing_type = 'both')")
            else:
                conditions.append("l.listing_type = ?")
                params.append(listing_type)

        if condition:
            conditions.append("l.condition = ?")
            params.append(condition)

        if min_price is not None:
            conditions.append("l.price >= ?")
            params.append(min_price)

        if max_price is not None:
            conditions.append("l.price <= ?")
            params.append(max_price)

        if location_state:
            conditions.append("l.location_state = ?")
            params.append(location_state)

        if shipping_only:
            conditions.append("l.shipping_available = 1")

        if search:
            conditions.append("(l.title LIKE ? OR l.description LIKE ?)")
            search_pattern = f"%{search}%"
            params.extend([search_pattern, search_pattern])

        where_clause = " AND ".join(conditions)

        # Sorting
        order_by = {
            "newest": "l.created_at DESC",
            "oldest": "l.created_at ASC",
            "price_low": "l.price ASC NULLS LAST",
            "price_high": "l.price DESC NULLS LAST"
        }.get(sort, "l.created_at DESC")

        # Get total count
        count_result = await env.DB.prepare(
            f"SELECT COUNT(*) as total FROM listings l WHERE {where_clause}"
        ).bind(*params).first()
        count_result = convert_row(count_result)
        total = to_python_value(count_result.get("total"), 0) if count_result else 0

        # Get listings
        offset = (page - 1) * limit

        query = f"""
            SELECT l.*,
                   u.name as seller_name, u.picture as seller_picture,
                   c.artist as collection_artist, c.album as collection_album,
                   c.cover as collection_cover, c.year as collection_year
            FROM listings l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN collections c ON l.collection_id = c.id
            WHERE {where_clause}
            ORDER BY {order_by}
            LIMIT ? OFFSET ?
        """

        result = await env.DB.prepare(query).bind(*params, limit, offset).all()
        rows = convert_rows(result)

        listings = []
        for row in rows:
            listing = await build_listing_response(env, row)
            listings.append(listing)

        return ListingListResponse(
            listings=listings,
            total=total,
            page=page,
            limit=limit,
            has_more=(page * limit) < total
        )

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error browsing listings: {str(error)}")


@router.get("/listings/my")
async def get_my_listings(
    request: Request,
    status: Optional[str] = Query(None, pattern="^(active|sold|cancelled)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: int = Depends(require_auth)
) -> ListingListResponse:
    """Get current user's listings."""
    env = request.scope["env"]

    try:
        conditions = ["l.user_id = ?"]
        params = [user_id]

        if status:
            conditions.append("l.status = ?")
            params.append(status)

        where_clause = " AND ".join(conditions)

        # Get total count
        count_result = await env.DB.prepare(
            f"SELECT COUNT(*) as total FROM listings l WHERE {where_clause}"
        ).bind(*params).first()
        count_result = convert_row(count_result)
        total = to_python_value(count_result.get("total"), 0) if count_result else 0

        # Get listings
        offset = (page - 1) * limit

        query = f"""
            SELECT l.*,
                   u.name as seller_name, u.picture as seller_picture,
                   c.artist as collection_artist, c.album as collection_album,
                   c.cover as collection_cover, c.year as collection_year
            FROM listings l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN collections c ON l.collection_id = c.id
            WHERE {where_clause}
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        """

        result = await env.DB.prepare(query).bind(*params, limit, offset).all()
        rows = convert_rows(result)

        listings = []
        for row in rows:
            listing = await build_listing_response(env, row)
            listings.append(listing)

        return ListingListResponse(
            listings=listings,
            total=total,
            page=page,
            limit=limit,
            has_more=(page * limit) < total
        )

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching listings: {str(error)}")


@router.get("/listings/{listing_id}")
async def get_listing(
    request: Request,
    listing_id: int,
    user_id: int = Depends(require_auth)
) -> ListingResponse:
    """Get a single listing by ID. Increments view count for non-owners."""
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            """SELECT l.*,
                      u.name as seller_name, u.picture as seller_picture,
                      c.artist as collection_artist, c.album as collection_album,
                      c.cover as collection_cover, c.year as collection_year
               FROM listings l
               JOIN users u ON l.user_id = u.id
               LEFT JOIN collections c ON l.collection_id = c.id
               WHERE l.id = ?"""
        ).bind(listing_id).first()
        result = convert_row(result)

        if not result:
            raise HTTPException(status_code=404, detail="Listing not found")

        # Increment view count for non-owners
        if result["user_id"] != user_id:
            await env.DB.prepare(
                "UPDATE listings SET view_count = view_count + 1 WHERE id = ?"
            ).bind(listing_id).run()
            result["view_count"] = to_python_value(result.get("view_count"), 0) + 1

        return await build_listing_response(env, result)

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching listing: {str(error)}")


@router.put("/listings/{listing_id}")
async def update_listing(
    request: Request,
    listing_id: int,
    body: UpdateListingRequest,
    user_id: int = Depends(require_csrf)
) -> ListingResponse:
    """Update a listing. Only the owner can update."""
    env = request.scope["env"]

    try:
        # Check ownership and status
        existing = await env.DB.prepare(
            "SELECT user_id, status FROM listings WHERE id = ?"
        ).bind(listing_id).first()
        existing = convert_row(existing)

        if not existing:
            raise HTTPException(status_code=404, detail="Listing not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your listing")

        if existing["status"] != "active":
            raise HTTPException(status_code=400, detail="Cannot update a non-active listing")

        # Build update query
        updates = []
        params = []

        if body.title is not None:
            updates.append("title = ?")
            params.append(body.title)

        if body.description is not None:
            updates.append("description = ?")
            params.append(body.description)

        if body.price is not None:
            updates.append("price = ?")
            params.append(body.price)

        if body.currency is not None:
            updates.append("currency = ?")
            params.append(body.currency)

        if body.condition is not None:
            updates.append("condition = ?")
            params.append(body.condition)

        if body.listing_type is not None:
            updates.append("listing_type = ?")
            params.append(body.listing_type)

        if body.location_city is not None:
            updates.append("location_city = ?")
            params.append(body.location_city)

        if body.location_state is not None:
            updates.append("location_state = ?")
            params.append(body.location_state)

        if body.shipping_available is not None:
            updates.append("shipping_available = ?")
            params.append(1 if body.shipping_available else 0)

        if not updates and body.images is None:
            raise HTTPException(status_code=400, detail="No updates provided")

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(listing_id)

            await env.DB.prepare(
                f"UPDATE listings SET {', '.join(updates)} WHERE id = ?"
            ).bind(*params).run()

        # Update images if provided
        if body.images is not None:
            # Delete existing images
            await env.DB.prepare(
                "DELETE FROM listing_images WHERE listing_id = ?"
            ).bind(listing_id).run()

            # Add new images
            for position, image_url in enumerate(body.images):
                await env.DB.prepare(
                    "INSERT INTO listing_images (listing_id, image_url, position) VALUES (?, ?, ?)"
                ).bind(listing_id, image_url, position).run()

        # Return updated listing
        return await get_listing(request, listing_id, user_id)

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error updating listing: {str(error)}")


@router.delete("/listings/{listing_id}")
async def cancel_listing(
    request: Request,
    listing_id: int,
    user_id: int = Depends(require_csrf)
) -> dict:
    """Cancel a listing. Only the owner can cancel."""
    env = request.scope["env"]

    try:
        # Check ownership
        existing = await env.DB.prepare(
            "SELECT user_id, status FROM listings WHERE id = ?"
        ).bind(listing_id).first()
        existing = convert_row(existing)

        if not existing:
            raise HTTPException(status_code=404, detail="Listing not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your listing")

        if existing["status"] != "active":
            raise HTTPException(status_code=400, detail="Listing is not active")

        # Cancel the listing
        await env.DB.prepare(
            "UPDATE listings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(listing_id).run()

        # Reject all pending offers
        await env.DB.prepare(
            "UPDATE listing_offers SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE listing_id = ? AND status = 'pending'"
        ).bind(listing_id).run()

        return {"success": True, "message": "Listing cancelled"}

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error cancelling listing: {str(error)}")


# --- Offer Endpoints ---

@router.post("/listings/{listing_id}/offers")
async def create_offer(
    request: Request,
    listing_id: int,
    body: CreateOfferRequest,
    user_id: int = Depends(require_csrf)
) -> OfferResponse:
    """Make an offer on a listing."""
    env = request.scope["env"]

    try:
        # Get listing
        listing = await env.DB.prepare(
            "SELECT id, user_id, title, status, listing_type, price FROM listings WHERE id = ?"
        ).bind(listing_id).first()
        listing = convert_row(listing)

        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")

        if listing["status"] != "active":
            raise HTTPException(status_code=400, detail="Listing is not active")

        if listing["user_id"] == user_id:
            raise HTTPException(status_code=400, detail="Cannot make an offer on your own listing")

        # Validate offer type against listing type
        if body.offer_type == "buy" and listing["listing_type"] == "trade":
            raise HTTPException(status_code=400, detail="This listing is trade-only")

        if body.offer_type == "trade" and listing["listing_type"] == "sale":
            raise HTTPException(status_code=400, detail="This listing is sale-only")

        # Validate offer content
        if body.offer_type == "buy" and body.offer_amount is None:
            raise HTTPException(status_code=400, detail="Offer amount is required for buy offers")

        if body.offer_type == "trade" and not body.trade_items:
            raise HTTPException(status_code=400, detail="Trade items are required for trade offers")

        # Check for existing pending offer
        existing = await env.DB.prepare(
            "SELECT id FROM listing_offers WHERE listing_id = ? AND buyer_id = ? AND status = 'pending'"
        ).bind(listing_id, user_id).first()
        existing = convert_row(existing)

        if existing:
            raise HTTPException(status_code=400, detail="You already have a pending offer on this listing")

        # Build insert
        fields = ["listing_id", "buyer_id", "offer_type", "status"]
        values = [listing_id, user_id, body.offer_type, "pending"]

        if body.offer_amount is not None:
            fields.append("offer_amount")
            values.append(body.offer_amount)

        if body.trade_items:
            fields.append("trade_items")
            values.append(json.dumps([item.model_dump() for item in body.trade_items]))

        if body.message:
            fields.append("message")
            values.append(body.message)

        placeholders = ", ".join(["?" for _ in fields])
        field_names = ", ".join(fields)

        result = await env.DB.prepare(
            f"INSERT INTO listing_offers ({field_names}) VALUES ({placeholders}) RETURNING id, created_at, updated_at"
        ).bind(*values).first()
        result = convert_row(result)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create offer")

        # Get user info for response
        buyer = await env.DB.prepare(
            "SELECT id, name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()
        buyer = convert_row(buyer)

        seller = await env.DB.prepare(
            "SELECT id, name, picture FROM users WHERE id = ?"
        ).bind(listing["user_id"]).first()
        seller = convert_row(seller)

        rating_avg, rating_count = await get_seller_rating_info(env, listing["user_id"])

        # Send email notification to seller (non-blocking)
        try:
            buyer_name = to_python_value(buyer.get("name")) if buyer else "Someone"
            offer_amount_str = str(body.offer_amount) if body.offer_amount else "trade offer"
            await send_offer_notification(
                env,
                listing["user_id"],
                buyer_name,
                listing["title"],
                offer_amount_str
            )
        except Exception:
            pass  # Don't fail the request if email fails

        return OfferResponse(
            id=result["id"],
            listing_id=listing_id,
            listing_title=listing["title"],
            buyer=BuyerInfo(
                id=user_id,
                name=to_python_value(buyer.get("name")) if buyer else None,
                picture=to_python_value(buyer.get("picture")) if buyer else None
            ),
            seller=SellerInfo(
                id=listing["user_id"],
                name=to_python_value(seller.get("name")) if seller else None,
                picture=to_python_value(seller.get("picture")) if seller else None,
                rating_average=rating_avg,
                rating_count=rating_count
            ),
            offer_type=body.offer_type,
            offer_amount=body.offer_amount,
            trade_items=body.trade_items,
            message=body.message,
            status="pending",
            counter_amount=None,
            counter_message=None,
            created_at=str(result["created_at"]),
            updated_at=str(result["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error creating offer: {str(error)}")


@router.get("/offers/received")
async def get_received_offers(
    request: Request,
    status: Optional[str] = Query(None, pattern="^(pending|accepted|rejected|countered|withdrawn)$"),
    user_id: int = Depends(require_auth)
) -> list[OfferResponse]:
    """Get offers received on user's listings."""
    env = request.scope["env"]

    try:
        conditions = ["l.user_id = ?"]
        params = [user_id]

        if status:
            conditions.append("o.status = ?")
            params.append(status)

        where_clause = " AND ".join(conditions)

        result = await env.DB.prepare(
            f"""SELECT o.*, l.title as listing_title, l.user_id as seller_id,
                       b.name as buyer_name, b.picture as buyer_picture,
                       s.name as seller_name, s.picture as seller_picture
                FROM listing_offers o
                JOIN listings l ON o.listing_id = l.id
                JOIN users b ON o.buyer_id = b.id
                JOIN users s ON l.user_id = s.id
                WHERE {where_clause}
                ORDER BY o.created_at DESC"""
        ).bind(*params).all()
        rows = convert_rows(result)

        offers = []
        for row in rows:
            seller_id = row["seller_id"]
            rating_avg, rating_count = await get_seller_rating_info(env, seller_id)

            trade_items = []
            trade_items_raw = to_python_value(row.get("trade_items"))
            if trade_items_raw:
                try:
                    items_data = json.loads(trade_items_raw)
                    trade_items = [TradeItem(**item) for item in items_data]
                except Exception:
                    pass

            offers.append(OfferResponse(
                id=row["id"],
                listing_id=row["listing_id"],
                listing_title=row["listing_title"],
                buyer=BuyerInfo(
                    id=row["buyer_id"],
                    name=to_python_value(row.get("buyer_name")),
                    picture=to_python_value(row.get("buyer_picture"))
                ),
                seller=SellerInfo(
                    id=seller_id,
                    name=to_python_value(row.get("seller_name")),
                    picture=to_python_value(row.get("seller_picture")),
                    rating_average=rating_avg,
                    rating_count=rating_count
                ),
                offer_type=row["offer_type"],
                offer_amount=to_python_value(row.get("offer_amount")),
                trade_items=trade_items,
                message=to_python_value(row.get("message")),
                status=row["status"],
                counter_amount=to_python_value(row.get("counter_amount")),
                counter_message=to_python_value(row.get("counter_message")),
                created_at=str(row["created_at"]),
                updated_at=str(row["updated_at"])
            ))

        return offers

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching offers: {str(error)}")


@router.get("/offers/sent")
async def get_sent_offers(
    request: Request,
    status: Optional[str] = Query(None, pattern="^(pending|accepted|rejected|countered|withdrawn)$"),
    user_id: int = Depends(require_auth)
) -> list[OfferResponse]:
    """Get offers sent by user."""
    env = request.scope["env"]

    try:
        conditions = ["o.buyer_id = ?"]
        params = [user_id]

        if status:
            conditions.append("o.status = ?")
            params.append(status)

        where_clause = " AND ".join(conditions)

        result = await env.DB.prepare(
            f"""SELECT o.*, l.title as listing_title, l.user_id as seller_id,
                       b.name as buyer_name, b.picture as buyer_picture,
                       s.name as seller_name, s.picture as seller_picture
                FROM listing_offers o
                JOIN listings l ON o.listing_id = l.id
                JOIN users b ON o.buyer_id = b.id
                JOIN users s ON l.user_id = s.id
                WHERE {where_clause}
                ORDER BY o.created_at DESC"""
        ).bind(*params).all()
        rows = convert_rows(result)

        offers = []
        for row in rows:
            seller_id = row["seller_id"]
            rating_avg, rating_count = await get_seller_rating_info(env, seller_id)

            trade_items = []
            trade_items_raw = to_python_value(row.get("trade_items"))
            if trade_items_raw:
                try:
                    items_data = json.loads(trade_items_raw)
                    trade_items = [TradeItem(**item) for item in items_data]
                except Exception:
                    pass

            offers.append(OfferResponse(
                id=row["id"],
                listing_id=row["listing_id"],
                listing_title=row["listing_title"],
                buyer=BuyerInfo(
                    id=row["buyer_id"],
                    name=to_python_value(row.get("buyer_name")),
                    picture=to_python_value(row.get("buyer_picture"))
                ),
                seller=SellerInfo(
                    id=seller_id,
                    name=to_python_value(row.get("seller_name")),
                    picture=to_python_value(row.get("seller_picture")),
                    rating_average=rating_avg,
                    rating_count=rating_count
                ),
                offer_type=row["offer_type"],
                offer_amount=to_python_value(row.get("offer_amount")),
                trade_items=trade_items,
                message=to_python_value(row.get("message")),
                status=row["status"],
                counter_amount=to_python_value(row.get("counter_amount")),
                counter_message=to_python_value(row.get("counter_message")),
                created_at=str(row["created_at"]),
                updated_at=str(row["updated_at"])
            ))

        return offers

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching offers: {str(error)}")


@router.put("/offers/{offer_id}")
async def update_offer(
    request: Request,
    offer_id: int,
    body: UpdateOfferRequest,
    user_id: int = Depends(require_csrf)
) -> OfferResponse:
    """
    Accept, reject, counter, or withdraw an offer.
    Seller can: accept, reject, counter
    Buyer can: withdraw, accept counter
    """
    env = request.scope["env"]

    try:
        # Get offer with listing info
        offer = await env.DB.prepare(
            """SELECT o.*, l.user_id as seller_id, l.title as listing_title, l.status as listing_status
               FROM listing_offers o
               JOIN listings l ON o.listing_id = l.id
               WHERE o.id = ?"""
        ).bind(offer_id).first()
        offer = convert_row(offer)

        if not offer:
            raise HTTPException(status_code=404, detail="Offer not found")

        is_seller = offer["seller_id"] == user_id
        is_buyer = offer["buyer_id"] == user_id

        if not is_seller and not is_buyer:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Validate status transitions
        current_status = offer["status"]
        new_status = body.status

        if current_status not in ["pending", "countered"]:
            raise HTTPException(status_code=400, detail=f"Cannot update offer in status: {current_status}")

        # Validate permissions
        if is_buyer:
            if new_status == "withdrawn":
                pass  # Buyer can withdraw
            elif new_status == "accepted" and current_status == "countered":
                pass  # Buyer can accept counter
            else:
                raise HTTPException(status_code=403, detail="Buyer can only withdraw or accept counter offers")

        if is_seller:
            if new_status in ["accepted", "rejected", "countered"]:
                if new_status == "countered" and body.counter_amount is None:
                    raise HTTPException(status_code=400, detail="Counter amount is required for counter offers")
            else:
                raise HTTPException(status_code=403, detail="Seller can only accept, reject, or counter offers")

        # Check listing is still active
        if offer["listing_status"] != "active":
            raise HTTPException(status_code=400, detail="Listing is no longer active")

        # Update offer
        updates = ["status = ?", "updated_at = CURRENT_TIMESTAMP"]
        params = [new_status]

        if body.counter_amount is not None:
            updates.append("counter_amount = ?")
            params.append(body.counter_amount)

        if body.counter_message:
            updates.append("counter_message = ?")
            params.append(body.counter_message)

        params.append(offer_id)

        await env.DB.prepare(
            f"UPDATE listing_offers SET {', '.join(updates)} WHERE id = ?"
        ).bind(*params).run()

        # If accepted, create transaction and mark listing as sold
        if new_status == "accepted":
            # Determine final price
            final_price = offer.get("counter_amount") or offer.get("offer_amount")

            # Create transaction
            await env.DB.prepare(
                """INSERT INTO transactions (listing_id, offer_id, seller_id, buyer_id, final_price, payment_status)
                   VALUES (?, ?, ?, ?, ?, 'pending')"""
            ).bind(offer["listing_id"], offer_id, offer["seller_id"], offer["buyer_id"], final_price).run()

            # Mark listing as sold
            await env.DB.prepare(
                "UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(offer["listing_id"]).run()

            # Reject other pending offers
            await env.DB.prepare(
                """UPDATE listing_offers SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
                   WHERE listing_id = ? AND id != ? AND status = 'pending'"""
            ).bind(offer["listing_id"], offer_id).run()

        # Get updated offer for response
        updated = await env.DB.prepare(
            """SELECT o.*, l.title as listing_title, l.user_id as seller_id,
                      b.name as buyer_name, b.picture as buyer_picture,
                      s.name as seller_name, s.picture as seller_picture
               FROM listing_offers o
               JOIN listings l ON o.listing_id = l.id
               JOIN users b ON o.buyer_id = b.id
               JOIN users s ON l.user_id = s.id
               WHERE o.id = ?"""
        ).bind(offer_id).first()
        updated = convert_row(updated)

        rating_avg, rating_count = await get_seller_rating_info(env, updated["seller_id"])

        trade_items = []
        trade_items_raw = to_python_value(updated.get("trade_items"))
        if trade_items_raw:
            try:
                items_data = json.loads(trade_items_raw)
                trade_items = [TradeItem(**item) for item in items_data]
            except Exception:
                pass

        # Send email notification to buyer about offer response (non-blocking)
        if new_status in ["accepted", "rejected"] and is_seller:
            try:
                offer_amount_str = str(to_python_value(updated.get("offer_amount"), "0.00"))
                await send_offer_response_notification(
                    env,
                    updated["buyer_id"],
                    updated["listing_title"],
                    offer_amount_str,
                    new_status
                )
            except Exception:
                pass  # Don't fail the request if email fails

        return OfferResponse(
            id=updated["id"],
            listing_id=updated["listing_id"],
            listing_title=updated["listing_title"],
            buyer=BuyerInfo(
                id=updated["buyer_id"],
                name=to_python_value(updated.get("buyer_name")),
                picture=to_python_value(updated.get("buyer_picture"))
            ),
            seller=SellerInfo(
                id=updated["seller_id"],
                name=to_python_value(updated.get("seller_name")),
                picture=to_python_value(updated.get("seller_picture")),
                rating_average=rating_avg,
                rating_count=rating_count
            ),
            offer_type=updated["offer_type"],
            offer_amount=to_python_value(updated.get("offer_amount")),
            trade_items=trade_items,
            message=to_python_value(updated.get("message")),
            status=updated["status"],
            counter_amount=to_python_value(updated.get("counter_amount")),
            counter_message=to_python_value(updated.get("counter_message")),
            created_at=str(updated["created_at"]),
            updated_at=str(updated["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error updating offer: {str(error)}")


# --- Transaction Endpoints ---

@router.post("/transactions/{transaction_id}/complete")
async def complete_transaction(
    request: Request,
    transaction_id: int,
    body: CompleteTransactionRequest,
    user_id: int = Depends(require_csrf)
) -> TransactionResponse:
    """
    Mark a transaction as complete.
    Only the seller can complete (marks as shipped).
    """
    env = request.scope["env"]

    try:
        # Get transaction
        transaction = await env.DB.prepare(
            """SELECT t.*, l.title as listing_title
               FROM transactions t
               JOIN listings l ON t.listing_id = l.id
               WHERE t.id = ?"""
        ).bind(transaction_id).first()
        transaction = convert_row(transaction)

        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")

        if transaction["seller_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only seller can complete transaction")

        if transaction["payment_status"] == "completed":
            raise HTTPException(status_code=400, detail="Transaction already completed")

        # Update transaction
        updates = ["payment_status = 'completed'", "completed_at = CURRENT_TIMESTAMP"]
        params = []

        if body.tracking_number:
            updates.append("tracking_number = ?")
            params.append(body.tracking_number)
            updates.append("shipping_status = 'shipped'")

        if body.notes:
            updates.append("notes = ?")
            params.append(body.notes)

        params.append(transaction_id)

        await env.DB.prepare(
            f"UPDATE transactions SET {', '.join(updates)} WHERE id = ?"
        ).bind(*params).run()

        # Get updated transaction
        updated = await env.DB.prepare(
            """SELECT t.*, l.title as listing_title,
                      s.name as seller_name, s.picture as seller_picture,
                      b.name as buyer_name, b.picture as buyer_picture
               FROM transactions t
               JOIN listings l ON t.listing_id = l.id
               JOIN users s ON t.seller_id = s.id
               JOIN users b ON t.buyer_id = b.id
               WHERE t.id = ?"""
        ).bind(transaction_id).first()
        updated = convert_row(updated)

        rating_avg, rating_count = await get_seller_rating_info(env, updated["seller_id"])

        # Send email notification to buyer about transaction completion (non-blocking)
        try:
            final_price_str = str(to_python_value(updated.get("final_price"), "0.00"))
            await send_transaction_complete_notification(
                env,
                updated["buyer_id"],
                updated["listing_title"],
                final_price_str
            )
        except Exception:
            pass  # Don't fail the request if email fails

        return TransactionResponse(
            id=updated["id"],
            listing_id=updated["listing_id"],
            listing_title=updated["listing_title"],
            offer_id=to_python_value(updated.get("offer_id")),
            seller=SellerInfo(
                id=updated["seller_id"],
                name=to_python_value(updated.get("seller_name")),
                picture=to_python_value(updated.get("seller_picture")),
                rating_average=rating_avg,
                rating_count=rating_count
            ),
            buyer=BuyerInfo(
                id=updated["buyer_id"],
                name=to_python_value(updated.get("buyer_name")),
                picture=to_python_value(updated.get("buyer_picture"))
            ),
            final_price=to_python_value(updated.get("final_price")),
            commission_amount=to_python_value(updated.get("commission_amount"), 0),
            payment_status=updated["payment_status"],
            shipping_status=to_python_value(updated.get("shipping_status")),
            tracking_number=to_python_value(updated.get("tracking_number")),
            notes=to_python_value(updated.get("notes")),
            completed_at=str(updated["completed_at"]) if updated.get("completed_at") else None,
            created_at=str(updated["created_at"])
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error completing transaction: {str(error)}")


# --- Rating Endpoints ---

@router.post("/ratings")
async def create_rating(
    request: Request,
    body: CreateRatingRequest,
    user_id: int = Depends(require_csrf)
) -> RatingResponse:
    """
    Leave a rating after a transaction.
    Both buyer and seller can rate each other.
    """
    env = request.scope["env"]

    try:
        # Get transaction
        transaction = await env.DB.prepare(
            "SELECT * FROM transactions WHERE id = ?"
        ).bind(body.transaction_id).first()
        transaction = convert_row(transaction)

        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")

        if transaction["payment_status"] != "completed":
            raise HTTPException(status_code=400, detail="Cannot rate until transaction is completed")

        # Determine who is rating whom
        is_seller = transaction["seller_id"] == user_id
        is_buyer = transaction["buyer_id"] == user_id

        if not is_seller and not is_buyer:
            raise HTTPException(status_code=403, detail="Not part of this transaction")

        rated_user_id = transaction["buyer_id"] if is_seller else transaction["seller_id"]

        # Check for existing rating
        existing = await env.DB.prepare(
            "SELECT id FROM seller_ratings WHERE transaction_id = ? AND rater_id = ?"
        ).bind(body.transaction_id, user_id).first()
        existing = convert_row(existing)

        if existing:
            raise HTTPException(status_code=400, detail="You have already rated this transaction")

        # Create rating
        fields = ["transaction_id", "rater_id", "rated_user_id", "rating"]
        values = [body.transaction_id, user_id, rated_user_id, body.rating]

        if body.review_text:
            fields.append("review_text")
            values.append(body.review_text)

        placeholders = ", ".join(["?" for _ in fields])
        field_names = ", ".join(fields)

        result = await env.DB.prepare(
            f"INSERT INTO seller_ratings ({field_names}) VALUES ({placeholders}) RETURNING id, created_at"
        ).bind(*values).first()
        result = convert_row(result)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create rating")

        # Get user info
        rater = await env.DB.prepare(
            "SELECT id, name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()
        rater = convert_row(rater)

        rated = await env.DB.prepare(
            "SELECT id, name, picture FROM users WHERE id = ?"
        ).bind(rated_user_id).first()
        rated = convert_row(rated)

        rating_avg, rating_count = await get_seller_rating_info(env, rated_user_id)

        return RatingResponse(
            id=result["id"],
            transaction_id=body.transaction_id,
            rater=BuyerInfo(
                id=user_id,
                name=to_python_value(rater.get("name")) if rater else None,
                picture=to_python_value(rater.get("picture")) if rater else None
            ),
            rated_user=SellerInfo(
                id=rated_user_id,
                name=to_python_value(rated.get("name")) if rated else None,
                picture=to_python_value(rated.get("picture")) if rated else None,
                rating_average=rating_avg,
                rating_count=rating_count
            ),
            rating=body.rating,
            review_text=body.review_text,
            created_at=str(result["created_at"])
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error creating rating: {str(error)}")


@router.get("/users/{target_user_id}/ratings")
async def get_user_ratings(
    request: Request,
    target_user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: int = Depends(require_auth)
) -> UserRatingsResponse:
    """Get a user's seller ratings and reviews."""
    env = request.scope["env"]

    try:
        # Check user exists
        user = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ?"
        ).bind(target_user_id).first()
        user = convert_row(user)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get rating summary
        summary = await env.DB.prepare(
            """SELECT
                   AVG(rating) as avg_rating,
                   COUNT(*) as total,
                   SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as stars_1,
                   SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as stars_2,
                   SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as stars_3,
                   SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as stars_4,
                   SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as stars_5
               FROM seller_ratings WHERE rated_user_id = ?"""
        ).bind(target_user_id).first()
        summary = convert_row(summary)

        avg_rating = to_python_value(summary.get("avg_rating")) if summary else None
        total_ratings = to_python_value(summary.get("total"), 0) if summary else 0

        rating_breakdown = {}
        if summary:
            for i in range(1, 6):
                count = to_python_value(summary.get(f"stars_{i}"), 0)
                if count > 0:
                    rating_breakdown[i] = count

        # Get recent reviews
        offset = (page - 1) * limit

        result = await env.DB.prepare(
            """SELECT r.*,
                      rater.name as rater_name, rater.picture as rater_picture,
                      rated.name as rated_name, rated.picture as rated_picture
               FROM seller_ratings r
               JOIN users rater ON r.rater_id = rater.id
               JOIN users rated ON r.rated_user_id = rated.id
               WHERE r.rated_user_id = ?
               ORDER BY r.created_at DESC
               LIMIT ? OFFSET ?"""
        ).bind(target_user_id, limit, offset).all()
        rows = convert_rows(result)

        reviews = []
        for row in rows:
            reviews.append(RatingResponse(
                id=row["id"],
                transaction_id=row["transaction_id"],
                rater=BuyerInfo(
                    id=row["rater_id"],
                    name=to_python_value(row.get("rater_name")),
                    picture=to_python_value(row.get("rater_picture"))
                ),
                rated_user=SellerInfo(
                    id=row["rated_user_id"],
                    name=to_python_value(row.get("rated_name")),
                    picture=to_python_value(row.get("rated_picture")),
                    rating_average=round(avg_rating, 2) if avg_rating else None,
                    rating_count=total_ratings
                ),
                rating=row["rating"],
                review_text=to_python_value(row.get("review_text")),
                created_at=str(row["created_at"])
            ))

        return UserRatingsResponse(
            user_id=target_user_id,
            average_rating=round(avg_rating, 2) if avg_rating else None,
            total_ratings=total_ratings,
            rating_breakdown=rating_breakdown,
            recent_reviews=reviews
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching ratings: {str(error)}")
