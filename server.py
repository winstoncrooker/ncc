#!/usr/bin/env python3
"""
Vinyl Vault Backend Server
- Serves static files
- Proxies and caches Discogs API requests
- Stores album images and data locally
"""

import os
import json
import hashlib
import requests
import time
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from urllib.parse import quote

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=SCRIPT_DIR)
CORS(app)

# Configuration
DISCOGS_KEY = 'yRxzvHyveKiFOEHuwmcW'
DISCOGS_SECRET = 'GnnPcnLGovdJLMfMyEpaSRoXOsRqojBr'
DISCOGS_API = 'https://api.discogs.com'

# Cache directories
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')
IMAGES_DIR = os.path.join(CACHE_DIR, 'images')
DATA_DIR = os.path.join(CACHE_DIR, 'data')

# Ensure cache directories exist
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# Rate limiting
last_discogs_request = 0
RATE_LIMIT_MS = 1100  # 1.1 seconds between requests

def wait_for_rate_limit():
    global last_discogs_request
    now = time.time() * 1000
    time_since_last = now - last_discogs_request
    if time_since_last < RATE_LIMIT_MS:
        time.sleep((RATE_LIMIT_MS - time_since_last) / 1000)
    last_discogs_request = time.time() * 1000

def get_cache_key(artist, album):
    """Generate a consistent cache key for an album"""
    key = f"{artist.lower().strip()}_{album.lower().strip()}"
    return hashlib.md5(key.encode()).hexdigest()

def get_cached_data(cache_key):
    """Get cached album data if it exists"""
    data_file = os.path.join(DATA_DIR, f"{cache_key}.json")
    if os.path.exists(data_file):
        with open(data_file, 'r') as f:
            return json.load(f)
    return None

def save_cached_data(cache_key, data):
    """Save album data to cache"""
    data_file = os.path.join(DATA_DIR, f"{cache_key}.json")
    with open(data_file, 'w') as f:
        json.dump(data, f)

def download_and_cache_image(url, cache_key):
    """Download an image and cache it locally"""
    if not url:
        return None

    # Determine file extension
    ext = 'jpg'
    if '.png' in url.lower():
        ext = 'png'
    elif '.gif' in url.lower():
        ext = 'gif'

    image_file = os.path.join(IMAGES_DIR, f"{cache_key}.{ext}")

    # Return cached image path if exists
    if os.path.exists(image_file):
        return f"/cache/images/{cache_key}.{ext}"

    # Download image
    try:
        response = requests.get(url, headers={'User-Agent': 'VinylVault/1.0'}, timeout=10)
        if response.status_code == 200:
            with open(image_file, 'wb') as f:
                f.write(response.content)
            return f"/cache/images/{cache_key}.{ext}"
    except Exception as e:
        print(f"Error downloading image: {e}")

    return None

# ============================================
# API Routes
# ============================================

@app.route('/api/discogs/search', methods=['GET'])
def search_discogs():
    """Search Discogs for an album and cache results"""
    artist = request.args.get('artist', '')
    album = request.args.get('album', '')

    if not artist or not album:
        return jsonify({'error': 'Artist and album required'}), 400

    cache_key = get_cache_key(artist, album)

    # Check cache first
    cached = get_cached_data(cache_key)
    if cached:
        print(f"[Cache HIT] {artist} - {album}")
        return jsonify(cached)

    print(f"[Cache MISS] {artist} - {album} - Fetching from Discogs...")

    # Rate limit
    wait_for_rate_limit()

    # Search Discogs
    query = quote(f"{artist} {album}")
    url = f"{DISCOGS_API}/database/search?q={query}&type=release&key={DISCOGS_KEY}&secret={DISCOGS_SECRET}"

    try:
        response = requests.get(url, headers={'User-Agent': 'VinylVault/1.0'}, timeout=10)

        if response.status_code != 200:
            return jsonify({'error': f'Discogs API error: {response.status_code}'}), response.status_code

        data = response.json()

        if not data.get('results'):
            return jsonify({'error': 'No results found'}), 404

        # Find best match
        results = data['results']
        best_match = None
        for r in results:
            title_lower = r.get('title', '').lower()
            if artist.lower() in title_lower and album.lower() in title_lower:
                best_match = r
                break

        if not best_match:
            best_match = results[0]

        # Get price data
        price = None
        release_id = best_match.get('id')
        if release_id:
            price = get_release_price(release_id)

        # Download and cache cover image
        cover_url = best_match.get('cover_image') or best_match.get('thumb')
        local_cover = download_and_cache_image(cover_url, cache_key)

        # Build response
        result = {
            'id': release_id,
            'title': best_match.get('title'),
            'year': best_match.get('year'),
            'cover': local_cover or cover_url,
            'cover_original': cover_url,
            'price': price,
            'cached': True
        }

        # Save to cache
        save_cached_data(cache_key, result)

        return jsonify(result)

    except Exception as e:
        print(f"Error searching Discogs: {e}")
        return jsonify({'error': str(e)}), 500

def get_release_price(release_id):
    """Get price for a release from Discogs"""
    wait_for_rate_limit()

    # Try price suggestions first
    url = f"{DISCOGS_API}/marketplace/price_suggestions/{release_id}?key={DISCOGS_KEY}&secret={DISCOGS_SECRET}"

    try:
        response = requests.get(url, headers={'User-Agent': 'VinylVault/1.0'}, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get('Very Good Plus (VG+)'):
                return data['Very Good Plus (VG+)']['value']
            elif data.get('Very Good (VG)'):
                return data['Very Good (VG)']['value']

        # Fallback: get lowest price from release
        wait_for_rate_limit()
        url = f"{DISCOGS_API}/releases/{release_id}?key={DISCOGS_KEY}&secret={DISCOGS_SECRET}"
        response = requests.get(url, headers={'User-Agent': 'VinylVault/1.0'}, timeout=10)

        if response.status_code == 200:
            data = response.json()
            return data.get('lowest_price')

    except Exception as e:
        print(f"Error getting price: {e}")

    return None

@app.route('/api/discogs/price/<int:release_id>', methods=['GET'])
def get_price(release_id):
    """Get price for a specific release"""
    price = get_release_price(release_id)
    return jsonify({'price': price})

# ============================================
# Static File Routes
# ============================================

@app.route('/cache/images/<filename>')
def serve_cached_image(filename):
    """Serve cached images"""
    return send_from_directory(IMAGES_DIR, filename)

@app.route('/')
def serve_index():
    """Serve index.html"""
    return send_from_directory(SCRIPT_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory(SCRIPT_DIR, filename)

# ============================================
# Cache Management
# ============================================

@app.route('/api/cache/stats', methods=['GET'])
def cache_stats():
    """Get cache statistics"""
    data_files = os.listdir(DATA_DIR)
    image_files = os.listdir(IMAGES_DIR)

    total_image_size = sum(
        os.path.getsize(os.path.join(IMAGES_DIR, f))
        for f in image_files
    )

    return jsonify({
        'cached_albums': len(data_files),
        'cached_images': len(image_files),
        'total_image_size_mb': round(total_image_size / (1024 * 1024), 2)
    })

@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Clear all cached data"""
    import shutil
    shutil.rmtree(DATA_DIR, ignore_errors=True)
    shutil.rmtree(IMAGES_DIR, ignore_errors=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    return jsonify({'status': 'Cache cleared'})

# ============================================
# Main
# ============================================

if __name__ == '__main__':
    print("=" * 50)
    print("Vinyl Vault Server")
    print("=" * 50)
    print(f"Cache directory: {CACHE_DIR}")
    print(f"Starting server on http://localhost:5001")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5001, debug=True)
