"""
Together.ai Chat API proxy for AI collection assistant
Uses ServiceNow-AI/Apriel-1.6-15b-Thinker model
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from routes.auth import require_auth
import js
from pyodide.ffi import to_js
import re

# Import external API services (SOLID: Single Responsibility)
from services.discogs import search_discogs_for_album, Album
from services.pokemon_tcg import search_pokemon_tcg
from services.scryfall import search_scryfall
from services.rawg import search_rawg

router = APIRouter()

TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
CHAT_MODEL = "ServiceNow-AI/Apriel-1.6-15b-Thinker"

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

ACTIONS: {{ADD:Country Denomination|Year}}, {{REMOVE:Country Denomination|Year}}, {{SHOWCASE:Country Denomination|Year}}
EXPERTISE: US coins, world coins, ancient, grading (PCGS/NGC), bullion.
BIO HELP: Help write bios about their numismatic interests, collecting focus, favorite coins."""
}


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

    # Category-specific terminology and examples
    category_config = {
        "vinyl": {
            "item_name": "albums",
            "field1": "Artist",
            "field2": "Album",
            "examples": [
                ('Add Maggot Brain by Funkadelic', 'I\'ve added that classic! {{ADD:Funkadelic|Maggot Brain}}'),
                ('Remove Dark Side of the Moon', 'Removed from your collection. {{REMOVE:Pink Floyd|Dark Side of the Moon}}'),
            ],
            "rec_question": "what genres or artists you're into"
        },
        "coins": {
            "item_name": "coins",
            "field1": "Country Denomination",
            "field2": "Year",
            "examples": [
                ('Add a 1921 Morgan Dollar', 'Added to your collection! {{ADD:USA Morgan Dollar|1921}}'),
                ('Remove the Walking Liberty half', 'Removed. {{REMOVE:USA Walking Liberty Half Dollar|1942}}'),
            ],
            "rec_question": "what countries, eras, or types of coins interest you"
        },
        "trading-cards": {
            "item_name": "cards",
            "field1": "Set/Brand",
            "field2": "Card Name",
            "examples": [
                ('Add a Base Set Charizard', 'Added to your collection! {{ADD:Pokemon Base Set|Charizard}}'),
                ('Remove the Black Lotus', 'Removed from your collection. {{REMOVE:MTG Alpha|Black Lotus}}'),
            ],
            "rec_question": "what games or sets you collect"
        },
        "cars": {
            "item_name": "vehicles",
            "field1": "Make",
            "field2": "Model/Year",
            "examples": [
                ('Add my 1969 Mustang', 'Added to your garage! {{ADD:Ford|1969 Mustang}}'),
                ('Remove the Supra', 'Removed from your collection. {{REMOVE:Toyota|Supra}}'),
            ],
            "rec_question": "what types of cars interest you (JDM, muscle, classics, etc.)"
        },
        "sneakers": {
            "item_name": "pairs",
            "field1": "Brand",
            "field2": "Model/Colorway",
            "examples": [
                ('Add Jordan 1 Chicago', 'Added to your collection! {{ADD:Nike|Air Jordan 1 Chicago}}'),
                ('Remove the Yeezys', 'Removed from your collection. {{REMOVE:Adidas|Yeezy 350}}'),
            ],
            "rec_question": "what brands or silhouettes you're into"
        },
        "watches": {
            "item_name": "watches",
            "field1": "Brand",
            "field2": "Model",
            "examples": [
                ('Add my Submariner', 'Added to your collection! {{ADD:Rolex|Submariner}}'),
                ('Remove the Speedmaster', 'Removed from your collection. {{REMOVE:Omega|Speedmaster}}'),
            ],
            "rec_question": "what styles or brands interest you"
        },
        "comics": {
            "item_name": "comics",
            "field1": "Publisher/Series",
            "field2": "Issue",
            "examples": [
                ('Add Amazing Spider-Man 300', 'Added to your collection! {{ADD:Marvel Amazing Spider-Man|#300}}'),
                ('Remove Detective Comics 27', 'Removed from your collection. {{REMOVE:DC Detective Comics|#27}}'),
            ],
            "rec_question": "what publishers, characters, or eras you collect"
        },
        "video-games": {
            "item_name": "games",
            "field1": "Platform",
            "field2": "Title",
            "examples": [
                ('Add Zelda Ocarina of Time', 'Added to your collection! {{ADD:N64|The Legend of Zelda: Ocarina of Time}}'),
                ('Remove Mario Kart', 'Removed from your collection. {{REMOVE:Switch|Mario Kart 8}}'),
            ],
            "rec_question": "what platforms or genres you enjoy"
        },
    }

    config = category_config.get(category_slug, category_config["vinyl"])

    if category_slug and category_slug != "vinyl" and category_slug in CATEGORY_AI_PROMPTS:
        base_prompt = category_prompt
    else:
        base_prompt = """You are a helpful vinyl record collection assistant. You help users manage their vinyl collection."""

    examples_text = "\n".join([f'- User: "{ex[0]}" → "{ex[1]}"' for ex in config["examples"]])

    return f"""{base_prompt}

CURRENT COLLECTION ({len(collection)} {config["item_name"]}):
{collection_list}

ACTIONS YOU CAN PERFORM:
When the user asks you to add, remove, or showcase items, include the appropriate action tags in your response.

ADD: {{{{ADD:{config["field1"]}|{config["field2"]}}}}}
REMOVE: {{{{REMOVE:{config["field1"]}|{config["field2"]}}}}}
SHOWCASE: {{{{SHOWCASE:{config["field1"]}|{config["field2"]}}}}}

EXAMPLES:
{examples_text}

RULES:
1. Only use action tags when the user explicitly asks to add, remove, or showcase
2. Add EXACTLY what the user asks for - if they say "add X", add only X. Do NOT add extra variations or suggestions on your own.
3. If user lists multiple items OR uploads a file with a list, add ALL of them with separate action tags.
4. Keep responses concise (1-3 sentences for single items, summary for bulk adds)
5. If user asks to remove an item not in their collection, politely say it's not there
6. For ambiguous add requests (e.g. "add dunks" without specifying colorway), ask for clarification
7. NEVER output your thinking process, reasoning, or internal analysis to the user
8. NEVER say things like "The user asks...", "The user wants...", "So we need to...", "Let's list them..."
9. Just respond directly with the answer - no meta-commentary about what you're doing

CASUAL CONVERSATION:
- If user says hi, hello, hey, etc - greet them back warmly and ask how you can help today
- ANSWER their questions directly! If they ask "what's a good starter X?" - give them actual recommendations with specific names
- If they tell you their preferences (e.g. "I like Nike"), respond to that and offer specific suggestions
- Have natural back-and-forth conversation - don't just repeat the same question
- Share your knowledge! You're an expert - give advice, recommendations, history, tips
- It's okay to chat casually without every response being about managing the collection

IMPORTANT: Your response should be friendly and natural. Be helpful and knowledgeable. The action tags will be processed automatically. Do NOT explain your reasoning or show your thought process - just give the answer directly."""


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
                # Skip if it looks like template/placeholder from any category
                placeholder_field1s = ['artist', 'artist name', 'country denomination', 'set', 'set/brand', 'year', 'brand', 'publisher', 'platform']
                placeholder_field2s = ['album', 'album title', 'year', 'card name', 'make model', 'model colorway', 'model reference', 'series issue', 'title']
                if artist.lower() not in placeholder_field1s and album.lower() not in placeholder_field2s:
                    target_list.append(Album(artist=artist, album=album))
                    seen.add(key)

    return albums_to_add, albums_to_remove, albums_to_showcase


CATEGORY_REC_FALLBACKS = {
    "vinyl": "I'd love to help with a recommendation! Could you tell me what genres or artists you're into?",
    "coins": "I'd love to help! What countries, eras, or types of coins interest you?",
    "trading-cards": "I'd love to help! What games or sets do you collect? (Pokemon, MTG, sports cards, etc.)",
    "cars": "I'd love to help! What types of vehicles interest you? (JDM, muscle cars, classics, etc.)",
    "sneakers": "I'd love to help! What brands or silhouettes are you into?",
    "watches": "I'd love to help! What styles or brands interest you?",
    "comics": "I'd love to help! What publishers, characters, or eras do you collect?",
    "video-games": "I'd love to help! What platforms or types of games do you enjoy?",
}


def clean_response(response: str, category_slug: Optional[str] = None) -> str:
    """
    Clean the model response for display to user.
    Removes thinking blocks, chain-of-thought reasoning, and action tags.
    """
    cleaned = response
    fallback_msg = CATEGORY_REC_FALLBACKS.get(category_slug, CATEGORY_REC_FALLBACKS["vinyl"])

    # Remove <think>...</think> blocks (Thinker model reasoning)
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<thinking>[\s\S]*?</thinking>', '', cleaned, flags=re.IGNORECASE)

    # Check if response STARTS with obvious AI reasoning (not normal conversation)
    # Only catch clear reasoning dumps, not normal conversational starters
    polluted_starts = [
        r'^\.?\s*According to the rules',
        r'^\.?\s*The user asks',
        r'^\.?\s*The user wants',
        r'^\.?\s*The user is asking',
        r'^\.?\s*We have a user',
        r'^\.?\s*We need to check',
        r'^\.?\s*We should check',
        r'^\.?\s*We must follow',
        r'^\.?\s*Should be no action',
        r'^\.?\s*No action tags',
        r'^\.?\s*Let\'s think',
        r'^\.?\s*Let\'s analyze',
        r'^\.?\s*First,\s+I need',
        r'^\.?\s*So,?\s+we need',
        r'^\.?\s*So,?\s+the user',
        r'^\.?\s*The collection contains',
        r'^\.?\s*I need to analyze',
        r'^\.?\s*I should check',
        r'^\.?\s*Looking at the rules',
        r'^\.?\s*Based on the rules',
        r'^\.?\s*Since the user',
        r'^\.?\s*Given that the',
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
            return fallback_msg

    # Truncate from the start of obvious AI reasoning blocks (not normal conversation)
    reasoning_start_markers = [
        r'[\.\s]+According to the rules',
        r'[\.\s]+The user asks for',
        r'[\.\s]+The user wants me to',
        r'[\.\s]+The user is asking',
        r'[\.\s]+We need to check',
        r'[\.\s]+We should check',
        r'[\.\s]+We must follow',
        r'[\.\s]+Should be no action',
        r'[\.\s]+No action tags needed',
        r'[\.\s]+Let\'s think about',
        r'[\.\s]+Let me think about',
        r'[\.\s]+The collection contains',
        r'\n\nWe need to check',
        r'\n\nThe user is asking',
    ]

    for marker in reasoning_start_markers:
        match = re.search(marker, cleaned, re.IGNORECASE)
        if match:
            cleaned = cleaned[:match.start()]

    # Remove any remaining inline reasoning fragments (specific AI reasoning phrases)
    inline_reasoning = [
        r'\. According to the rules[^\.]*\.',
        r'\. The user asks for[^\.]*\.',
        r'\. No action tags needed[^\.]*\.',
        r'\. Should be no action[^\.]*\.',
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
async def chat(request: Request, body: ChatMessage, user_id: int = Depends(require_auth)) -> ChatResponse:
    """
    Send a message to the AI assistant.
    Returns response and any album actions to perform.
    Requires authentication to prevent abuse.
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
        cleaned_response = clean_response(raw_response, category)

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
