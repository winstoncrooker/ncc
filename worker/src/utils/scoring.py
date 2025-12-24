"""
Shared scoring utilities for posts and comments
"""

import math
from datetime import datetime

# Epoch for hot score calculation (Jan 1, 2024)
EPOCH = datetime(2024, 1, 1).timestamp()


def calculate_hot_score(upvotes: int, downvotes: int, created_at: str | float) -> float:
    """
    Calculate hot score with stronger vote weighting.
    Higher upvotes = more visibility, with some time decay.

    Args:
        upvotes: Number of upvotes
        downvotes: Number of downvotes
        created_at: Creation timestamp (ISO string or Unix timestamp)

    Returns:
        Hot score as float (rounded to 7 decimal places)
    """
    score = upvotes - downvotes
    # Multiply vote component by 2 for stronger vote influence
    order = math.log10(max(abs(score), 1)) * 2
    sign = 1 if score > 0 else -1 if score < 0 else 0

    try:
        if isinstance(created_at, str):
            # Handle ISO format datetime strings
            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            seconds = dt.timestamp() - EPOCH
        else:
            seconds = created_at - EPOCH
    except Exception:
        seconds = 0

    # Increased divisor (180000 = ~50 hours) so time matters less than votes
    return round(sign * order + seconds / 180000, 7)
