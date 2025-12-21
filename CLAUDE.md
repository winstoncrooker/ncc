# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vinyl Vault is a static vinyl record collection website. It displays Winston's record collection with browsing by genre, album details, collection statistics, and a user collection upload feature.

## Architecture

**No build system** - This is a pure vanilla HTML/CSS/JavaScript project. Open any HTML file directly in a browser to view.

### Core Files

- `record.js` - Central data store containing all album records as a `records` array. Each record has: `id`, `artist`, `album`, `genre`, `cover` (URL), `tracks` (array), `fun` (fun fact string), `price` (number or null)
- `utils.js` - Shared utility functions (`getRecordById`, `getRecordsByGenre`, `formatPrice`) exposed on `window`
- `style.css` - Global styles, navigation, card/vinyl components, responsive breakpoints at 800px

### Pages

- `index.html` - Homepage with dual carousel of album covers and favorites grid
- `genre.html` - Genre listing page with search, sort, and price filtering. Uses `?genre=` query param
- `album.html` - Individual album detail page. Uses `?id=` and `?genre=` query params
- `stats.html` - Collection statistics: totals, genre breakdown, value distribution, top 10, comparison tool
- `mycollection.html` - User collection upload feature (accepts .txt files in "Artist - Album" format)

### Data Flow

All pages load `record.js` which populates `window.records`. Pages then use utility functions or inline code to filter/sort/display records. No frameworks or state management - pure DOM manipulation.

### Genres

rock, blues, metal, pop, jazz, soul, funk, country, hiphop, folk, classical, experimental, comedy

## Development

Open HTML files directly in browser. No server required for basic viewing.

For live development with auto-reload, use any static server:
```bash
npx serve .
# or
python -m http.server 8000
```

## Adding New Records

Add entries to the `records` array in `record.js`:
```javascript
{
  id: "artist-album-slug",  // lowercase, hyphen-separated
  artist: "Artist Name",
  album: "Album Name",
  genre: "rock",            // must match existing genre
  cover: "https://...",     // album art URL
  tracks: ["Track 1", "Track 2"],
  fun: "Fun fact about the album",
  price: 25.00              // or null if unknown
}
```

## Styling Conventions

- Primary accent color: `#1db954` (Spotify green)
- Background: `#0e0e0e`, cards: `#1a1a1a`
- Fonts: Orbitron (headings), Montserrat (body)
- Mobile breakpoint: 800px
