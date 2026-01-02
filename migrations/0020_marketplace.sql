-- Migration 0020: Marketplace System
-- Creates tables for listings, offers, transactions, and seller ratings

-- Listings table: Items for sale or trade
CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    price REAL,  -- NULL for trade-only listings
    currency TEXT DEFAULT 'USD',
    condition TEXT,  -- Mint, Near Mint, VG+, VG, Good, Fair, Poor
    listing_type TEXT NOT NULL DEFAULT 'sale',  -- sale, trade, both
    status TEXT NOT NULL DEFAULT 'active',  -- active, sold, cancelled
    location_city TEXT,
    location_state TEXT,
    shipping_available INTEGER DEFAULT 1,  -- 0 = local only, 1 = will ship
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Listing images table: Multiple images per listing
CREATE TABLE IF NOT EXISTS listing_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Listing offers table: Buy offers and trade proposals
CREATE TABLE IF NOT EXISTS listing_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_type TEXT NOT NULL DEFAULT 'buy',  -- buy, trade
    offer_amount REAL,  -- For buy offers
    trade_items TEXT,  -- JSON array of items being offered in trade
    message TEXT,  -- Personal message to seller
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, rejected, countered, withdrawn
    counter_amount REAL,  -- For counter offers
    counter_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table: Completed sales/trades
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    offer_id INTEGER REFERENCES listing_offers(id) ON DELETE SET NULL,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    final_price REAL,  -- NULL for pure trades
    commission_amount REAL DEFAULT 0,  -- Platform fee (if any)
    payment_status TEXT DEFAULT 'pending',  -- pending, completed, refunded
    shipping_status TEXT,  -- pending, shipped, delivered
    tracking_number TEXT,
    notes TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seller ratings table: Reviews after transactions
CREATE TABLE IF NOT EXISTS seller_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rated_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,  -- 1-5 stars
    review_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id, rater_id)  -- One rating per user per transaction
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_collection ON listings(collection_id);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_images_position ON listing_images(listing_id, position);

CREATE INDEX IF NOT EXISTS idx_offers_listing ON listing_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_offers_buyer ON listing_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON listing_offers(status);

CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_listing ON transactions(listing_id);

CREATE INDEX IF NOT EXISTS idx_ratings_rated_user ON seller_ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_transaction ON seller_ratings(transaction_id);

-- Trigger to validate rating values (1-5)
CREATE TRIGGER IF NOT EXISTS validate_rating_value
BEFORE INSERT ON seller_ratings
BEGIN
    SELECT CASE
        WHEN NEW.rating < 1 OR NEW.rating > 5 THEN
            RAISE(ABORT, 'Rating must be between 1 and 5')
    END;
END;

-- Trigger to validate rating update values
CREATE TRIGGER IF NOT EXISTS validate_rating_value_update
BEFORE UPDATE ON seller_ratings
BEGIN
    SELECT CASE
        WHEN NEW.rating < 1 OR NEW.rating > 5 THEN
            RAISE(ABORT, 'Rating must be between 1 and 5')
    END;
END;

-- Trigger to validate listing type
CREATE TRIGGER IF NOT EXISTS validate_listing_type
BEFORE INSERT ON listings
BEGIN
    SELECT CASE
        WHEN NEW.listing_type NOT IN ('sale', 'trade', 'both') THEN
            RAISE(ABORT, 'Listing type must be sale, trade, or both')
    END;
END;

-- Trigger to validate listing status
CREATE TRIGGER IF NOT EXISTS validate_listing_status
BEFORE INSERT ON listings
BEGIN
    SELECT CASE
        WHEN NEW.status NOT IN ('active', 'sold', 'cancelled') THEN
            RAISE(ABORT, 'Listing status must be active, sold, or cancelled')
    END;
END;

-- Trigger to validate offer type
CREATE TRIGGER IF NOT EXISTS validate_offer_type
BEFORE INSERT ON listing_offers
BEGIN
    SELECT CASE
        WHEN NEW.offer_type NOT IN ('buy', 'trade') THEN
            RAISE(ABORT, 'Offer type must be buy or trade')
    END;
END;

-- Trigger to validate offer status
CREATE TRIGGER IF NOT EXISTS validate_offer_status
BEFORE INSERT ON listing_offers
BEGIN
    SELECT CASE
        WHEN NEW.status NOT IN ('pending', 'accepted', 'rejected', 'countered', 'withdrawn') THEN
            RAISE(ABORT, 'Offer status must be pending, accepted, rejected, countered, or withdrawn')
    END;
END;

-- Trigger to prevent self-offers
CREATE TRIGGER IF NOT EXISTS prevent_self_offer
BEFORE INSERT ON listing_offers
BEGIN
    SELECT CASE
        WHEN NEW.buyer_id = (SELECT user_id FROM listings WHERE id = NEW.listing_id) THEN
            RAISE(ABORT, 'Cannot make an offer on your own listing')
    END;
END;

-- Trigger to update listing.updated_at on change
CREATE TRIGGER IF NOT EXISTS listings_updated_at
AFTER UPDATE ON listings
BEGIN
    UPDATE listings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update offer.updated_at on change
CREATE TRIGGER IF NOT EXISTS offers_updated_at
AFTER UPDATE ON listing_offers
BEGIN
    UPDATE listing_offers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
