"""
Together.ai Chat API proxy for AI collection assistant
Uses ServiceNow-AI/Apriel-1.6-15b-Thinker model
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
import js
from pyodide.ffi import to_js
import re
import json

router = APIRouter()

TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
CHAT_MODEL = "ServiceNow-AI/Apriel-1.6-15b-Thinker"
DISCOGS_API_URL = "https://api.discogs.com/database/search"


class Album(BaseModel):
    """Album in user's collection"""
    artist: str
    album: str
    cover: Optional[str] = None
    year: Optional[int] = None
    discogs_id: Optional[int] = None


class ChatMessage(BaseModel):
    """Chat message from user"""
    message: str
    collection: list[Album] = []
    history: list[dict] = []


class ChatResponse(BaseModel):
    """Chat response from AI"""
    response: str
    albums_to_add: list[Album] = []
    albums_to_remove: list[Album] = []
    albums_to_showcase: list[Album] = []


def build_system_prompt(collection: list[Album]) -> str:
    """Build system prompt with collection context"""

    collection_list = ""
    if collection:
        collection_list = "\n".join([f"- {a.artist} - {a.album}" for a in collection])
    else:
        collection_list = "(empty)"

    return f"""You are a helpful vinyl record collection assistant. You help users manage their vinyl collection.

CURRENT COLLECTION ({len(collection)} albums):
{collection_list}

ACTIONS YOU CAN PERFORM:
When the user asks you to add, remove, or showcase albums, include the appropriate action tags in your response.

ADD ALBUM: When user wants to add an album, use: {{{{ADD:Artist Name|Album Title}}}}
REMOVE ALBUM: When user wants to remove an album, use: {{{{REMOVE:Artist Name|Album Title}}}}
SHOWCASE ALBUM: When user wants to feature an album in showcase, use: {{{{SHOWCASE:Artist Name|Album Title}}}}

EXAMPLES:
- User: "Add Maggot Brain by Funkadelic" → "I've added that classic to your collection! {{{{ADD:Funkadelic|Maggot Brain}}}}"
- User: "Remove Dark Side of the Moon" → "Removed from your collection. {{{{REMOVE:Pink Floyd|Dark Side of the Moon}}}}"
- User: "Add these albums: Abbey Road by The Beatles and Thriller by Michael Jackson" → "Added both albums! {{{{ADD:The Beatles|Abbey Road}}}} {{{{ADD:Michael Jackson|Thriller}}}}"
- User: "Showcase Kind of Blue" → "Added to your showcase! {{{{SHOWCASE:Miles Davis|Kind of Blue}}}}"

RULES:
1. Only use action tags when the user explicitly asks to add, remove, or showcase
2. For recommendations, just describe the albums without action tags
3. Be conversational and helpful
4. Keep responses concise (1-3 sentences)
5. If user asks to remove an album not in their collection, politely say it's not there
6. For ambiguous requests, ask for clarification

IMPORTANT: Your response should be friendly and natural. The action tags will be processed automatically."""


def parse_actions(response: str) -> tuple[list[Album], list[Album], list[Album]]:
    """Parse action tags from AI response"""
    albums_to_add = []
    albums_to_remove = []
    albums_to_showcase = []

    # Pattern: {ADD:Artist|Album} or {REMOVE:Artist|Album} or {SHOWCASE:Artist|Album}
    # Support both single and double braces
    patterns = [
        (r'\{\{ADD:([^|]+)\|([^}]+)\}\}', albums_to_add),
        (r'\{ADD:([^|]+)\|([^}]+)\}', albums_to_add),
        (r'\{\{REMOVE:([^|]+)\|([^}]+)\}\}', albums_to_remove),
        (r'\{REMOVE:([^|]+)\|([^}]+)\}', albums_to_remove),
        (r'\{\{SHOWCASE:([^|]+)\|([^}]+)\}\}', albums_to_showcase),
        (r'\{SHOWCASE:([^|]+)\|([^}]+)\}', albums_to_showcase),
    ]

    for pattern, target_list in patterns:
        for match in re.finditer(pattern, response, re.IGNORECASE):
            artist = match.group(1).strip()
            album = match.group(2).strip()

            # Validate: must have meaningful content
            if artist and album and len(artist) > 1 and len(album) > 1:
                # Skip if it looks like template/placeholder
                if artist.lower() not in ['artist', 'artist name'] and album.lower() not in ['album', 'album title']:
                    target_list.append(Album(artist=artist, album=album))

    return albums_to_add, albums_to_remove, albums_to_showcase


def clean_response(response: str) -> str:
    """
    Clean the model response for display to user.
    Removes thinking blocks and action tags.
    """
    cleaned = response

    # Remove <think>...</think> blocks (Thinker model reasoning)
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<thinking>[\s\S]*?</thinking>', '', cleaned, flags=re.IGNORECASE)

    # Remove action tags from display
    cleaned = re.sub(r'\{\{?ADD:[^}]+\}\}?', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\{\{?REMOVE:[^}]+\}\}?', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\{\{?SHOWCASE:[^}]+\}\}?', '', cleaned, flags=re.IGNORECASE)

    # Clean up extra whitespace
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    cleaned = re.sub(r'  +', ' ', cleaned)
    cleaned = cleaned.strip()

    # If nothing left, provide default response
    if not cleaned or len(cleaned) < 3:
        cleaned = "Done! Is there anything else you'd like me to help with?"

    return cleaned


async def search_discogs_for_album(artist: str, album: str, discogs_key: str, discogs_secret: str) -> Album:
    """
    Search Discogs for album info and return enriched album with cover, year, discogs_id.
    """
    query = f"{artist} {album}"
    print(f"[Discogs] Searching for: {query}")

    try:
        url = f"{DISCOGS_API_URL}?q={js.encodeURIComponent(query)}&type=release&per_page=10"

        headers = to_js({
            "Authorization": f"Discogs key={discogs_key}, secret={discogs_secret}",
            "User-Agent": "NicheCollectorConnector/1.0"
        })

        response = await js.fetch(url, to_js({"headers": headers}))

        if response.status != 200:
            print(f"[Discogs] Error: {response.status}")
            return Album(artist=artist, album=album)

        data = (await response.json()).to_py()
        results = data.get("results", [])

        if not results:
            print(f"[Discogs] No results for: {query}")
            return Album(artist=artist, album=album)

        # Score results to find best match
        best_result = None
        best_score = -1

        for result in results:
            score = 0
            title = result.get("title", "").lower()

            # Check artist match
            if artist.lower() in title:
                score += 10

            # Check album match
            if album.lower() in title:
                score += 10

            # Prefer results with cover images
            cover = result.get("cover_image", "")
            if cover and "spacer.gif" not in cover:
                score += 5

            # Prefer vinyl/LP formats
            formats = result.get("format", [])
            if isinstance(formats, list):
                format_str = " ".join(formats).lower()
                if "vinyl" in format_str or "lp" in format_str:
                    score += 3

            if score > best_score:
                best_score = score
                best_result = result

        if best_result:
            cover = best_result.get("cover_image")
            if not cover or "spacer.gif" in cover:
                cover = best_result.get("thumb")

            year = None
            if best_result.get("year"):
                try:
                    year = int(best_result["year"])
                except:
                    pass

            print(f"[Discogs] Found: {best_result.get('title')} (score: {best_score})")

            return Album(
                artist=artist,
                album=album,
                cover=cover,
                year=year,
                discogs_id=best_result.get("id")
            )

        return Album(artist=artist, album=album)

    except Exception as e:
        print(f"[Discogs] Error: {e}")
        return Album(artist=artist, album=album)


@router.post("/")
async def chat(request: Request, body: ChatMessage) -> ChatResponse:
    """
    Send a message to the AI assistant.
    Returns response and any album actions to perform.
    """
    env = request.scope["env"]

    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message required")

    # Build messages for API
    messages = [
        {"role": "system", "content": build_system_prompt(body.collection)}
    ]

    # Add history (last 10 messages)
    for msg in body.history[-10:]:
        messages.append(msg)

    # Add current message
    messages.append({"role": "user", "content": body.message})

    try:
        headers = to_js({
            "Authorization": f"Bearer {env.TOGETHER_API_KEY}",
            "Content-Type": "application/json"
        })

        request_body = to_js({
            "model": CHAT_MODEL,
            "messages": messages,
            "max_tokens": 512,
            "temperature": 0.7,
            "top_p": 0.9
        })

        response = await js.fetch(TOGETHER_API_URL, to_js({
            "method": "POST",
            "headers": headers,
            "body": js.JSON.stringify(request_body)
        }))

        if response.status != 200:
            error_text = await response.text()
            print(f"[Chat] API error: {error_text[:200]}")
            raise HTTPException(status_code=response.status, detail="AI service error")

        data = (await response.json()).to_py()
        raw_response = data["choices"][0]["message"]["content"]

        print(f"[Chat] Raw response length: {len(raw_response)}")

        # Parse actions BEFORE cleaning (tags are in the response)
        albums_to_add, albums_to_remove, albums_to_showcase = parse_actions(raw_response)

        print(f"[Chat] Actions - Add: {len(albums_to_add)}, Remove: {len(albums_to_remove)}, Showcase: {len(albums_to_showcase)}")

        # Enrich albums to add with Discogs data
        enriched_add = []
        for album in albums_to_add:
            print(f"[Chat] Enriching: {album.artist} - {album.album}")
            enriched = await search_discogs_for_album(
                album.artist,
                album.album,
                env.DISCOGS_KEY,
                env.DISCOGS_SECRET
            )
            enriched_add.append(enriched)

        # Enrich showcase albums too
        enriched_showcase = []
        for album in albums_to_showcase:
            enriched = await search_discogs_for_album(
                album.artist,
                album.album,
                env.DISCOGS_KEY,
                env.DISCOGS_SECRET
            )
            enriched_showcase.append(enriched)

        # Clean response for display
        cleaned_response = clean_response(raw_response)

        return ChatResponse(
            response=cleaned_response,
            albums_to_add=enriched_add,
            albums_to_remove=albums_to_remove,
            albums_to_showcase=enriched_showcase
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Chat] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Sorry, I had trouble processing that. Please try again."
        )
