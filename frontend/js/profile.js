/**
 * Niche Collector Connector - Profile Page Logic
 */

const Profile = {
  // State
  profile: null,
  collection: [],
  showcase: [],
  chatHistory: [],

  /**
   * Initialize the profile page
   */
  async init() {
    // Handle OAuth callback first (extracts token from URL if present)
    Auth.init();

    // Then check authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load data
    await Promise.all([
      this.loadProfile(),
      this.loadCollection(),
      this.loadShowcase()
    ]);

    // Render user menu
    this.renderUserMenu();
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Helper to safely add event listeners
    const addListener = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
      else console.warn(`Element #${id} not found`);
    };

    // AI Sidebar
    addListener('ai-toggle-btn', 'click', () => {
      document.getElementById('ai-sidebar')?.classList.add('open');
      document.getElementById('sidebar-overlay')?.classList.add('show');
    });

    addListener('ai-close-btn', 'click', () => {
      document.getElementById('ai-sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('show');
    });

    addListener('sidebar-overlay', 'click', () => {
      document.getElementById('ai-sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('show');
    });

    // AI Chat form
    addListener('ai-input-form', 'submit', (e) => {
      e.preventDefault();
      this.sendChatMessage();
    });

    // Edit Profile
    addListener('edit-profile-btn', 'click', () => {
      this.openEditProfileModal();
    });

    addListener('edit-profile-close', 'click', () => {
      this.closeModal('edit-profile-modal');
    });

    addListener('edit-profile-cancel', 'click', () => {
      this.closeModal('edit-profile-modal');
    });

    addListener('edit-profile-form', 'submit', (e) => {
      e.preventDefault();
      this.saveProfile();
    });

    // Bio character count
    addListener('edit-bio', 'input', (e) => {
      const countEl = document.getElementById('bio-char-count');
      if (countEl) countEl.textContent = e.target.value.length;
    });

    // Add to Showcase button
    addListener('add-to-showcase-btn', 'click', () => {
      if (this.collection.length === 0) {
        this.openAddRecordModal();
      } else {
        this.openShowcaseModal();
      }
    });

    // Add Record button (in collection section)
    addListener('add-record-btn', 'click', () => {
      this.openAddRecordModal();
    });

    addListener('add-record-close', 'click', () => {
      this.closeModal('add-record-modal');
    });

    addListener('manual-add-cancel', 'click', () => {
      this.closeModal('add-record-modal');
    });

    // Photo upload buttons
    addListener('upload-photo-btn', 'click', () => {
      document.getElementById('photo-upload-input')?.click();
    });

    addListener('photo-upload-input', 'change', (e) => {
      if (e.target.files[0]) {
        this.handlePhotoUpload(e.target.files[0]);
      }
    });

    addListener('change-bg-btn', 'click', () => {
      document.getElementById('bg-upload-input')?.click();
    });

    addListener('bg-upload-input', 'change', (e) => {
      if (e.target.files[0]) {
        this.handleBackgroundUpload(e.target.files[0]);
      }
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`)?.classList.add('active');
      });
    });

    // Manual add form
    addListener('manual-add-form', 'submit', (e) => {
      e.preventDefault();
      this.addRecordManually();
    });

    // Discogs search form
    addListener('discogs-search-form', 'submit', (e) => {
      e.preventDefault();
      this.searchDiscogs();
    });

    // Showcase modal
    addListener('showcase-modal-close', 'click', () => {
      this.closeModal('showcase-modal');
    });

    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });

    // Listen for auth events
    window.addEventListener('auth:logout', () => {
      window.location.href = '/';
    });

    window.addEventListener('auth:expired', () => {
      window.location.href = '/';
    });
  },

  /**
   * Render user menu in header
   */
  renderUserMenu() {
    const userMenu = document.getElementById('user-menu');
    const profile = Auth.createUserProfile();
    if (profile) {
      userMenu.appendChild(profile);
    }
  },

  /**
   * Load user profile
   */
  async loadProfile() {
    try {
      const response = await Auth.apiRequest('/api/profile/me');
      if (response.ok) {
        this.profile = await response.json();
        this.renderProfile();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  },

  /**
   * Render profile data
   */
  renderProfile() {
    if (!this.profile) return;

    // Profile picture
    const picture = document.getElementById('profile-picture');
    picture.src = this.profile.picture || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a1a" width="100" height="100"/><text x="50" y="60" font-size="40" text-anchor="middle" fill="%23666">?</text></svg>';
    picture.alt = this.profile.name || 'Profile';

    // Name
    document.getElementById('profile-name').textContent = this.profile.name || 'Anonymous Collector';

    // Pronouns
    const pronounsEl = document.getElementById('profile-pronouns');
    if (this.profile.pronouns) {
      pronounsEl.textContent = this.profile.pronouns;
      pronounsEl.style.display = 'block';
    } else {
      pronounsEl.style.display = 'none';
    }

    // Bio
    document.getElementById('profile-bio').textContent = this.profile.bio || '';

    // Background
    if (this.profile.background_image) {
      document.getElementById('hero-background').style.backgroundImage = `url(${this.profile.background_image})`;
    }
  },

  /**
   * Load user collection
   */
  async loadCollection() {
    try {
      const response = await Auth.apiRequest('/api/collection/');
      if (response.ok) {
        this.collection = await response.json();
        this.renderCollection();
      }
    } catch (error) {
      console.error('Error loading collection:', error);
    }
  },

  /**
   * Render collection grid
   */
  renderCollection() {
    const grid = document.getElementById('collection-grid');
    const countEl = document.getElementById('collection-count');
    const emptyEl = document.getElementById('collection-empty');

    countEl.textContent = this.collection.length;

    if (this.collection.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      grid.innerHTML = '';
      if (emptyEl) grid.appendChild(emptyEl);
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    grid.innerHTML = this.collection.map(album => `
      <div class="album-card" data-id="${album.id}">
        <img src="${album.cover || this.getPlaceholderCover(album)}"
             alt="${album.album}" loading="lazy"
             onerror="this.src='${this.getPlaceholderCover(album)}'">
        <div class="album-info">
          <p class="album-title">${this.escapeHtml(album.album)}</p>
          <p class="album-artist">${this.escapeHtml(album.artist)}</p>
        </div>
        <button class="remove-btn" onclick="Profile.removeFromCollection(${album.id})" title="Remove">&times;</button>
      </div>
    `).join('');

    // Add click to show in showcase option
    grid.querySelectorAll('.album-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-btn')) {
          const id = parseInt(card.dataset.id);
          this.addToShowcase(id);
        }
      });
    });
  },

  /**
   * Load showcase
   */
  async loadShowcase() {
    try {
      const response = await Auth.apiRequest('/api/profile/me/showcase');
      if (response.ok) {
        this.showcase = await response.json();
        this.renderShowcase();
      }
    } catch (error) {
      console.error('Error loading showcase:', error);
    }
  },

  /**
   * Render showcase grid
   */
  renderShowcase() {
    const grid = document.getElementById('showcase-grid');
    const emptyEl = document.getElementById('showcase-empty');

    if (this.showcase.length === 0) {
      emptyEl.style.display = 'block';
      grid.innerHTML = '';
      grid.appendChild(emptyEl);
      return;
    }

    emptyEl.style.display = 'none';

    grid.innerHTML = this.showcase.map(album => `
      <div class="album-card showcase-item" data-id="${album.id}">
        <img src="${album.cover || this.getPlaceholderCover(album)}"
             alt="${album.album}" loading="lazy"
             onerror="this.src='${this.getPlaceholderCover(album)}'">
        <div class="album-info">
          <p class="album-title">${this.escapeHtml(album.album)}</p>
          <p class="album-artist">${this.escapeHtml(album.artist)}</p>
        </div>
        <button class="remove-btn" onclick="Profile.removeFromShowcase(${album.id})" title="Remove from showcase">&times;</button>
      </div>
    `).join('');
  },

  /**
   * Open edit profile modal
   */
  openEditProfileModal() {
    document.getElementById('edit-name').value = this.profile?.name || '';
    document.getElementById('edit-pronouns').value = this.profile?.pronouns || '';
    document.getElementById('edit-bio').value = this.profile?.bio || '';
    document.getElementById('bio-char-count').textContent = (this.profile?.bio || '').length;
    document.getElementById('edit-profile-modal').classList.add('open');
  },

  /**
   * Save profile changes
   */
  async saveProfile() {
    const name = document.getElementById('edit-name').value.trim();
    const pronouns = document.getElementById('edit-pronouns').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();

    try {
      const response = await Auth.apiRequest('/api/profile/me', {
        method: 'PUT',
        body: JSON.stringify({ name, pronouns, bio })
      });

      if (response.ok) {
        this.profile = await response.json();
        this.renderProfile();
        this.closeModal('edit-profile-modal');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    }
  },

  /**
   * Handle profile photo upload
   */
  handlePhotoUpload(file) {
    // For now, convert to data URL and show preview
    // In production, upload to R2 storage
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('profile-picture').src = e.target.result;
      // TODO: Upload to R2 and save URL to profile
      alert('Photo preview shown. Full upload functionality coming soon!');
    };
    reader.readAsDataURL(file);
  },

  /**
   * Handle background image upload
   */
  handleBackgroundUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('hero-background').style.backgroundImage = `url(${e.target.result})`;
      // TODO: Upload to R2 and save URL to profile
      alert('Background preview shown. Full upload functionality coming soon!');
    };
    reader.readAsDataURL(file);
  },

  /**
   * Open add record modal
   */
  openAddRecordModal() {
    document.getElementById('manual-artist').value = '';
    document.getElementById('manual-album').value = '';
    document.getElementById('manual-year').value = '';
    document.getElementById('manual-cover').value = '';
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('discogs-query').value = '';
    document.getElementById('add-record-modal').classList.add('open');
  },

  /**
   * Add record manually
   */
  async addRecordManually() {
    const artist = document.getElementById('manual-artist').value.trim();
    const album = document.getElementById('manual-album').value.trim();
    const year = document.getElementById('manual-year').value;
    const cover = document.getElementById('manual-cover').value.trim();

    if (!artist || !album) {
      alert('Artist and album are required');
      return;
    }

    try {
      const response = await Auth.apiRequest('/api/collection/', {
        method: 'POST',
        body: JSON.stringify({
          artist,
          album,
          year: year ? parseInt(year) : null,
          cover: cover || null
        })
      });

      if (response.ok) {
        const newAlbum = await response.json();
        this.collection.push(newAlbum);
        this.renderCollection();
        this.closeModal('add-record-modal');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to add album');
      }
    } catch (error) {
      console.error('Error adding album:', error);
      alert('Failed to add album');
    }
  },

  /**
   * Search Discogs
   */
  async searchDiscogs() {
    const query = document.getElementById('discogs-query').value.trim();
    if (!query) return;

    const resultsEl = document.getElementById('search-results');
    resultsEl.innerHTML = '<div class="loading">Searching Discogs</div>';

    try {
      // Use Discogs API directly with client credentials
      const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=10`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Discogs key=${CONFIG.DISCOGS_KEY}, secret=${CONFIG.DISCOGS_SECRET}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.renderSearchResults(data.results || []);
      } else {
        resultsEl.innerHTML = '<p style="color:#888;text-align:center;">Search failed. Please try again.</p>';
      }
    } catch (error) {
      console.error('Discogs search error:', error);
      resultsEl.innerHTML = '<p style="color:#888;text-align:center;">Search failed. Please try again.</p>';
    }
  },

  /**
   * Render Discogs search results
   */
  renderSearchResults(results) {
    const resultsEl = document.getElementById('search-results');

    if (results.length === 0) {
      resultsEl.innerHTML = '<p style="color:#888;text-align:center;">No results found.</p>';
      return;
    }

    resultsEl.innerHTML = results.map(result => {
      const [artist, ...albumParts] = (result.title || '').split(' - ');
      const album = albumParts.join(' - ') || artist;
      return `
        <div class="search-result" onclick="Profile.addFromDiscogs(${JSON.stringify({
          artist: artist || 'Unknown',
          album: album || 'Unknown',
          year: result.year || null,
          cover: result.cover_image || null,
          discogs_id: result.id
        }).replace(/"/g, '&quot;')})">
          <img src="${result.thumb || result.cover_image || ''}"
               alt="${result.title}"
               onerror="this.style.display='none'">
          <div class="search-result-info">
            <p class="search-result-title">${this.escapeHtml(album)}</p>
            <p class="search-result-artist">${this.escapeHtml(artist)}${result.year ? ` (${result.year})` : ''}</p>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Add album from Discogs result
   */
  async addFromDiscogs(albumData) {
    try {
      const response = await Auth.apiRequest('/api/collection/', {
        method: 'POST',
        body: JSON.stringify(albumData)
      });

      if (response.ok) {
        const newAlbum = await response.json();
        this.collection.push(newAlbum);
        this.renderCollection();
        this.closeModal('add-record-modal');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to add album');
      }
    } catch (error) {
      console.error('Error adding album:', error);
      alert('Failed to add album');
    }
  },

  /**
   * Open showcase modal
   */
  openShowcaseModal() {
    const grid = document.getElementById('showcase-select-grid');
    const showcaseIds = new Set(this.showcase.map(s => s.collection_id));

    // Filter out albums already in showcase
    const available = this.collection.filter(a => !showcaseIds.has(a.id));

    if (available.length === 0) {
      if (this.collection.length === 0) {
        this.openAddRecordModal();
        return;
      }
      alert('All your albums are already in your showcase!');
      return;
    }

    grid.innerHTML = available.map(album => `
      <div class="showcase-select-item" onclick="Profile.addToShowcase(${album.id})">
        <img src="${album.cover || this.getPlaceholderCover(album)}"
             alt="${album.album}"
             onerror="this.src='${this.getPlaceholderCover(album)}'">
        <div class="album-overlay">
          <span>${this.escapeHtml(album.album)}</span>
        </div>
      </div>
    `).join('');

    document.getElementById('showcase-modal').classList.add('open');
  },

  /**
   * Add to showcase
   */
  async addToShowcase(collectionId) {
    // Check if already in showcase
    if (this.showcase.find(s => s.collection_id === collectionId)) {
      alert('This album is already in your showcase');
      return;
    }

    // Check showcase limit
    if (this.showcase.length >= 8) {
      alert('Showcase limit reached (max 8 albums). Remove one to add another.');
      return;
    }

    try {
      const response = await Auth.apiRequest('/api/profile/me/showcase', {
        method: 'POST',
        body: JSON.stringify({ collection_id: collectionId })
      });

      if (response.ok) {
        const newShowcase = await response.json();
        this.showcase.push(newShowcase);
        this.renderShowcase();
        this.closeModal('showcase-modal');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to add to showcase');
      }
    } catch (error) {
      console.error('Error adding to showcase:', error);
    }
  },

  /**
   * Remove from showcase
   */
  async removeFromShowcase(showcaseId) {
    if (!confirm('Remove this album from your showcase?')) return;

    try {
      const response = await Auth.apiRequest(`/api/profile/me/showcase/${showcaseId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.showcase = this.showcase.filter(s => s.id !== showcaseId);
        this.renderShowcase();
      }
    } catch (error) {
      console.error('Error removing from showcase:', error);
    }
  },

  /**
   * Remove from collection
   */
  async removeFromCollection(albumId) {
    if (!confirm('Remove this album from your collection?')) return;

    try {
      const response = await Auth.apiRequest(`/api/collection/${albumId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.collection = this.collection.filter(a => a.id !== albumId);
        this.showcase = this.showcase.filter(s => s.collection_id !== albumId);
        this.renderCollection();
        this.renderShowcase();
      }
    } catch (error) {
      console.error('Error removing album:', error);
    }
  },

  /**
   * Send chat message to AI
   */
  async sendChatMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';

    // Add user message to chat
    this.addChatMessage(message, 'user');

    // Add to history
    this.chatHistory.push({ role: 'user', content: message });

    try {
      const response = await Auth.apiRequest('/api/chat/', {
        method: 'POST',
        body: JSON.stringify({
          message,
          collection: this.collection.map(a => ({ artist: a.artist, album: a.album })),
          history: this.chatHistory.slice(-10)
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Sanitize and add response
        const cleanResponse = typeof DOMPurify !== 'undefined'
          ? DOMPurify.sanitize(data.response)
          : data.response;
        this.addChatMessage(cleanResponse, 'assistant');

        // Add to history
        this.chatHistory.push({ role: 'assistant', content: data.response });

        // Process album actions
        if (data.albums_to_add?.length > 0) {
          for (const album of data.albums_to_add) {
            await this.addAlbumFromChat(album);
          }
        }

        if (data.albums_to_remove?.length > 0) {
          for (const album of data.albums_to_remove) {
            await this.removeAlbumFromChat(album);
          }
        }
      } else {
        this.addChatMessage('Sorry, I had trouble processing that. Please try again.', 'assistant');
      }
    } catch (error) {
      console.error('Chat error:', error);
      this.addChatMessage('Sorry, something went wrong. Please try again.', 'assistant');
    }
  },

  /**
   * Add chat message to display
   */
  addChatMessage(content, role) {
    const container = document.getElementById('ai-chat-container');
    const welcome = container.querySelector('.ai-welcome');
    if (welcome) welcome.remove();

    const message = document.createElement('div');
    message.className = `ai-message ${role}`;
    message.textContent = content;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  },

  /**
   * Add album from chat
   */
  async addAlbumFromChat(album) {
    try {
      const response = await Auth.apiRequest('/api/collection/', {
        method: 'POST',
        body: JSON.stringify({
          artist: album.artist,
          album: album.album
        })
      });

      if (response.ok) {
        const newAlbum = await response.json();
        this.collection.push(newAlbum);
        this.renderCollection();
      }
    } catch (error) {
      console.error('Error adding album from chat:', error);
    }
  },

  /**
   * Remove album from chat
   */
  async removeAlbumFromChat(album) {
    const found = this.collection.find(a =>
      a.artist.toLowerCase() === album.artist.toLowerCase() &&
      a.album.toLowerCase() === album.album.toLowerCase()
    );

    if (found) {
      await this.removeFromCollection(found.id);
    }
  },

  /**
   * Close modal
   */
  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('open');
  },

  /**
   * Get placeholder cover image
   */
  getPlaceholderCover(album) {
    const initial = (album.artist || 'A')[0].toUpperCase();
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%231a1a1a' width='100' height='100'/><text x='50' y='60' font-size='40' text-anchor='middle' fill='%231db954'>${initial}</text></svg>`;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Profile.init());
} else {
  Profile.init();
}

// Expose globally
window.Profile = Profile;
