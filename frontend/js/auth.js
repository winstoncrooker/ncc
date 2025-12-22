/**
 * Niche Collector Connector Authentication Module
 * Google OAuth2 authentication handling
 */

const Auth = {
  // Storage keys
  TOKEN_KEY: 'ncc_token',
  USER_KEY: 'ncc_user',

  /**
   * Initialize auth - check URL for OAuth callback params
   */
  init() {
    // Check for OAuth callback params in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const authError = params.get('auth_error');

    console.log('[Auth] init called, token in URL:', !!token, 'stored token:', !!this.getToken());

    if (authError) {
      console.error('[Auth] OAuth error:', authError);
      this.showError(`Authentication failed: ${authError}`);
      this.cleanUrl();
      return false;
    }

    if (token) {
      // Store auth data from callback
      const user = {
        id: parseInt(params.get('user_id')),
        email: params.get('email'),
        name: params.get('name') || null,
        picture: params.get('picture') || null
      };

      console.log('[Auth] Storing token and user:', user.email);
      this.setToken(token);
      this.setUser(user);

      // Clean up URL (remove auth params)
      this.cleanUrl();

      // Trigger auth success event
      window.dispatchEvent(new CustomEvent('auth:success', { detail: user }));

      return true;
    }

    console.log('[Auth] No token in URL, isAuthenticated:', this.isAuthenticated());
    return this.isAuthenticated();
  },

  /**
   * Clean auth params from URL
   */
  cleanUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('user_id');
    url.searchParams.delete('email');
    url.searchParams.delete('name');
    url.searchParams.delete('picture');
    url.searchParams.delete('auth_error');
    window.history.replaceState({}, document.title, url.pathname + url.search);
  },

  /**
   * Redirect to Google OAuth login
   * @param {string} redirectTo - Where to redirect after login (path like '/profile.html')
   */
  login(redirectTo = window.location.pathname) {
    const apiBase = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE : '';
    // Use full URL so OAuth redirects back to frontend, not the API server
    const fullRedirectUrl = window.location.origin + redirectTo;
    window.location.href = `${apiBase}/api/auth/google?redirect_to=${encodeURIComponent(fullRedirectUrl)}`;
  },

  /**
   * Logout - clear stored auth data
   */
  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.dispatchEvent(new CustomEvent('auth:logout'));
  },

  /**
   * Get stored auth token
   */
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  /**
   * Get auth headers for API requests
   */
  getAuthHeaders() {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  /**
   * Set auth token
   */
  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  /**
   * Get stored user data
   */
  getUser() {
    const data = localStorage.getItem(this.USER_KEY);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Set user data
   */
  setUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Make authenticated API request
   * @param {string} endpoint - API endpoint (e.g., '/api/collection')
   * @param {object} options - Fetch options
   */
  async apiRequest(endpoint, options = {}) {
    const apiBase = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE : '';
    const url = `${apiBase}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[Auth] API request:', options.method || 'GET', endpoint);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('[Auth] API response:', endpoint, response.status);

    // Handle 401 - token expired
    if (response.status === 401) {
      console.log('[Auth] Got 401, logging out');
      this.logout();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    return response;
  },

  /**
   * Refresh auth token
   */
  async refreshToken() {
    try {
      const response = await this.apiRequest('/api/auth/refresh', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.access_token);
        this.setUser({
          id: data.user_id,
          email: data.email,
          name: data.name,
          picture: data.picture
        });
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  },

  /**
   * Show error message (override in app if needed)
   */
  showError(message) {
    console.error(message);
    // Can be overridden to show UI error
  },

  /**
   * Create login button element
   * @param {string} text - Button text
   * @param {string} redirectTo - Where to redirect after login
   */
  createLoginButton(text = 'Sign in with Google', redirectTo = window.location.pathname) {
    const button = document.createElement('button');
    button.className = 'google-login-btn';
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
      </svg>
      <span>${text}</span>
    `;
    button.onclick = () => this.login(redirectTo);
    return button;
  },

  /**
   * Create user profile element
   */
  createUserProfile() {
    const user = this.getUser();
    if (!user) return null;

    const profile = document.createElement('div');
    profile.className = 'user-profile';

    if (user.picture) {
      const img = document.createElement('img');
      img.src = user.picture;
      img.alt = user.name || user.email;
      img.className = 'user-avatar';
      profile.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'user-info';
    info.innerHTML = `
      <span class="user-name">${user.name || user.email}</span>
      <button class="logout-btn" onclick="Auth.logout()">Sign out</button>
    `;
    profile.appendChild(info);

    return profile;
  }
};

// Expose Auth globally (but don't auto-init - let pages handle it)
if (typeof window !== 'undefined') {
  window.Auth = Auth;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Auth;
}
