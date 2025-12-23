/**
 * Niche Collector Connector Configuration
 * API endpoints and settings
 */

const CONFIG = {
  // API Base URL - auto-detect environment (NO /api suffix - endpoints include it)
  API_BASE: (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8787';  // Local wrangler dev
    }
    // Production Worker URL
    return 'https://vinyl-vault-api.christophercrooker.workers.dev';
  })(),

  // Auth token storage key
  AUTH_TOKEN_KEY: 'ncc_token',
  AUTH_USER_KEY: 'ncc_user',

  // Local storage keys
  COLLECTION_KEY: 'userCollection',
  SYNC_QUEUE_KEY: 'syncQueue',
  LAST_SYNC_KEY: 'lastSync',
};

/**
 * Get auth token from storage
 */
function getAuthToken() {
  return localStorage.getItem(CONFIG.AUTH_TOKEN_KEY);
}

/**
 * Set auth token in storage
 */
function setAuthToken(token) {
  localStorage.setItem(CONFIG.AUTH_TOKEN_KEY, token);
}

/**
 * Clear auth data
 */
function clearAuth() {
  localStorage.removeItem(CONFIG.AUTH_TOKEN_KEY);
  localStorage.removeItem(CONFIG.AUTH_USER_KEY);
}

/**
 * Get current user from storage
 */
function getCurrentUser() {
  const data = localStorage.getItem(CONFIG.AUTH_USER_KEY);
  return data ? JSON.parse(data) : null;
}

/**
 * Set current user in storage
 */
function setCurrentUser(user) {
  localStorage.setItem(CONFIG.AUTH_USER_KEY, JSON.stringify(user));
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 - token expired
  if (response.status === 401) {
    clearAuth();
    // Optionally redirect to login
  }

  return response;
}

/**
 * Theme Management
 */
const THEME_KEY = 'ncc_theme';

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

// Apply saved theme immediately (prevents flash)
(function() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
})();

// Set up theme toggle button when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTheme);
  }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getAuthToken, setAuthToken, clearAuth, getCurrentUser, setCurrentUser, isAuthenticated, apiRequest, getTheme, setTheme, toggleTheme };
}
