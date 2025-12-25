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
from urllib.parse import quote_plus

router = APIRouter()

TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
CHAT_MODEL = "ServiceNow-AI/Apriel-1.6-15b-Thinker"
DISCOGS_API_URL = "https://api.discogs.com/database/search"

# Category-specific AI prompts
CATEGORY_AI_PROMPTS = {
    "vinyl": """You are a vinyl record collection assistant. Help users manage their record collection and write their bio.

ACTIONS: {{ADD:Artist|Album}}, {{REMOVE:Artist|Album}}, {{SHOWCASE:Artist|Album}}
EXPERTISE: Grading (VG/NM/M), pressings, genres, Discogs integration.
BIO HELP: Help write bios about their vinyl journey, favorite genres, turntable setup.""",

    "trading-cards": """You are a trading card expert. Help users manage their card collections.

ACTIONS: {{ADD:Set|Card Name}}, {{REMOVE:Set|Card Name}}, {{SHOWCASE:Set|Card Name}}
EXPERTISE: Pokemon, MTG, Yu-Gi-Oh, Sports cards, grading (PSA/BGS/CGC).
BIO HELP: Help write bios about their card collecting journey, favorite sets, deck building.""",

    "cars": """You are an automotive enthusiast assistant. Help users document their garage and builds.

ACTIONS: {{ADD:Year|Make Model}}, {{REMOVE:Year|Make Model}}, {{SHOWCASE:Year|Make Model}}
EXPERTISE: Classics, JDM, muscle cars, builds, mods, valuations.
BIO HELP: Help write bios about their automotive passion, build history, favorite meets.""",

    "sneakers": """You are a sneaker culture expert. Help users manage their sneaker collection.

ACTIONS: {{ADD:Brand|Model Colorway}}, {{REMOVE:Brand|Model}}, {{SHOWCASE:Brand|Model}}
EXPERTISE: Jordans, Nike, Adidas, resale market, authentication.
BIO HELP: Help write bios about their sneaker journey, grails, favorite silhouettes.""",

    "watches": """You are a horology expert. Help users manage their watch collection.

ACTIONS: {{ADD:Brand|Model Reference}}, {{REMOVE:Brand|Model}}, {{SHOWCASE:Brand|Model}}
EXPERTISE: Luxury, vintage, movements, complications, market values.
BIO HELP: Help write bios about their horological journey, collecting philosophy.""",

    "comics": """You are a comic book expert. Help users manage their comic collection.

ACTIONS: {{ADD:Publisher|Series Issue}}, {{REMOVE:Publisher|Series Issue}}, {{SHOWCASE:Publisher|Series Issue}}
EXPERTISE: Marvel, DC, indie, grading (CGC), key issues, first appearances.
BIO HELP: Help write bios about their reading habits, favorite runs, collecting focus.""",

    "video-games": """You are a video game collector assistant. Help users manage their game library.

ACTIONS: {{ADD:Platform|Title}}, {{REMOVE:Platform|Title}}, {{SHOWCASE:Platform|Title}}
EXPERTISE: Retro, CIB, sealed games, platforms, valuations.
BIO HELP: Help write bios about their gaming journey, favorite consoles, now playing.""",

    "coins": """You are a numismatic expert. Help users manage their coin collection.

ACTIONS: {{ADD:Country|Denomination Year}}, {{REMOVE:Country|Denomination Year}}, {{SHOWCASE:Country|Denomination Year}}
EXPERTISE: US coins, world coins, ancient, grading (PCGS/NGC), bullion.
BIO HELP: Help write bios about their numismatic interests, collecting focus, favorite coins."""
}


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
    category_slug: Optional[str] = None  # For category-specific context


class ChatResponse(BaseModel):
    """Chat response from AI"""
    response: str
    albums_to_add: list[Album] = []
    albums_to_remove: list[Album] = []
    albums_to_showcase: list[Album] = []


def build_system_prompt(collection: list[Album], category_slug: Optional[str] = None) -> str:
    """Build system prompt with collection context and optional category customization"""

    collection_list = ""
    if collection:
        collection_list = "\n".join([f"- {a.artist} - {a.album}" for a in collection])
    else:
        collection_list = "(empty)"

    # Get category-specific prompt if available
    category_prompt = CATEGORY_AI_PROMPTS.get(category_slug, CATEGORY_AI_PROMPTS.get("vinyl", ""))

    if category_slug and category_slug != "vinyl" and category_slug in CATEGORY_AI_PROMPTS:
        # For non-vinyl categories, use the category-specific prompt
        base_prompt = category_prompt
    else:
        # Default vinyl prompt
        base_prompt = """You are a helpful vinyl record collection assistant. You help users manage their vinyl collection."""

    return f"""{base_prompt}

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
7. NEVER output your thinking process, reasoning, or internal analysis to the user
8. NEVER say things like "The user asks...", "The user wants...", "So we need to...", "Let's list them..."
9. Just respond directly with the answer - no meta-commentary about what you're doing

IMPORTANT: Your response should be friendly and natural. The action tags will be processed automatically. Do NOT explain your reasoning or show your thought process - just give the answer directly."""


def parse_actions(response: str) -> tuple[list[Album], list[Album], list[Album]]:
    """Parse action tags from AI response"""
    albums_to_add = []
    albums_to_remove = []
    albums_to_showcase = []

    # Pattern: {ADD:Artist|Album} or {{ADD:Artist|Album}}
    # Use single pattern that handles both (1-2 braces)
    patterns = [
        (r'\{+ADD:([^|]+)\|([^}]+)\}+', albums_to_add),
        (r'\{+REMOVE:([^|]+)\|([^}]+)\}+', albums_to_remove),
        (r'\{+SHOWCASE:([^|]+)\|([^}]+)\}+', albums_to_showcase),
    ]

    # Track seen items to avoid duplicates
    seen = set()

    for pattern, target_list in patterns:
        for match in re.finditer(pattern, response, re.IGNORECASE):
            artist = match.group(1).strip()
            album = match.group(2).strip()

            # Create unique key for deduplication
            key = f"{artist.lower()}|{album.lower()}"

            # Validate: must have meaningful content and not a duplicate
            if artist and album and len(artist) > 1 and len(album) > 1 and key not in seen:
                # Skip if it looks like template/placeholder
                if artist.lower() not in ['artist', 'artist name'] and album.lower() not in ['album', 'album title']:
                    target_list.append(Album(artist=artist, album=album))
                    seen.add(key)

    return albums_to_add, albums_to_remove, albums_to_showcase


def clean_response(response: str) -> str:
    """
    Clean the model response for display to user.
    Removes thinking blocks, chain-of-thought reasoning, and action tags.
    """
    cleaned = response

    # Remove <think>...</think> blocks (Thinker model reasoning)
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<thinking>[\s\S]*?</thinking>', '', cleaned, flags=re.IGNORECASE)

    # Check if response STARTS with reasoning (polluted from the beginning)
    # If so, try to extract any usable content or provide fallback
    polluted_starts = [
        r'^\.?\s*According to',
        r'^\.?\s*The user',
        r'^\.?\s*We have a user',
        r'^\.?\s*We need',
        r'^\.?\s*We should',
        r'^\.?\s*We can',
        r'^\.?\s*We must',
        r'^\.?\s*We have',
        r'^\.?\s*Should be',
        r'^\.?\s*No action',
        r'^\.?\s*Let\'s',
        r'^\.?\s*Let me',
        r'^\.?\s*First,',
        r'^\.?\s*So,?\s+we',
        r'^\.?\s*So,?\s+the',
        r'^\.?\s*The collection',
        r'^\.?\s*This is a',
        r'^\.?\s*I need to',
        r'^\.?\s*I should',
        r'^\.?\s*Looking at',
        r'^\.?\s*Based on the rules',
        r'^\.?\s*Since the',
        r'^\.?\s*Given that',
        r'^\.?\s*Now,',
        r'^\.?\s*Okay,',
        r'^\.?\s*Alright,',
    ]

    is_polluted = any(re.match(p, cleaned.strip(), re.IGNORECASE) for p in polluted_starts)

    if is_polluted:
        # Try to extract useful content from the polluted response
        # Look for album recommendations in various formats
        extraction_patterns = [
            # 'Album Name' by Artist
            r"'([^']+)'\s+by\s+([A-Za-z][A-Za-z\s]+?)(?:\.|,|\"|'|$)",
            # "Album Name" by Artist
            r'"([^"]+)"\s+by\s+([A-Za-z][A-Za-z\s]+?)(?:\.|,|\"|\'|$)',
            # Artist - Album pattern
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+-\s+([A-Z][^,\.\n]+)",
            # How about X?
            r"How about ['\"]?([^'\"?]+)['\"]?\?",
            # Consider X
            r"Consider ['\"]?([^'\"\.]+)['\"]?",
            # try X
            r"[Yy]ou might like ['\"]?([^'\"\.]+)['\"]?",
        ]

        for i, pattern in enumerate(extraction_patterns):
            match = re.search(pattern, cleaned)
            if match:
                groups = match.groups()
                if len(groups) >= 2:
                    # Patterns 0-1: 'Album' by Artist (album first)
                    # Pattern 2: Artist - Album (artist first)
                    if i == 2:
                        # Artist - Album pattern
                        artist, album = groups[0].strip(), groups[1].strip()
                    else:
                        album, artist = groups[0].strip(), groups[1].strip()

                    # Clean up any trailing punctuation or parentheses
                    album = re.sub(r'\s*\([^)]*$', '', album).strip()

                    if len(album) > 2 and len(artist) > 2:
                        cleaned = f"How about '{album}' by {artist}? Great addition to your collection!"
                        break
                elif len(groups) == 1 and len(groups[0]) > 5:
                    extracted = groups[0].strip()
                    cleaned = f"You might enjoy {extracted}!"
                    break
        else:
            # No extractable content, return context-aware fallback
            return "I'd love to help with a recommendation! Could you tell me what genres or artists you're into?"

    # AGGRESSIVE: Truncate from the start of obvious reasoning blocks
    reasoning_start_markers = [
        r'[\.\s]+According to rules',
        r'[\.\s]+The user asks',
        r'[\.\s]+The user wants',
        r'[\.\s]+The user has',
        r'[\.\s]+The user didn\'t',
        r'[\.\s]+We need to',
        r'[\.\s]+We should',
        r'[\.\s]+We can say',
        r'[\.\s]+We can respond',
        r'[\.\s]+We can answer',
        r'[\.\s]+We must',
        r'[\.\s]+Should be',
        r'[\.\s]+No action tags',
        r'[\.\s]+So we',
        r'[\.\s]+The question',
        r'[\.\s]+Let\'s think',
        r'[\.\s]+Let me think',
        r'[\.\s]+Must be',
        r'[\.\s]+But we need',
        r'[\.\s]+The collection',
        r'[\.\s]+Or we could',
        r'[\.\s]+Or \"',
        r'\n\nWe need',
        r'\n\nWe should',
        r'\n\nThe user',
    ]

    for marker in reasoning_start_markers:
        match = re.search(marker, cleaned, re.IGNORECASE)
        if match:
            cleaned = cleaned[:match.start()]

    # Remove any remaining inline reasoning fragments
    inline_reasoning = [
        r'\. According to rules[^\.]*\.',
        r'\. The user asks[^\.]*\.',
        r'\. We need to[^\.]*\.',
        r'\. No action tags[^\.]*\.',
        r'\. Should be[^\.]*\.',
    ]

    for pattern in inline_reasoning:
        cleaned = re.sub(pattern, '.', cleaned, flags=re.IGNORECASE)

    # Remove bullet lists of albums that look like internal analysis
    # (e.g., "- Pink Floyd - Dark Side of the Moon (Progressive Rock)")
    lines = cleaned.split('\n')
    filtered_lines = []
    consecutive_list_items = 0
    temp_list_items = []

    for line in lines:
        stripped = line.strip()
        # Check if this looks like internal album listing with genre analysis
        is_analysis_list = (
            re.match(r'^-\s+[A-Za-z].*-.*\(.*\)', stripped) or  # Album with (Genre)
            re.match(r'^-\s+[A-Za-z].*-.*\?', stripped)  # Album with question
        )
        if is_analysis_list:
            consecutive_list_items += 1
            temp_list_items.append(line)
        else:
            # If we had fewer than 3 analysis-style items, keep them
            if consecutive_list_items < 3:
                filtered_lines.extend(temp_list_items)
            consecutive_list_items = 0
            temp_list_items = []
            filtered_lines.append(line)

    if consecutive_list_items < 3:
        filtered_lines.extend(temp_list_items)

    cleaned = '\n'.join(filtered_lines)

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
                except (ValueError, TypeError):
                    print(f"[Discogs] Could not parse year: {best_result.get('year')}")

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


async def search_pokemon_tcg(card_set: str, card_name: str) -> Album:
    """
    Search Pokemon TCG API for card info.
    API is free, no auth required.
    """
    query = f"{card_set} {card_name}".strip()
    print(f"[Pokemon TCG] Searching for: {query}")

    try:
        # Pokemon TCG API - search by name
        encoded_name = quote_plus(card_name)
        url = f"https://api.pokemontcg.io/v2/cards?q=name:{encoded_name}&pageSize=10"
        print(f"[Pokemon TCG] URL: {url}")

        headers = to_js({
            "Content-Type": "application/json",
            "User-Agent": "NicheCollectorConnector/1.0",
            "Accept": "application/json"
        })

        response = await js.fetch(url, to_js({"headers": headers}))
        print(f"[Pokemon TCG] Response status: {response.status}")

        if response.status != 200:
            print(f"[Pokemon TCG] Error: {response.status}")
            return Album(artist=card_set, album=card_name)

        data = (await response.json()).to_py()
        cards = data.get("data", [])

        if not cards:
            print(f"[Pokemon TCG] No results for: {query}")
            return Album(artist=card_set, album=card_name)

        # Find best match - prefer matching set name
        best_card = None
        best_score = -1

        for card in cards:
            score = 0
            # Check name match
            if card_name.lower() in card.get("name", "").lower():
                score += 10
            # Check set match
            set_name = card.get("set", {}).get("name", "").lower()
            if card_set.lower() in set_name:
                score += 10
            # Prefer cards with images
            if card.get("images", {}).get("large"):
                score += 5
            # Prefer holos/rare cards
            if "holo" in card.get("rarity", "").lower():
                score += 3

            if score > best_score:
                best_score = score
                best_card = card

        if best_card:
            images = best_card.get("images", {})
            cover = images.get("large") or images.get("small")
            set_info = best_card.get("set", {})
            year = None
            if set_info.get("releaseDate"):
                try:
                    year = int(set_info["releaseDate"][:4])
                except (ValueError, TypeError):
                    pass

            print(f"[Pokemon TCG] Found: {best_card.get('name')} from {set_info.get('name')}")

            return Album(
                artist=set_info.get("name", card_set),
                album=best_card.get("name", card_name),
                cover=cover,
                year=year
            )

        return Album(artist=card_set, album=card_name)

    except Exception as e:
        print(f"[Pokemon TCG] Error: {e}")
        return Album(artist=card_set, album=card_name)


async def search_scryfall(card_set: str, card_name: str) -> Album:
    """
    Search Scryfall API for MTG card info.
    API is free, no auth required.
    """
    query = f"{card_name}"
    print(f"[Scryfall] Searching for: {query}")

    try:
        # Scryfall fuzzy search - use Python's quote_plus for URL encoding
        encoded_name = quote_plus(card_name)
        url = f"https://api.scryfall.com/cards/named?fuzzy={encoded_name}"
        print(f"[Scryfall] URL: {url}")

        # Scryfall requires a User-Agent that identifies the app
        headers = to_js({
            "Content-Type": "application/json",
            "User-Agent": "NicheCollectorConnector/1.0",
            "Accept": "application/json"
        })

        response = await js.fetch(url, to_js({"headers": headers}))

        print(f"[Scryfall] Response status: {response.status}")

        if response.status == 404:
            # Try search endpoint instead
            url = f"https://api.scryfall.com/cards/search?q={encoded_name}&unique=cards"
            print(f"[Scryfall] Trying search URL: {url}")
            response = await js.fetch(url, to_js({"headers": headers}))
            print(f"[Scryfall] Search response status: {response.status}")

        if response.status != 200:
            print(f"[Scryfall] Error: {response.status}")
            return Album(artist=card_set, album=card_name)

        data = (await response.json()).to_py()
        print(f"[Scryfall] Got data keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")

        # Handle search results vs single card
        if "data" in data:
            cards = data["data"]
            card = cards[0] if cards else None
        else:
            card = data

        if not card:
            print(f"[Scryfall] No results for: {query}")
            return Album(artist=card_set, album=card_name)

        print(f"[Scryfall] Card keys: {list(card.keys()) if isinstance(card, dict) else 'not a dict'}")

        # Get best image
        images = card.get("image_uris", {})
        print(f"[Scryfall] Image URIs: {images}")
        cover = images.get("large") or images.get("normal") or images.get("small")

        # If double-faced card, get front face
        if not cover and card.get("card_faces"):
            print(f"[Scryfall] Checking card_faces for images")
            face_images = card["card_faces"][0].get("image_uris", {})
            cover = face_images.get("large") or face_images.get("normal")

        year = None
        if card.get("released_at"):
            try:
                year = int(card["released_at"][:4])
            except (ValueError, TypeError):
                pass

        set_name = card.get("set_name", card_set)
        print(f"[Scryfall] Found: {card.get('name')} from {set_name}, cover: {cover[:50] if cover else 'None'}...")

        return Album(
            artist=set_name,
            album=card.get("name", card_name),
            cover=cover,
            year=year
        )

    except Exception as e:
        print(f"[Scryfall] Error: {e}")
        return Album(artist=card_set, album=card_name)


async def search_rawg(platform: str, game_title: str, api_key: str = "") -> Album:
    """
    Search RAWG.io API for video game info.
    Requires API key (free to get at rawg.io/apidocs).
    """
    if not api_key:
        # RAWG now requires an API key - return without enrichment
        print(f"[RAWG] No API key configured, skipping lookup for: {game_title}")
        return Album(artist=platform, album=game_title)

    query = f"{game_title}"
    print(f"[RAWG] Searching for: {query}")

    try:
        # RAWG search with API key
        encoded_title = quote_plus(game_title)
        url = f"https://api.rawg.io/api/games?key={api_key}&search={encoded_title}&page_size=10"

        response = await js.fetch(url, to_js({
            "headers": to_js({"Content-Type": "application/json"})
        }))

        if response.status != 200:
            print(f"[RAWG] Error: {response.status}")
            return Album(artist=platform, album=game_title)

        data = (await response.json()).to_py()
        games = data.get("results", [])

        if not games:
            print(f"[RAWG] No results for: {query}")
            return Album(artist=platform, album=game_title)

        # Find best match - prefer matching platform
        best_game = None
        best_score = -1

        for game in games:
            score = 0
            # Check name match
            if game_title.lower() in game.get("name", "").lower():
                score += 10
            # Check platform match
            platforms = [p.get("platform", {}).get("name", "").lower() for p in game.get("platforms", [])]
            platform_lower = platform.lower()
            for p in platforms:
                if platform_lower in p or p in platform_lower:
                    score += 10
                    break
            # Prefer games with images
            if game.get("background_image"):
                score += 5
            # Prefer higher rated
            if game.get("rating", 0) > 4:
                score += 3

            if score > best_score:
                best_score = score
                best_game = game

        if best_game:
            cover = best_game.get("background_image")
            year = None
            if best_game.get("released"):
                try:
                    year = int(best_game["released"][:4])
                except (ValueError, TypeError):
                    pass

            # Get platform name from game data
            platforms = best_game.get("platforms", [])
            platform_name = platform
            for p in platforms:
                pname = p.get("platform", {}).get("name", "")
                if platform.lower() in pname.lower():
                    platform_name = pname
                    break

            print(f"[RAWG] Found: {best_game.get('name')} ({year})")

            return Album(
                artist=platform_name,
                album=best_game.get("name", game_title),
                cover=cover,
                year=year
            )

        return Album(artist=platform, album=game_title)

    except Exception as e:
        print(f"[RAWG] Error: {e}")
        return Album(artist=platform, album=game_title)


async def search_for_item(
    field1: str,
    field2: str,
    category_slug: str,
    discogs_key: str = "",
    discogs_secret: str = ""
) -> Album:
    """
    Route to appropriate search API based on category.
    field1/field2 meaning varies by category:
    - vinyl: artist/album
    - trading-cards: set/card name
    - cars: year/make model
    - sneakers: brand/model
    - watches: brand/model
    - comics: publisher/series issue
    - video-games: platform/title
    - coins: country/denomination
    """
    print(f"[Search] Category: {category_slug}, Field1: {field1}, Field2: {field2}")

    if category_slug == "vinyl":
        return await search_discogs_for_album(field1, field2, discogs_key, discogs_secret)

    elif category_slug == "trading-cards":
        # Detect card type based on keywords
        query_lower = f"{field1} {field2}".lower()

        pokemon_keywords = ["pokemon", "pikachu", "charizard", "bulbasaur", "squirtle", "base set",
                          "jungle", "fossil", "neo", "ex", "gx", "vmax", "v star", "scarlet", "violet"]
        mtg_keywords = ["magic", "mtg", "black lotus", "mox", "dual land", "alpha", "beta",
                       "unlimited", "mana", "planeswalker", "commander"]
        yugioh_keywords = ["yugioh", "yu-gi-oh", "yu gi oh", "dark magician", "blue eyes",
                          "exodia", "duel monsters"]
        sports_keywords = ["topps", "panini", "upper deck", "bowman", "prizm", "donruss",
                          "nba", "nfl", "mlb", "nhl", "rookie", "autograph", "jersey"]

        is_pokemon = any(kw in query_lower for kw in pokemon_keywords)
        is_mtg = any(kw in query_lower for kw in mtg_keywords)
        is_yugioh = any(kw in query_lower for kw in yugioh_keywords)
        is_sports = any(kw in query_lower for kw in sports_keywords)

        if is_pokemon:
            # Pokemon cards - only use Pokemon TCG API, no Scryfall fallback
            return await search_pokemon_tcg(field1, field2)
        elif is_mtg:
            return await search_scryfall(field1, field2)
        elif is_yugioh or is_sports:
            # No free API for Yu-Gi-Oh or sports cards - user needs to add photo
            print(f"[Search] No API for {'Yu-Gi-Oh' if is_yugioh else 'sports'} cards")
            return Album(artist=field1, album=field2)
        else:
            # Unknown card type - try Pokemon first (no MTG fallback to avoid mixing results)
            result = await search_pokemon_tcg(field1, field2)
            if not result.cover:
                # If Pokemon didn't find it, try Scryfall for MTG
                # But check first if it looks like a real MTG card name
                mtg_card_patterns = ["dragon", "wizard", "knight", "elemental", "zombie", "goblin", "angel", "demon"]
                if any(p in field2.lower() for p in mtg_card_patterns):
                    result = await search_scryfall(field1, field2)
            return result

    elif category_slug == "video-games":
        return await search_rawg(field1, field2)

    # Categories without free APIs - return without enrichment
    # User can add their own image later
    else:
        print(f"[Search] No API available for {category_slug}, returning without enrichment")
        return Album(artist=field1, album=field2)


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
        {"role": "system", "content": build_system_prompt(body.collection, body.category_slug)}
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

        # Enrich albums with category-specific API
        category = body.category_slug or "vinyl"
        enriched_add = []
        items_without_images = []

        for album in albums_to_add:
            print(f"[Chat] Enriching: {album.artist} - {album.album}")
            enriched = await search_for_item(
                album.artist,
                album.album,
                category,
                env.DISCOGS_KEY,
                env.DISCOGS_SECRET
            )
            enriched_add.append(enriched)
            if not enriched.cover:
                items_without_images.append(f"{enriched.artist} - {enriched.album}")

        # Enrich showcase albums too
        enriched_showcase = []
        for album in albums_to_showcase:
            enriched = await search_for_item(
                album.artist,
                album.album,
                category,
                env.DISCOGS_KEY,
                env.DISCOGS_SECRET
            )
            enriched_showcase.append(enriched)
            if not enriched.cover:
                items_without_images.append(f"{enriched.artist} - {enriched.album}")

        # Clean response for display
        cleaned_response = clean_response(raw_response)

        # Add note if some items couldn't find images
        if items_without_images:
            # Customize message based on category
            category_item_names = {
                "vinyl": "album",
                "trading-cards": "card",
                "cars": "vehicle",
                "sneakers": "sneaker",
                "watches": "watch",
                "comics": "comic",
                "video-games": "game",
                "coins": "coin"
            }
            item_name = category_item_names.get(category, "item")

            if len(items_without_images) == 1:
                cleaned_response += f"\n\n📷 I couldn't find an image for {items_without_images[0]}. You can add your own photo in the collection edit view."
            else:
                cleaned_response += f"\n\n📷 I couldn't find images for some {item_name}s. You can add your own photos in the collection edit view."

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
