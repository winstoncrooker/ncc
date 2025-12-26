"""
Shared utility functions for the Niche Collector Connector API.
"""


def convert_d1_result(result):
    """
    Convert D1 JsProxy result to Python dict if needed.

    Cloudflare D1 returns JsProxy objects that need to be converted
    to Python dicts for proper handling. This utility handles the
    conversion pattern that appears throughout the codebase.

    Args:
        result: D1 query result (JsProxy or dict/None)

    Returns:
        Python dict if conversion was needed, or original value
    """
    if result and hasattr(result, 'to_py'):
        return result.to_py()
    return result


def convert_d1_rows(results):
    """
    Convert a list of D1 JsProxy rows to Python dicts.

    Args:
        results: List of D1 query results

    Returns:
        List of Python dicts
    """
    if not results:
        return []
    return [convert_d1_result(row) for row in results]
