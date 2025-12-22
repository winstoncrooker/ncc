"""
Image upload routes for profile pictures and backgrounds
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
import base64
import uuid
from datetime import datetime
import js

from routes.auth import require_auth

router = APIRouter()


class ImageUpload(BaseModel):
    """Base64 encoded image upload"""
    image: str  # Base64 encoded image data
    type: str = "profile"  # "profile" or "background"


class UploadResponse(BaseModel):
    """Upload response with URL"""
    url: str
    type: str


@router.post("/image")
async def upload_image(
    request: Request,
    body: ImageUpload,
    user_id: int = Depends(require_auth)
) -> UploadResponse:
    """
    Upload an image to R2 storage.
    Accepts base64 encoded image data.
    Returns the public URL of the uploaded image.
    """
    env = request.scope["env"]

    try:
        # Validate image type
        if body.type not in ["profile", "background", "item"]:
            raise HTTPException(status_code=400, detail="Invalid image type")

        # Parse base64 data
        # Format: "data:image/jpeg;base64,/9j/4AAQ..."
        if "," in body.image:
            header, data = body.image.split(",", 1)
            # Extract content type
            if "image/png" in header:
                ext = "png"
                content_type = "image/png"
            elif "image/gif" in header:
                ext = "gif"
                content_type = "image/gif"
            elif "image/webp" in header:
                ext = "webp"
                content_type = "image/webp"
            else:
                ext = "jpg"
                content_type = "image/jpeg"
        else:
            data = body.image
            ext = "jpg"
            content_type = "image/jpeg"

        # Decode base64
        try:
            image_bytes = base64.b64decode(data)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")

        # Validate size (max 5MB)
        if len(image_bytes) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"users/{user_id}/{body.type}_{timestamp}_{unique_id}.{ext}"

        # Convert Python bytes to JavaScript Uint8Array for R2
        js_array = js.Uint8Array.new(list(image_bytes))

        # Upload to R2
        await env.CACHE.put(
            filename,
            js_array,
            httpMetadata={"contentType": content_type}
        )

        # Build public URL
        # For development, we'll use the Worker to serve images
        # In production, you'd use a custom domain or R2 public URL
        host = request.headers.get("host", "localhost:8788")
        scheme = "https" if "workers.dev" in host else "http"
        url = f"{scheme}://{host}/api/uploads/{filename}"

        # Update user profile with new image URL (only for profile/background types)
        if body.type == "profile":
            await env.DB.prepare(
                "UPDATE users SET picture = ? WHERE id = ?"
            ).bind(url, user_id).run()
        elif body.type == "background":
            await env.DB.prepare(
                "UPDATE users SET background_image = ? WHERE id = ?"
            ).bind(url, user_id).run()
        # "item" type images are just uploaded and returned - caller updates the item

        return UploadResponse(url=url, type=body.type)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/{path:path}")
async def get_image(request: Request, path: str):
    """
    Serve uploaded images from R2.
    """
    env = request.scope["env"]

    try:
        obj = await env.CACHE.get(path)

        if not obj:
            raise HTTPException(status_code=404, detail="Image not found")

        # Get the image data
        data = await obj.arrayBuffer()

        # Convert to bytes if needed
        if hasattr(data, 'to_py'):
            data = bytes(data.to_py())
        elif not isinstance(data, bytes):
            data = bytes(data)

        # Get content type
        content_type = "image/jpeg"
        if obj.httpMetadata and hasattr(obj.httpMetadata, 'contentType'):
            content_type = obj.httpMetadata.contentType
        elif path.endswith(".png"):
            content_type = "image/png"
        elif path.endswith(".gif"):
            content_type = "image/gif"
        elif path.endswith(".webp"):
            content_type = "image/webp"

        from fastapi.responses import Response
        return Response(
            content=data,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=31536000",
                "Access-Control-Allow-Origin": "*"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Get image error: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving image: {str(e)}")
