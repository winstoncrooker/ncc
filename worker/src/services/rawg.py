"""
RAWG.io API service for video game search and enrichment
Requires API key (free to get at rawg.io/apidocs).
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

    except Exception as error:
        print(f"[RAWG] Error: {error}")
        return Album(artist=platform, album=game_title)
