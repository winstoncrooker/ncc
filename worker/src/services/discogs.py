"""
Discogs API service for vinyl record search and enrichment
"""

import js
from pyodide.ffi import to_js
from typing import Optional
from pydantic import BaseModel


DISCOGS_API_URL = "https://api.discogs.com/database/search"


class Album(BaseModel):
    """Album/item in user's collection"""
    artist: str
    album: str
    cover: Optional[str] = None
    year: Optional[int] = None
    discogs_id: Optional[int] = None


async def search_discogs_for_album(
    artist: str,
    album: str,
    discogs_key: str,
    discogs_secret: str
) -> Album:
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

    except Exception as error:
        print(f"[Discogs] Error: {error}")
        return Album(artist=artist, album=album)
