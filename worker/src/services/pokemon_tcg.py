"""
Pokemon TCG API service for trading card search and enrichment
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

        # Add timeout using AbortController
        controller = js.AbortController.new()
        timeout_id = js.setTimeout(lambda: controller.abort(), 8000)  # 8 second timeout

        try:
            response = await js.fetch(url, to_js({"headers": headers, "signal": controller.signal}))
        finally:
            js.clearTimeout(timeout_id)
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

    except Exception as error:
        print(f"[Pokemon TCG] Error: {error}")
        return Album(artist=card_set, album=card_name)
