"""
Together.ai Chat API proxy for AI collection assistant
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
import js
from pyodide.ffi import to_js

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
    collection_context = ""

    if collection:
        collection_context = f"\n\nThe user's vinyl collection currently contains {len(collection)} albums:\n"
        for i, item in enumerate(collection, 1):
            collection_context += f"{i}. {item.artist} - {item.album}\n"
    else:
        collection_context = "\n\nThe user has not uploaded any albums to their collection yet."

    return f"""You are a vinyl record collection assistant.

STRICT OUTPUT FORMAT - You MUST follow this exactly:
1. Do any thinking silently
2. Output ONLY this format:

FINAL_ANSWER:
[Your 1-2 sentence response here, with any command tags]

COMMANDS (include in FINAL_ANSWER when user requests):
- Add: [ADD_ALBUM: Artist - Album]
- Remove: [REMOVE_ALBUM: Artist - Album]
- Showcase: [SHOWCASE: Artist - Album]

RULES:
- Only use commands when user explicitly asks
- For recommendations, suggest without ADD_ALBUM
- Keep responses under 2 sentences

Example:
FINAL_ANSWER:
Added to your collection! [ADD_ALBUM: Funkadelic - Maggot Brain]

{collection_context}"""


def parse_album_actions(response: str) -> tuple[list[Album], list[Album], list[Album]]:
    """Parse AI response for album add/remove/showcase actions"""
    import re

    albums_to_add = []
    albums_to_remove = []
    albums_to_showcase = []

    # Parse additions
    add_pattern = r"\[ADD_ALBUM:\s*(.+?)\s*-\s*(.+?)\]"
    for match in re.finditer(add_pattern, response):
        artist = match.group(1).strip()
        album = match.group(2).strip()
        if artist and album and len(artist) > 1 and len(album) > 1:
            if not re.match(r'^[\s\-\.\,\?\!]+$', artist) and not re.match(r'^[\s\-\.\,\?\!]+$', album):
                albums_to_add.append(Album(artist=artist, album=album))

    # Parse removals
    remove_pattern = r"\[REMOVE_ALBUM:\s*(.+?)\s*-\s*(.+?)\]"
    for match in re.finditer(remove_pattern, response):
        artist = match.group(1).strip()
        album = match.group(2).strip()
        if artist and album and len(artist) > 1 and len(album) > 1:
            if not re.match(r'^[\s\-\.\,\?\!]+$', artist) and not re.match(r'^[\s\-\.\,\?\!]+$', album):
                albums_to_remove.append(Album(artist=artist, album=album))

    # Parse showcase
    showcase_pattern = r"\[SHOWCASE:\s*(.+?)\s*-\s*(.+?)\]"
    for match in re.finditer(showcase_pattern, response):
        artist = match.group(1).strip()
        album = match.group(2).strip()
        if artist and album and len(artist) > 1 and len(album) > 1:
            if not re.match(r'^[\s\-\.\,\?\!]+$', artist) and not re.match(r'^[\s\-\.\,\?\!]+$', album):
                albums_to_showcase.append(Album(artist=artist, album=album))

    return albums_to_add, albums_to_remove, albums_to_showcase


async def search_discogs_for_album(artist: str, album: str, discogs_key: str, discogs_secret: str) -> Album:
    """
    Search Discogs for album info and return enriched album with cover, year, discogs_id.
    Intelligently picks the best matching result.
    """
    query = f"{artist} {album}"
    print(f"[Discogs] Searching for: {query}")

    try:
        # Use JavaScript fetch to avoid Cloudflare blocking
        url = f"{DISCOGS_API_URL}?q={js.encodeURIComponent(query)}&type=release&per_page=10"

        headers = to_js({
            "Authorization": f"Discogs key={discogs_key}, secret={discogs_secret}",
            "User-Agent": "NicheCollectorConnector/1.0 +https://github.com/winstoncrooker/ncc"
        })

        response = await js.fetch(url, to_js({"headers": headers}))
        print(f"[Discogs] Response status: {response.status}")

        if response.status != 200:
            text = await response.text()
            print(f"[Discogs] Error response: {text[:200]}")
            return Album(artist=artist, album=album)

        data = (await response.json()).to_py()
        results = data.get("results", [])
        print(f"[Discogs] Found {len(results)} results")

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
            if result.get("cover_image") and "spacer.gif" not in result.get("cover_image", ""):
                score += 5

            # Prefer vinyl/LP formats
            formats = result.get("format", [])
            if isinstance(formats, list):
                format_str = " ".join(formats).lower()
                if "vinyl" in format_str or "lp" in format_str:
                    score += 3
                if "album" in format_str:
                    score += 2

            # Prefer original releases (lower year often means original)
            year = result.get("year")
            if year and isinstance(year, (int, str)):
                try:
                    year_int = int(year)
                    if 1950 <= year_int <= 2030:
                        score += 1
                except:
                    pass

            if score > best_score:
                best_score = score
                best_result = result

        if best_result:
            # Get cover - prefer cover_image over thumb
            cover = best_result.get("cover_image")
            if not cover or "spacer.gif" in cover:
                cover = best_result.get("thumb")

            # Get year
            year = None
            if best_result.get("year"):
                try:
                    year = int(best_result["year"])
                except:
                    pass

            print(f"[Discogs] Best match: {best_result.get('title')} (score: {best_score})")
            print(f"[Discogs] Cover: {cover[:50] if cover else 'None'}...")

            return Album(
                artist=artist,
                album=album,
                cover=cover,
                year=year,
                discogs_id=best_result.get("id")
            )

        print(f"[Discogs] No good match found for: {query}")
        return Album(artist=artist, album=album)

    except Exception as e:
        print(f"Discogs search error: {e}")
        return Album(artist=artist, album=album)


def clean_response(response: str) -> str:
    """
    Extract ONLY the FINAL_ANSWER content, stripping all reasoning/thinking.
    This is mandatory server-side filtering for clean UX.
    """
    import re

    # Log raw output for debugging (optional - can be removed in production)
    print(f"[Chat] Raw model output length: {len(response)}")

    # Strategy 1: Extract FINAL_ANSWER block if present
    final_match = re.search(r'FINAL_ANSWER:\s*\n?([\s\S]*?)(?:$|\n\n(?=[A-Z]))', response, re.IGNORECASE)
    if final_match:
        cleaned = final_match.group(1).strip()
    else:
        # Strategy 2: Try to find content after common reasoning patterns end
        # Look for the last meaningful sentence that isn't reasoning
        cleaned = response

    # Remove ALL thinking/reasoning blocks (multiple formats)
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<thinking>[\s\S]*?</thinking>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<reasoning>[\s\S]*?</reasoning>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<internal>[\s\S]*?</internal>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[think\][\s\S]*?\[/think\]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[thinking\][\s\S]*?\[/thinking\]', '', cleaned, flags=re.IGNORECASE)

    # Remove common reasoning sentence patterns
    reasoning_patterns = [
        r'^.*?The user wants to.*?[\.\n]',
        r'^.*?So we need to.*?[\.\n]',
        r'^.*?The format.*?[\.\n]',
        r'^.*?The guidelines.*?[\.\n]',
        r'^.*?Looking at.*?[\.\n]',
        r'^.*?Let me.*?[\.\n]',
        r'^.*?I need to.*?[\.\n]',
        r'^.*?First,.*?[\.\n]',
        r'^.*?I should.*?[\.\n]',
        r'^.*?This means.*?[\.\n]',
        r'^.*?Based on.*?[\.\n]',
        r'^.*?According to.*?[\.\n]',
        r'^.*?The collection.*?contains.*?[\.\n]',
        r'^.*?There\'s no.*?[\.\n]',
        r'^.*?We need to.*?[\.\n]',
    ]
    for pattern in reasoning_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.MULTILINE | re.IGNORECASE)

    # Remove any "FINAL_ANSWER:" prefix that might remain
    cleaned = re.sub(r'^FINAL_ANSWER:\s*', '', cleaned, flags=re.IGNORECASE)

    # Remove command tags from display (they're parsed separately)
    cleaned = re.sub(r'\[ADD_ALBUM:\s*.+?\s*-\s*.+?\]', '', cleaned)
    cleaned = re.sub(r'\[REMOVE_ALBUM:\s*.+?\s*-\s*.+?\]', '', cleaned)
    cleaned = re.sub(r'\[SHOWCASE:\s*.+?\s*-\s*.+?\]', '', cleaned)

    # Clean up whitespace
    cleaned = re.sub(r'\n{2,}', '\n', cleaned)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned)
    cleaned = cleaned.strip()

    if not cleaned or len(cleaned) < 5:
        cleaned = "I've processed your request. Is there anything else I can help with?"

    return cleaned


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
        # Use js.fetch to avoid Cloudflare blocking
        headers = to_js({
            "Authorization": f"Bearer {env.TOGETHER_API_KEY}",
            "Content-Type": "application/json"
        })

        body = to_js({
            "model": CHAT_MODEL,
            "messages": messages,
            "max_tokens": 256,
            "temperature": 0.2
        })

        response = await js.fetch(TOGETHER_API_URL, to_js({
            "method": "POST",
            "headers": headers,
            "body": js.JSON.stringify(body)
        }))

        if response.status != 200:
            error_text = await response.text()
            raise HTTPException(status_code=response.status, detail=f"API error: {error_text[:200]}")

        data = (await response.json()).to_py()
        assistant_message = data["choices"][0]["message"]["content"]

        # Parse actions before cleaning
        albums_to_add, albums_to_remove, albums_to_showcase = parse_album_actions(assistant_message)

        # Enrich albums with Discogs data (covers, year, etc.)
        enriched_albums = []
        print(f"[Chat] Albums to enrich: {len(albums_to_add)}")
        for album in albums_to_add:
            print(f"[Chat] Enriching: {album.artist} - {album.album}")
            enriched = await search_discogs_for_album(
                album.artist,
                album.album,
                env.DISCOGS_KEY,
                env.DISCOGS_SECRET
            )
            print(f"[Chat] Enriched result has cover: {enriched.cover is not None}")
            enriched_albums.append(enriched)

        # Enrich showcase albums too
        enriched_showcase = []
        print(f"[Chat] Albums to showcase: {len(albums_to_showcase)}")
        for album in albums_to_showcase:
            print(f"[Chat] Showcase: {album.artist} - {album.album}")
            enriched = await search_discogs_for_album(
                album.artist,
                album.album,
                env.DISCOGS_KEY,
                env.DISCOGS_SECRET
            )
            enriched_showcase.append(enriched)

        # Clean response for display
        cleaned_response = clean_response(assistant_message)

        return ChatResponse(
            response=cleaned_response,
            albums_to_add=enriched_albums,
            albums_to_remove=albums_to_remove,
            albums_to_showcase=enriched_showcase
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Sorry, I had trouble processing that. Please try again."
        )
