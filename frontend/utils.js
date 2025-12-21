// utils.js
function getRecordById(id) {
  if (!window.records) return null;
  return window.records.find(r => r.id === id);
}

function getRecordsByGenre(genre) {
  if (!window.records) return [];
  return window.records.filter(r => r.genre.toLowerCase() === genre.toLowerCase())
    .sort((a, b) => a.artist.localeCompare(b.artist)); // Sort alphabetically by artist
}

function formatPrice(value) {
  if (value === null || value === undefined) return "N/A";
  return `$${value.toLocaleString()}`;
}

window.getRecordById = getRecordById;
window.getRecordsByGenre = getRecordsByGenre;
window.formatPrice = formatPrice;
