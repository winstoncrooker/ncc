/**
 * Shared utility functions
 * Extracted to avoid DRY violations across modules
 */

const Utils = {
  /**
   * Sanitize image URL - validates protocol to prevent XSS via javascript: URLs
   * @param {string} url - The URL to sanitize
   * @param {string} fallback - Fallback URL if invalid
   * @returns {string} Sanitized URL or fallback
   */
  sanitizeImageUrl(url, fallback = '') {
    if (!url || typeof url !== 'string') return fallback;

    const trimmed = url.trim().toLowerCase();

    // Allow relative URLs
    if (url.startsWith('/')) return url;

    // Allow data URLs for images only
    if (trimmed.startsWith('data:image/')) return url;

    // Allow http/https URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return url;
    }

    // Reject everything else (javascript:, vbscript:, etc.)
    return fallback;
  },

  /**
   * Format timestamp to human-readable format
   * @param {string} timestamp - ISO timestamp or date string
   * @returns {string} Formatted time string
   */
  formatTime(timestamp) {
    if (!timestamp) return '';

    let ts = timestamp;
    // Handle timestamps without timezone - assume UTC
    if (ts && !ts.endsWith('Z') && !ts.includes('+') && !ts.includes('-', 10)) {
      ts += 'Z';
    }

    const date = new Date(ts);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  },

  /**
   * Generate default avatar SVG data URL
   * @param {string} name - Name to get initial from
   * @returns {string} Data URL for SVG avatar
   */
  getDefaultAvatar(name) {
    const initial = (name || 'U').charAt(0).toUpperCase();
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231db954" width="100" height="100"/><text x="50" y="55" text-anchor="middle" dominant-baseline="middle" font-size="40" font-family="Arial,sans-serif" fill="white">${initial}</text></svg>`)}`;
  },

  /**
   * Escape HTML entities to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Normalize cover URL - prepend API base if needed
   * @param {string} url - Cover URL
   * @returns {string} Normalized URL
   */
  normalizeCoverUrl(url) {
    if (!url) return '';
    if (url.startsWith('/api/')) {
      return (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE : '') + url;
    }
    return url;
  }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
