"""
Scryfall API service for Magic: The Gathering card search and enrichment
API is free, no auth required.
"""

import js
from pyodide.ffi import to_js
from urllib.parse import quote_plus
from typing import Optional
from pydantic import BaseModel


class Album(BaseModel):
    """Item in user's collection (using Album for compatibility)"""
    artist: str
    album: str
    cover: Optional[str] = None
    year: Optional[int] = None
    discogs_id: Optional[int] = None


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

    except Exception as error:
        print(f"[Scryfall] Error: {error}")
        return Album(artist=card_set, album=card_name)
