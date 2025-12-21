/**
 * Vinyl Vault Configuration
 * API endpoints and settings
 */

const CONFIG = {
  // API Base URL - auto-detect environment
  API_BASE: (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8787';  // Local pywrangler dev
    }
    // Production Worker URL
    return 'https://vinyl-vault-api.christophercrooker.workers.dev';
  })(),

  // Discogs credentials - client-side calls (Worker requests blocked by Cloudflare)
  DISCOGS_KEY: 'yRxzvHyveKiFOEHuwmcW',
  DISCOGS_SECRET: 'GnnPcnLGovdJLMfMyEpaSRoXOsRqojBr',

  // Auth token storage key
  AUTH_TOKEN_KEY: 'vinyl_vault_token',
  AUTH_USER_KEY: 'vinyl_vault_user',

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

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getAuthToken, setAuthToken, clearAuth, getCurrentUser, setCurrentUser, isAuthenticated, apiRequest };
}
