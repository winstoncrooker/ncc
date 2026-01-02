/**
 * Global Search Module
 * Handles search functionality with keyboard navigation and dropdown results
 */

const SearchModule = {
  // Configuration
  debounceMs: 300,
  minQueryLength: 2,
  maxQuickResults: 5,

  // State
  debounceTimer: null,
  isOpen: false,
  selectedIndex: -1,
  results: null,
  currentQuery: '',
  isMobileExpanded: false,

  /**
   * Initialize the search module
   */
  init() {
    this.searchInput = document.getElementById('global-search-input');
    this.dropdown = document.getElementById('search-results-dropdown');
    this.clearBtn = document.getElementById('search-clear-btn');
    this.searchContainer = document.getElementById('global-search');
    this.searchIcon = this.searchContainer?.querySelector('.search-icon');

    if (!this.searchInput || !this.dropdown) {
      console.warn('[Search] Search elements not found');
      return;
    }

    this.bindEvents();
    this.checkMobile();
    console.log('[Search] Module initialized');
  },

  /**
   * Check if we're on mobile and set up accordingly
   */
  checkMobile() {
    this.isMobile = window.innerWidth <= 768;
    window.addEventListener('resize', () => {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth <= 768;
      // If switching from mobile to desktop, ensure expanded state is cleared
      if (wasMobile && !this.isMobile && this.searchContainer) {
        this.searchContainer.classList.remove('expanded');
        this.isMobileExpanded = false;
      }
    });
  },

  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Input events
    this.searchInput.addEventListener('input', this.handleInput.bind(this));
    this.searchInput.addEventListener('focus', this.handleFocus.bind(this));
    this.searchInput.addEventListener('keydown', this.handleKeydown.bind(this));

    // Clear button
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', this.clearSearch.bind(this));
    }

    // Mobile: Click on search icon to expand
    if (this.searchIcon) {
      this.searchIcon.addEventListener('click', (event) => {
        if (this.isMobile && !this.isMobileExpanded) {
          event.preventDefault();
          event.stopPropagation();
          this.expandMobileSearch();
        }
      });
    }

    // Click outside to close
    document.addEventListener('click', (event) => {
      if (this.searchContainer && !this.searchContainer.contains(event.target)) {
        this.closeDropdown();
        if (this.isMobile && this.isMobileExpanded) {
          this.collapseMobileSearch();
        }
      }
    });

    // Escape key closes dropdown
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        this.closeDropdown();
        this.searchInput.blur();
        if (this.isMobile && this.isMobileExpanded) {
          this.collapseMobileSearch();
        }
      }
    });
  },

  /**
   * Expand search bar on mobile
   */
  expandMobileSearch() {
    if (this.searchContainer) {
      this.searchContainer.classList.add('expanded');
      this.isMobileExpanded = true;
      setTimeout(() => {
        this.searchInput.focus();
      }, 100);
    }
  },

  /**
   * Collapse search bar on mobile
   */
  collapseMobileSearch() {
    if (this.searchContainer) {
      this.searchContainer.classList.remove('expanded');
      this.isMobileExpanded = false;
    }
  },

  /**
   * Handle input changes with debouncing
   */
  handleInput(event) {
    const query = event.target.value.trim();
    this.currentQuery = query;

    // Show/hide clear button
    if (this.clearBtn) {
      this.clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    }

    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Check minimum length
    if (query.length < this.minQueryLength) {
      this.closeDropdown();
      return;
    }

    // Debounce the search
    this.debounceTimer = setTimeout(() => {
      this.performSearch(query);
    }, this.debounceMs);
  },

  /**
   * Handle focus on search input
   */
  handleFocus() {
    // Show results if we have them and input has content
    if (this.results && this.currentQuery.length >= this.minQueryLength) {
      this.openDropdown();
    }
  },

  /**
   * Handle keyboard navigation
   */
  handleKeydown(event) {
    if (!this.isOpen) {
      if (event.key === 'Enter' && this.currentQuery.length >= this.minQueryLength) {
        this.performSearch(this.currentQuery);
      }
      return;
    }

    const items = this.dropdown.querySelectorAll('.search-result-item');
    const maxIndex = items.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
        this.updateSelection(items);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection(items);
        break;

      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
          items[this.selectedIndex].click();
        } else {
          // Open full search results modal
          this.openFullResults();
        }
        break;

      case 'Tab':
        this.closeDropdown();
        break;
    }
  },

  /**
   * Update visual selection state
   */
  updateSelection(items) {
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
        item.setAttribute('aria-selected', 'false');
      }
    });

    // Update input for screen readers
    this.searchInput.setAttribute('aria-activedescendant',
      this.selectedIndex >= 0 ? `search-result-${this.selectedIndex}` : '');
  },

  /**
   * Perform the search API call
   */
  async performSearch(query) {
    if (!query || query.length < this.minQueryLength) return;

    try {
      this.showLoading();

      const response = await Auth.apiRequest(`/api/search?q=${encodeURIComponent(query)}&limit=${this.maxQuickResults}`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      this.results = await response.json();
      this.renderResults();

    } catch (error) {
      console.error('[Search] Error:', error);
      this.showError('Search failed. Please try again.');
    }
  },

  /**
   * Show loading state in dropdown
   */
  showLoading() {
    this.dropdown.innerHTML = `
      <div class="search-loading">
        <div class="search-spinner"></div>
        <span>Searching...</span>
      </div>
    `;
    this.openDropdown();
  },

  /**
   * Show error message in dropdown
   */
  showError(message) {
    this.dropdown.innerHTML = `
      <div class="search-empty">
        <span>${Utils.escapeHtml(message)}</span>
      </div>
    `;
    this.openDropdown();
  },

  /**
   * Render search results in dropdown
   */
  renderResults() {
    if (!this.results) {
      this.closeDropdown();
      return;
    }

    const { users, collections, posts, total_count } = this.results;

    if (total_count === 0) {
      this.dropdown.innerHTML = `
        <div class="search-empty">
          <span>No results found for "${Utils.escapeHtml(this.currentQuery)}"</span>
        </div>
      `;
      this.openDropdown();
      return;
    }

    let html = '';
    let itemIndex = 0;

    // Users section
    if (users && users.length > 0) {
      html += `<div class="search-section">
        <div class="search-section-header">Users</div>
        ${users.map(user => {
          const index = itemIndex++;
          const avatar = user.picture || Utils.getDefaultAvatar(user.name);
          return `
            <div class="search-result-item" id="search-result-${index}" role="option"
                 onclick="SearchModule.navigateToUser(${user.id})" tabindex="-1">
              <img class="search-result-avatar" src="${Utils.sanitizeImageUrl(avatar)}" alt=""
                   onerror="this.src='${Utils.getDefaultAvatar(user.name)}'">
              <div class="search-result-info">
                <span class="search-result-title">${Utils.escapeHtml(user.name || 'User')}</span>
                ${user.bio ? `<span class="search-result-subtitle">${Utils.escapeHtml(user.bio)}</span>` : ''}
              </div>
              <span class="search-result-type">User</span>
            </div>
          `;
        }).join('')}
      </div>`;
    }

    // Collections section
    if (collections && collections.length > 0) {
      html += `<div class="search-section">
        <div class="search-section-header">Collection Items</div>
        ${collections.map(item => {
          const index = itemIndex++;
          const cover = item.cover || '/images/default-album.png';
          return `
            <div class="search-result-item" id="search-result-${index}" role="option"
                 onclick="SearchModule.navigateToCollection(${item.user_id}, ${item.id})" tabindex="-1">
              <img class="search-result-cover" src="${Utils.sanitizeImageUrl(cover)}" alt=""
                   onerror="this.src='/images/default-album.png'">
              <div class="search-result-info">
                <span class="search-result-title">${Utils.escapeHtml(item.album)}</span>
                <span class="search-result-subtitle">${Utils.escapeHtml(item.artist)}${item.year ? ` (${item.year})` : ''}</span>
              </div>
              <span class="search-result-type">${item.category_name || 'Item'}</span>
            </div>
          `;
        }).join('')}
      </div>`;
    }

    // Posts section
    if (posts && posts.length > 0) {
      html += `<div class="search-section">
        <div class="search-section-header">Forum Posts</div>
        ${posts.map(post => {
          const index = itemIndex++;
          const avatar = post.author_picture || Utils.getDefaultAvatar(post.author_name);
          return `
            <div class="search-result-item" id="search-result-${index}" role="option"
                 onclick="SearchModule.navigateToPost(${post.id})" tabindex="-1">
              <img class="search-result-avatar" src="${Utils.sanitizeImageUrl(avatar)}" alt=""
                   onerror="this.src='${Utils.getDefaultAvatar(post.author_name)}'">
              <div class="search-result-info">
                <span class="search-result-title">${Utils.escapeHtml(post.title)}</span>
                <span class="search-result-subtitle">by ${Utils.escapeHtml(post.author_name || 'Anonymous')} in ${Utils.escapeHtml(post.category_name || 'Forums')}</span>
              </div>
              <span class="search-result-type">Post</span>
            </div>
          `;
        }).join('')}
      </div>`;
    }

    // "View all results" button
    if (total_count > this.maxQuickResults * 3) {
      html += `
        <div class="search-view-all">
          <button class="search-view-all-btn" onclick="SearchModule.openFullResults()">
            View all ${total_count} results
          </button>
        </div>
      `;
    }

    this.dropdown.innerHTML = html;
    this.selectedIndex = -1;
    this.openDropdown();
  },

  /**
   * Open the dropdown
   */
  openDropdown() {
    this.dropdown.style.display = 'block';
    this.isOpen = true;
    this.searchInput.setAttribute('aria-expanded', 'true');
  },

  /**
   * Close the dropdown
   */
  closeDropdown() {
    this.dropdown.style.display = 'none';
    this.isOpen = false;
    this.selectedIndex = -1;
    this.searchInput.setAttribute('aria-expanded', 'false');
    this.searchInput.removeAttribute('aria-activedescendant');
  },

  /**
   * Clear the search input and results
   */
  clearSearch() {
    this.searchInput.value = '';
    this.currentQuery = '';
    this.results = null;
    this.closeDropdown();
    if (this.clearBtn) {
      this.clearBtn.style.display = 'none';
    }
    this.searchInput.focus();
  },

  /**
   * Navigate to a user profile
   */
  navigateToUser(userId) {
    this.closeDropdown();
    // Use the existing profile modal functionality
    if (typeof Profile !== 'undefined' && Profile.viewFriendProfile) {
      Profile.viewFriendProfile(userId);
    } else {
      console.log('[Search] Navigate to user:', userId);
    }
  },

  /**
   * Navigate to a collection item
   */
  navigateToCollection(userId, collectionId) {
    this.closeDropdown();
    // If it's the current user, scroll to their collection and highlight the item
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      // First switch to the profile tab if not already there
      const profileTab = document.querySelector('[data-tab="profile"]');
      if (profileTab) {
        profileTab.click();
      }

      // Wait for tab switch, then scroll and highlight
      setTimeout(() => {
        const collectionSection = document.querySelector('.collection-section');
        if (collectionSection) {
          collectionSection.scrollIntoView({ behavior: 'smooth' });
        }

        // Find and highlight the specific item
        const itemCard = document.querySelector(`.album-card[data-id="${collectionId}"]`);
        if (itemCard) {
          // Add highlight class temporarily
          itemCard.classList.add('search-highlight');
          itemCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Remove highlight after animation
          setTimeout(() => {
            itemCard.classList.remove('search-highlight');
          }, 2000);
        }
      }, 100);
    } else {
      // View the other user's profile
      if (typeof Profile !== 'undefined' && Profile.viewFriendProfile) {
        Profile.viewFriendProfile(userId);
      }
    }
  },

  /**
   * Navigate to a forum post
   */
  navigateToPost(postId) {
    this.closeDropdown();
    // Switch to forums tab and open the post
    const forumsTab = document.querySelector('[data-tab="forums"]');
    if (forumsTab) {
      forumsTab.click();
    }
    // Open post detail modal
    if (typeof Forums !== 'undefined' && Forums.viewPost) {
      setTimeout(() => {
        Forums.viewPost(postId);
      }, 100);
    }
  },

  /**
   * Open full search results modal/page
   */
  openFullResults() {
    this.closeDropdown();
    // For now, just log - could implement a full results modal later
    console.log('[Search] Open full results for:', this.currentQuery);
    // Could trigger a modal or navigate to a search results page
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  SearchModule.init();
});

// Export for other modules
if (typeof window !== 'undefined') {
  window.SearchModule = SearchModule;
}
