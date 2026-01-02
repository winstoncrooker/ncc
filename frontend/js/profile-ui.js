/**
 * Profile UI Module
 * Handles UI utilities, tabs, theme toggle, rendering, and wishlist
 */

const ProfileUI = {
  // Category color schemes - consistent across app
  categoryColors: {
    'vinyl': { accent: '#1db954', darker: '#17a447' },           // green
    'vinyl-records': { accent: '#1db954', darker: '#17a447' },   // alias for vinyl
    'cars': { accent: '#e74c3c', darker: '#c0392b' },            // red
    'coins': { accent: '#f39c12', darker: '#d68910' },           // gold
    'comics': { accent: '#9b59b6', darker: '#8e44ad' },          // purple
    'sneakers': { accent: '#3498db', darker: '#2980b9' },        // blue
    'trading-cards': { accent: '#e67e22', darker: '#d35400' },   // orange
    'video-games': { accent: '#2ecc71', darker: '#27ae60' },     // green
    'watches': { accent: '#1abc9c', darker: '#16a085' }          // teal
  },

  /**
   * Apply category color scheme
   */
  applyCategoryColor(slug) {
    const colors = this.categoryColors[slug] || this.categoryColors['vinyl'];
    document.documentElement.style.setProperty('--accent', colors.accent);
    document.documentElement.style.setProperty('--accent-dark', colors.darker);
  },

  /**
   * Load profile data
   */
  async loadProfile() {
    try {
      const response = await Auth.apiRequest('/api/profile/me');
      if (response.ok) {
        Profile.profile = await response.json();
        this.renderProfile();
      } else if (response.status === 401) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  },

  /**
   * Render profile data to the page
   */
  renderProfile() {
    const p = Profile.profile;
    if (!p) return;

    document.getElementById('profile-picture').src = p.picture || Profile.getDefaultAvatar(p.name);
    document.getElementById('profile-name').textContent = p.name || 'Anonymous';

    const pronounsEl = document.getElementById('profile-pronouns');
    if (p.pronouns) {
      pronounsEl.textContent = p.pronouns;
      pronounsEl.style.display = 'inline-block';
    } else {
      pronounsEl.style.display = 'none';
    }

    document.getElementById('profile-bio').textContent = p.bio || 'No bio yet. Click edit to add one!';

    const locationEl = document.getElementById('profile-location');
    if (locationEl) {
      if (p.location) {
        locationEl.textContent = p.location;
        locationEl.style.display = 'inline-flex';
      } else {
        locationEl.style.display = 'none';
      }
    }

    // Render social links
    this.renderSocialLinks(p.external_links);

    if (p.background_image) {
      document.getElementById('hero-background').style.backgroundImage = `url(${p.background_image})`;
    }
  },

  /**
   * Render social links
   */
  renderSocialLinks(links) {
    const container = document.getElementById('external-links-display');
    if (!container) return;

    // Handle both array format [{platform, url}] and object format {platform: url}
    let linksArray = [];
    if (Array.isArray(links)) {
      linksArray = links;
    } else if (links && typeof links === 'object') {
      // Convert object format to array format
      linksArray = Object.entries(links)
        .filter(([platform, url]) => url) // Only include links with URLs
        .map(([platform, url]) => ({ platform, url }));
    }

    if (linksArray.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = linksArray.map(link => {
      const config = Profile.socialPlatforms[link.platform];
      if (!config || !link.url) return '';
      // For username-only platforms (Discord, Twitch), just show the icon without a link
      // or build the full URL if they have a prefix
      let url;
      if (config.isUsername) {
        if (config.urlPrefix) {
          url = config.urlPrefix + link.url;
        } else {
          // Username-only without URL prefix (like Discord) - no clickable link
          return `
            <span class="external-link" title="${config.label}: ${Profile.escapeHtml(link.url)}">
              <span class="link-icon">${config.icon}</span>
            </span>
          `;
        }
      } else if (link.url.startsWith('http')) {
        url = Profile.sanitizeUrl(link.url);
      } else if (config.urlPrefix) {
        url = config.urlPrefix + link.url;
      } else {
        url = Profile.sanitizeUrl(link.url);
      }
      if (!url) return '';
      return `
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="external-link" title="${config.label}">
          <span class="link-icon">${config.icon}</span>
        </a>
      `;
    }).join('');
  },

  /**
   * Load user categories from interests API
   */
  async loadUserCategories() {
    try {
      const response = await Auth.apiRequest('/api/interests/me');
      if (response.ok) {
        const data = await response.json();
        // Extract unique categories from interests
        const categoryMap = new Map();
        for (const interest of data.interests || []) {
          if (interest.category_id && !categoryMap.has(interest.category_id)) {
            categoryMap.set(interest.category_id, {
              id: interest.category_id,
              slug: interest.category_slug,
              name: interest.category_name,
              icon: interest.category_icon
            });
          }
        }
        Profile.userCategories = Array.from(categoryMap.values());
        this.renderCategoryTabs();

        // Set initial category from URL, localStorage, or first category
        const urlParams = new URLSearchParams(window.location.search);
        const urlCategory = urlParams.get('category');
        const savedCategory = localStorage.getItem('ncc_last_category');

        if (urlCategory && Profile.userCategories.some(c => c.slug === urlCategory)) {
          Profile.currentCategorySlug = urlCategory;
        } else if (savedCategory && Profile.userCategories.some(c => c.slug === savedCategory)) {
          Profile.currentCategorySlug = savedCategory;
        } else if (Profile.userCategories.length > 0) {
          Profile.currentCategorySlug = Profile.userCategories[0].slug;
        }

        if (Profile.currentCategorySlug) {
          this.applyCategoryColor(Profile.currentCategorySlug);
        }
      }
    } catch (error) {
      console.error('Error loading user categories:', error);
    }
  },

  /**
   * Render category tabs
   */
  renderCategoryTabs() {
    const container = document.getElementById('category-tabs');
    if (!container) return;

    if (Profile.userCategories.length === 0) {
      container.innerHTML = '<p class="no-categories">Join a collector category to get started!</p>';
      return;
    }

    container.innerHTML = Profile.userCategories.map(cat => `
      <button class="category-tab ${cat.slug === Profile.currentCategorySlug ? 'active' : ''}"
              data-slug="${cat.slug}"
              onclick="ProfileUI.switchCategory('${cat.slug}')">
        <span class="cat-icon">${cat.icon || ''}</span>
        <span class="cat-name">${cat.name}</span>
      </button>
    `).join('');
  },

  /**
   * Switch to a different category
   */
  async switchCategory(slug) {
    if (slug === Profile.currentCategorySlug) return;

    Profile.currentCategorySlug = slug;
    this.applyCategoryColor(slug);

    // Save to localStorage for persistence on page reload
    localStorage.setItem('ncc_last_category', slug);

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('category', slug);
    window.history.replaceState({}, '', url);

    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.slug === slug);
    });

    // Reload category-specific data
    await Promise.all([
      ProfileCollection.loadCollection(),
      ProfileShowcase.loadShowcase(),
      this.loadWishlist()
    ]);
  },

  /**
   * Render collection summary card
   */
  async renderCollectionSummary() {
    try {
      const response = await Auth.apiRequest('/api/collection/stats');
      if (response.ok) {
        Profile.collectionStats = await response.json();

        const totalEl = document.getElementById('total-items');
        const showcaseEl = document.getElementById('showcase-items');
        const scoreEl = document.getElementById('collector-score');

        if (totalEl) totalEl.textContent = Profile.collectionStats.total_albums || 0;
        if (showcaseEl) showcaseEl.textContent = Profile.collectionStats.total_showcase || 0;
        if (scoreEl) scoreEl.textContent = Profile.collectionStats.collector_score || 0;
      }
    } catch (error) {
      console.error('Error loading collection stats:', error);
    }
  },

  /**
   * Update collector score instantly (optimistic update)
   */
  updateCollectorScoreInstantly(showcaseDelta, collectionDelta) {
    if (!Profile.collectionStats) return;

    Profile.collectionStats.total_showcase = (Profile.collectionStats.total_showcase || 0) + showcaseDelta;
    Profile.collectionStats.total_albums = (Profile.collectionStats.total_albums || 0) + collectionDelta;

    // Simple score calculation: showcase * 10 + collection
    Profile.collectionStats.collector_score =
      (Profile.collectionStats.total_showcase * 10) + Profile.collectionStats.total_albums;

    const totalEl = document.getElementById('total-items');
    const showcaseEl = document.getElementById('showcase-items');
    const scoreEl = document.getElementById('collector-score');

    if (totalEl) totalEl.textContent = Profile.collectionStats.total_albums;
    if (showcaseEl) showcaseEl.textContent = Profile.collectionStats.total_showcase;
    if (scoreEl) scoreEl.textContent = Profile.collectionStats.collector_score;
  },

  /**
   * Render profile completion card
   */
  renderProfileCompletion() {
    const p = Profile.profile;
    if (!p) return;

    let completed = 0;
    const total = 5;
    const missing = [];

    if (p.picture) completed++; else missing.push('profile picture');
    if (p.name) completed++; else missing.push('display name');
    if (p.bio) completed++; else missing.push('bio');
    if (p.background_image) completed++; else missing.push('background image');
    if (Profile.collectionStats?.total_albums > 0) completed++; else missing.push('first item');

    const percent = Math.round((completed / total) * 100);

    const container = document.getElementById('profile-completion');
    const progressEl = document.getElementById('completion-fill');
    const textEl = document.getElementById('completion-text');

    // Show the completion indicator if not 100%
    if (container) {
      container.style.display = percent < 100 ? 'block' : 'none';
    }

    if (progressEl) progressEl.style.width = `${percent}%`;
    if (textEl) {
      if (missing.length > 0) {
        textEl.textContent = `${percent}% complete - Add ${missing[0]}`;
      } else {
        textEl.textContent = `Profile ${percent}% complete`;
      }
    }
  },

  /**
   * Render user menu
   */
  renderUserMenu() {
    const menuBtn = document.getElementById('user-menu-btn');
    const menuPic = document.getElementById('user-menu-picture');

    if (menuPic && Profile.profile?.picture) {
      menuPic.src = Profile.profile.picture;
    }

    if (menuBtn) {
      menuBtn.onclick = () => {
        const dropdown = document.getElementById('user-menu-dropdown');
        dropdown?.classList.toggle('active');
      };
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('user-menu-dropdown');
      const menuBtn = document.getElementById('user-menu-btn');
      if (dropdown && menuBtn && !menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  },

  /**
   * Toggle share dropdown
   */
  toggleShareDropdown() {
    const dropdown = document.getElementById('share-dropdown');
    const btn = document.getElementById('share-profile-btn');
    if (dropdown && btn) {
      const isActive = dropdown.classList.toggle('active');
      btn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    }
  },

  /**
   * Handle share action
   */
  handleShare(type) {
    const profileUrl = window.location.href;
    const profileName = Profile.profile?.name || 'Check out my collection';

    switch (type) {
      case 'copy':
        navigator.clipboard.writeText(profileUrl).then(() => {
          Auth.showSuccess('Link copied to clipboard!');
        });
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(profileName)}&url=${encodeURIComponent(profileUrl)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`, '_blank');
        break;
    }

    document.getElementById('share-dropdown')?.classList.remove('active');
  },

  // ============================================
  // WISHLIST FUNCTIONALITY
  // ============================================

  /**
   * Load wishlist items
   */
  async loadWishlist() {
    const categoryId = Profile.userCategories?.find(c => c.slug === Profile.currentCategorySlug)?.id;
    try {
      let url = categoryId ? `/api/wishlist?category_id=${categoryId}` : '/api/wishlist';
      url += (url.includes('?') ? '&' : '?') + 'include_found=true';
      const response = await Auth.apiRequest(url);
      if (response.ok) {
        Profile.wishlist = await response.json();
        this.renderWishlist();
      }
    } catch (error) {
      console.error('Error loading wishlist:', error);
    }
  },

  /**
   * Render wishlist section
   */
  renderWishlist() {
    const section = document.getElementById('wishlist-section');
    const grid = document.getElementById('wishlist-grid');
    const countEl = document.getElementById('wishlist-count');

    if (!section || !grid) return;

    section.style.display = 'block';

    if (countEl) countEl.textContent = Profile.wishlist.length;

    if (Profile.wishlist.length === 0) {
      grid.innerHTML = `
        <div class="wishlist-empty" id="wishlist-empty">
          <div class="empty-icon">🔍</div>
          <p>No items on your wishlist</p>
          <span>Add items you're looking for!</span>
        </div>
      `;
      return;
    }

    const priorityLabels = ['Low', 'Medium', 'Grail!'];
    const priorityClasses = ['low', 'medium', 'high'];

    grid.innerHTML = Profile.wishlist.map(item => `
      <div class="wishlist-card priority-${priorityClasses[item.priority] || 'low'}">
        <div class="wishlist-header">
          <span class="wishlist-priority ${priorityClasses[item.priority] || 'low'}">${priorityLabels[item.priority] || 'Low'}</span>
          ${item.is_found ? '<span class="wishlist-found">Found!</span>' : ''}
        </div>
        <h4 class="wishlist-title">${Profile.escapeHtml(item.title)}</h4>
        ${item.artist ? `<p class="wishlist-artist">${Profile.escapeHtml(item.artist)}</p>` : ''}
        ${item.year ? `<p class="wishlist-year">${item.year}</p>` : ''}
        ${item.description ? `<p class="wishlist-desc">${Profile.escapeHtml(item.description)}</p>` : ''}
        <div class="wishlist-meta">
          ${item.condition_wanted ? `<span class="wishlist-condition">${Profile.escapeHtml(item.condition_wanted)}</span>` : ''}
          ${item.max_price ? `<span class="wishlist-price">Max $${item.max_price.toFixed(2)}</span>` : ''}
        </div>
        <div class="wishlist-actions">
          ${!item.is_found
            ? `<button class="wishlist-found-btn" onclick="Profile.markWishlistFound(${item.id})">Mark Found</button>`
            : `<button class="wishlist-unfound-btn" onclick="Profile.markWishlistUnfound(${item.id})">Mark Unfound</button>`}
          <button class="wishlist-delete-btn" onclick="Profile.deleteWishlistItem(${item.id})">×</button>
        </div>
      </div>
    `).join('');
  },

  /**
   * Add item to wishlist
   */
  async addWishlistItem() {
    const categoryId = Profile.userCategories?.find(c => c.slug === Profile.currentCategorySlug)?.id;
    if (!categoryId) {
      Auth.showWarning('Please select a category first');
      return;
    }

    const item = {
      category_id: categoryId,
      title: document.getElementById('wishlist-title').value.trim(),
      artist: document.getElementById('wishlist-artist').value.trim() || null,
      year: parseInt(document.getElementById('wishlist-year').value) || null,
      description: document.getElementById('wishlist-description').value.trim() || null,
      condition_wanted: document.getElementById('wishlist-condition').value || null,
      max_price: parseFloat(document.getElementById('wishlist-max-price').value) || null,
      priority: parseInt(document.getElementById('wishlist-priority').value) || 0
    };

    try {
      const response = await Auth.apiRequest('/api/wishlist', {
        method: 'POST',
        body: JSON.stringify(item)
      });

      if (response.ok) {
        const newItem = await response.json();
        Profile.wishlist.unshift(newItem);
        this.renderWishlist();
        Profile.closeModal('add-wishlist-modal');
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to add item');
      }
    } catch (error) {
      console.error('Error adding wishlist item:', error);
      Auth.showError('Failed to add item');
    }
  },

  /**
   * Mark wishlist item as found
   */
  async markWishlistFound(itemId) {
    if (!itemId) {
      console.error('markWishlistFound: No itemId provided');
      return;
    }

    const item = Profile.wishlist.find(i => i.id === itemId);
    if (item) {
      item.is_found = true;
      this.renderWishlist();
    }

    try {
      const response = await Auth.apiRequest(`/api/wishlist/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_found: true })
      });

      if (!response.ok) {
        if (item) item.is_found = false;
        this.renderWishlist();
        const error = await response.json();
        console.error('Error marking item found:', error);
        Auth.showError(error.detail || 'Failed to mark item as found');
      }
    } catch (error) {
      if (item) item.is_found = false;
      this.renderWishlist();
      console.error('Error marking item found:', error);
      Auth.showError('Failed to mark item as found');
    }
  },

  /**
   * Mark wishlist item as unfound (undo found)
   */
  async markWishlistUnfound(itemId) {
    if (!itemId) {
      console.error('markWishlistUnfound: No itemId provided');
      return;
    }

    const item = Profile.wishlist.find(i => i.id === itemId);
    if (item) {
      item.is_found = false;
      this.renderWishlist();
    }

    try {
      const response = await Auth.apiRequest(`/api/wishlist/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_found: false })
      });

      if (!response.ok) {
        if (item) item.is_found = true;
        this.renderWishlist();
        const error = await response.json();
        console.error('Error marking item unfound:', error);
        Auth.showError(error.detail || 'Failed to mark item as unfound');
      }
    } catch (error) {
      if (item) item.is_found = true;
      this.renderWishlist();
      console.error('Error marking item unfound:', error);
      Auth.showError('Failed to mark item as unfound');
    }
  },

  /**
   * Delete wishlist item
   */
  async deleteWishlistItem(itemId) {
    if (!itemId) {
      console.error('deleteWishlistItem: No itemId provided');
      return;
    }

    const itemIndex = Profile.wishlist.findIndex(i => i.id === itemId);
    const removedItem = itemIndex >= 0 ? Profile.wishlist.splice(itemIndex, 1)[0] : null;
    this.renderWishlist();

    try {
      const response = await Auth.apiRequest(`/api/wishlist/${itemId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        if (removedItem) {
          Profile.wishlist.splice(itemIndex, 0, removedItem);
          this.renderWishlist();
        }
        const error = await response.json();
        console.error('Error deleting wishlist item:', error);
        Auth.showError(error.detail || 'Failed to delete item');
      }
    } catch (error) {
      if (removedItem) {
        Profile.wishlist.splice(itemIndex, 0, removedItem);
        this.renderWishlist();
      }
      console.error('Error deleting wishlist item:', error);
      Auth.showError('Failed to delete item');
    }
  }
};

// Export for use
if (typeof window !== 'undefined') window.ProfileUI = ProfileUI;
