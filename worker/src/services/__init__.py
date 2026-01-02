# Services
# External API integrations for collection enrichment

from .discogs import search_discogs_for_album, Album
from .pokemon_tcg import search_pokemon_tcg
from .scryfall import search_scryfall
from .rawg import search_rawg
from .email import send_notification_email, NotificationType

__all__ = [
    "search_discogs_for_album",
    "search_pokemon_tcg",
    "search_scryfall",
    "search_rawg",
    "send_notification_email",
    "NotificationType",
    "Album",
]
