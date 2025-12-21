"""
Together.ai Chat API proxy for AI collection assistant
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter()

TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
CHAT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"


class Album(BaseModel):
    """Album in user's collection"""
    artist: str
    album: str


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


def build_system_prompt(collection: list[Album]) -> str:
    """Build system prompt with collection context"""
    collection_context = ""

    if collection:
        collection_context = f"\n\nThe user's vinyl collection currently contains {len(collection)} albums:\n"
        for i, item in enumerate(collection, 1):
            collection_context += f"{i}. {item.artist} - {item.album}\n"
    else:
        collection_context = "\n\nThe user has not uploaded any albums to their collection yet."

    return f"""You are a helpful vinyl record collection assistant for "Vinyl Vault". You help users manage their record collections.

CRITICAL RULES:
- Keep responses SHORT and friendly (1-3 sentences max)
- NEVER guess or assume album/artist names you're unsure about
- If ANY part of a request is unclear, ASK FOR CLARIFICATION before acting

ADDING ALBUMS - ONLY when user explicitly asks to ADD:
- Use [ADD_ALBUM: Artist Name - Album Name] tag ONLY when user says "add", "put in", "include", etc.
- NEVER use ADD_ALBUM when giving recommendations or suggestions
- If user asks "what should I get?" or "recommend something" - just tell them, do NOT add it
- Example request: "Add Nevermind" → [ADD_ALBUM: Nirvana - Nevermind]

REMOVING ALBUMS - ONLY when user explicitly asks to REMOVE:
- Use [REMOVE_ALBUM: Artist Name - Album Name] tag ONLY when user says "remove", "delete", "take out", etc.
- Example: "Remove Abbey Road" → [REMOVE_ALBUM: The Beatles - Abbey Road]

RECOMMENDATIONS:
- When user asks for recommendations, suggestions, or "what should I get" - just TELL them the recommendation
- Do NOT use ADD_ALBUM tag for recommendations
- Example: "What do you recommend?" → "Based on your collection, you might enjoy Led Zeppelin IV!"
- Only add it if they then say "add that" or "yes add it"

WHEN CONFUSED:
- ASK for clarification instead of guessing
- "I'm not sure which album you mean. Could you give me the artist and album name?"

Keep your response concise and natural.{collection_context}"""


def parse_album_actions(response: str) -> tuple[list[Album], list[Album]]:
    """Parse AI response for album add/remove actions"""
    import re

    albums_to_add = []
    albums_to_remove = []

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

    return albums_to_add, albums_to_remove


def clean_response(response: str) -> str:
    """Clean up AI response for display"""
    import re

    cleaned = response
    # Remove thinking tags
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<thinking>[\s\S]*?</thinking>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[think\][\s\S]*?\[/think\]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[thinking\][\s\S]*?\[/thinking\]', '', cleaned, flags=re.IGNORECASE)
    # Remove internal markers
    cleaned = re.sub(r'\[BEGIN FINAL RESPONSE\]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[END FINAL RESPONSE\]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[INTERNAL\][\s\S]*?\[/INTERNAL\]', '', cleaned, flags=re.IGNORECASE)
    # Remove command tags
    cleaned = re.sub(r'\[ADD_ALBUM:\s*.+?\s*-\s*.+?\]', '', cleaned)
    cleaned = re.sub(r'\[REMOVE_ALBUM:\s*.+?\s*-\s*.+?\]', '', cleaned)
    # Clean up whitespace
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
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
        async with httpx.AsyncClient() as client:
            response = await client.post(
                TOGETHER_API_URL,
                headers={
                    "Authorization": f"Bearer {env.TOGETHER_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": CHAT_MODEL,
                    "messages": messages,
                    "max_tokens": 256,
                    "temperature": 0.2
                },
                timeout=30.0
            )

            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get("error", {}).get("message", f"API error: {response.status_code}")
                raise HTTPException(status_code=response.status_code, detail=error_msg)

            data = response.json()
            assistant_message = data["choices"][0]["message"]["content"]

            # Parse actions before cleaning
            albums_to_add, albums_to_remove = parse_album_actions(assistant_message)

            # Clean response for display
            cleaned_response = clean_response(assistant_message)

            return ChatResponse(
                response=cleaned_response,
                albums_to_add=albums_to_add,
                albums_to_remove=albums_to_remove
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Sorry, I had trouble processing that. Please try again."
        )
