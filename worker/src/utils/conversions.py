"""
Shared conversion utilities for D1/Cloudflare Workers
Handles JsProxy, JsNull, and other JavaScript-Python type conversions
"""


def to_python_value(value, default=None):
    """
    Convert JavaScript types (JsNull, JsUndefined, JsProxy) to Python equivalents.

    Args:
        value: The value to convert
        default: Default value to return if value is null/undefined

    Returns:
        Python equivalent of the value, or default if null/undefined
    """
    if value is None:
        return default

    # Check for JS null/undefined types by checking the type name
    type_name = str(type(value))
    if 'JsNull' in type_name or 'JsUndefined' in type_name:
        return default

    # Check for JsProxy and convert if needed
    if 'JsProxy' in type_name and hasattr(value, 'to_py'):
        return value.to_py()

    return value


def convert_row(row):
    """
    Convert a single D1 result row from JsProxy to Python dict.

    Args:
        row: A D1 result row (may be JsProxy or dict)

    Returns:
        Python dict
    """
    if row is None:
        return None
    if hasattr(row, 'to_py'):
        return row.to_py()
    return row


def convert_rows(results):
    """
    Convert D1 query results to list of Python dicts.

    Args:
        results: D1 query result object with .results attribute

    Returns:
        List of Python dicts
    """
    if results is None:
        return []

    rows = results.results if hasattr(results, 'results') else results
    return [convert_row(row) for row in rows]


def safe_get(row, key, default=None):
    """
    Safely get a value from a row, handling JS null types.

    Args:
        row: Dictionary-like row object
        key: Key to retrieve
        default: Default value if key is missing or value is null

    Returns:
        The value or default
    """
    if row is None:
        return default
    value = row.get(key) if hasattr(row, 'get') else None
    return to_python_value(value, default)
