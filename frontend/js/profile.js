/**
 * Niche Collector Connector - Profile Page Logic
 */

const Profile = {
  // State
  profile: null,
  collection: [],
  showcase: [],
  chatHistory: [],
  friends: [],
  friendRequests: [],
  pendingRequestCount: 0,
  conversations: [],
  currentConversation: null,
  currentConversationMessages: [],
  unreadCount: 0,
  pollingInterval: null,
  searchedFriend: null,
  // Category profile state
  userCategories: [],
  currentCategorySlug: null,
  currentCategoryProfile: null,

  // Category-specific terminology
  categoryTerms: {
    'vinyl': {
      itemSingular: 'record',
      itemPlural: 'records',
      field1Label: 'Artist',
      field1Placeholder: 'Artist name',
      field2Label: 'Album',
      field2Placeholder: 'Album title',
      addTitle: 'Add Record',
      emptyIcon: '💿',
      showcaseEmpty: 'No albums in your showcase yet',
      showcaseHint: 'Add up to 8 albums from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add albums or search Discogs',
      aiCapabilities: [
        'Writing your bio',
        'Adding records to your collection',
        'Finding albums on Discogs',
        'Choosing what to showcase'
      ]
    },
    'trading-cards': {
      itemSingular: 'card',
      itemPlural: 'cards',
      field1Label: 'Set/Brand',
      field1Placeholder: 'e.g. Pokemon Base Set',
      field2Label: 'Card Name',
      field2Placeholder: 'Card name',
      addTitle: 'Add Card',
      emptyIcon: '🃏',
      showcaseEmpty: 'No cards in your showcase yet',
      showcaseHint: 'Add up to 8 cards from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add cards or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding cards to your collection',
        'Tracking card values and grades',
        'Building deck lists'
      ]
    },
    'cars': {
      itemSingular: 'vehicle',
      itemPlural: 'vehicles',
      field1Label: 'Make',
      field1Placeholder: 'e.g. Ford, Toyota',
      field2Label: 'Model',
      field2Placeholder: 'e.g. Mustang, Supra',
      addTitle: 'Add Vehicle',
      emptyIcon: '🚗',
      showcaseEmpty: 'No vehicles in your showcase yet',
      showcaseHint: 'Add up to 8 vehicles from your collection to feature here',
      collectionEmpty: 'Your garage is empty',
      collectionHint: 'Use the AI assistant to add vehicles or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding vehicles to your garage',
        'Tracking mods and builds',
        'Choosing what to showcase'
      ]
    },
    'sneakers': {
      itemSingular: 'pair',
      itemPlural: 'pairs',
      field1Label: 'Brand',
      field1Placeholder: 'e.g. Nike, Adidas',
      field2Label: 'Model/Colorway',
      field2Placeholder: 'e.g. Air Jordan 1 Chicago',
      addTitle: 'Add Sneakers',
      emptyIcon: '👟',
      showcaseEmpty: 'No sneakers in your showcase yet',
      showcaseHint: 'Add up to 8 pairs from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add sneakers or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding kicks to your collection',
        'Tracking release dates and drops',
        'Choosing grails to showcase'
      ]
    },
    'watches': {
      itemSingular: 'watch',
      itemPlural: 'watches',
      field1Label: 'Brand',
      field1Placeholder: 'e.g. Rolex, Omega',
      field2Label: 'Model',
      field2Placeholder: 'e.g. Submariner, Speedmaster',
      addTitle: 'Add Watch',
      emptyIcon: '⌚',
      showcaseEmpty: 'No watches in your showcase yet',
      showcaseHint: 'Add up to 8 watches from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add watches or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding watches to your collection',
        'Learning about movements and complications',
        'Choosing timepieces to showcase'
      ]
    },
    'comics': {
      itemSingular: 'comic',
      itemPlural: 'comics',
      field1Label: 'Publisher/Series',
      field1Placeholder: 'e.g. Marvel, Amazing Spider-Man',
      field2Label: 'Issue/Title',
      field2Placeholder: 'e.g. #300, First Appearance',
      addTitle: 'Add Comic',
      emptyIcon: '📚',
      showcaseEmpty: 'No comics in your showcase yet',
      showcaseHint: 'Add up to 8 comics from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add comics or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding comics to your long boxes',
        'Finding key issues and first appearances',
        'Choosing slabs to showcase'
      ]
    },
    'video-games': {
      itemSingular: 'game',
      itemPlural: 'games',
      field1Label: 'Platform',
      field1Placeholder: 'e.g. PS5, Nintendo Switch',
      field2Label: 'Title',
      field2Placeholder: 'Game title',
      addTitle: 'Add Game',
      emptyIcon: '🎮',
      showcaseEmpty: 'No games in your showcase yet',
      showcaseHint: 'Add up to 8 games from your collection to feature here',
      collectionEmpty: 'Your library is empty',
      collectionHint: 'Use the AI assistant to add games or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding games to your library',
        'Managing your backlog',
        'Choosing favorites to showcase'
      ]
    },
    'coins': {
      itemSingular: 'coin',
      itemPlural: 'coins',
      field1Label: 'Country/Type',
      field1Placeholder: 'e.g. USA, Morgan Dollar',
      field2Label: 'Year/Denomination',
      field2Placeholder: 'e.g. 1921, $1',
      addTitle: 'Add Coin',
      emptyIcon: '🪙',
      showcaseEmpty: 'No coins in your showcase yet',
      showcaseHint: 'Add up to 8 coins from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add coins or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding coins to your collection',
        'Learning about mint marks and varieties',
        'Choosing pieces to showcase'
      ]
    }
  },

  /**
   * Get terminology for current category
   */
  getTerms() {
    const slug = this.currentCategorySlug || 'vinyl';
    return this.categoryTerms[slug] || this.categoryTerms['vinyl'];
  },

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
    this.setupCropperListeners();

    // Load profile and user categories first (needed for category filtering)
    await Promise.all([
      this.loadProfile(),
      this.loadUserCategories(),
      this.loadFriends(),
      this.loadFriendRequests(),
      this.loadUnreadCount()
    ]);

    // Now load collection and showcase with category filter applied
    await Promise.all([
      this.loadCollection(),
      this.loadShowcase()
    ]);

    // Render user menu
    this.renderUserMenu();

    // Start polling for updates (messages, friend requests, friends)
    this.startPolling();

    // Fill in missing album covers in background
    this.fillMissingCovers();

    // Restore saved main tab (Profile/Forums)
    if (typeof Forums !== 'undefined') {
      Forums.restoreSavedTab();
    }
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

    // Handle mobile keyboard - resize AI sidebar when keyboard opens
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const sidebar = document.getElementById('ai-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          // Adjust sidebar height to visible viewport
          sidebar.style.height = `${window.visualViewport.height}px`;
          // Scroll input into view
          const input = document.getElementById('ai-input');
          if (input && document.activeElement === input) {
            setTimeout(() => input.scrollIntoView({ block: 'end' }), 100);
          }
        }
      });

      window.visualViewport.addEventListener('scroll', () => {
        const sidebar = document.getElementById('ai-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.style.transform = `translateY(${window.visualViewport.offsetTop}px)`;
        }
      });
    }

    // AI Sidebar
    addListener('ai-toggle-btn', 'click', () => {
      document.getElementById('ai-sidebar')?.classList.add('open');
      document.getElementById('sidebar-overlay')?.classList.add('show');
    });

    addListener('ai-close-btn', 'click', () => {
      const sidebar = document.getElementById('ai-sidebar');
      if (sidebar) {
        sidebar.classList.remove('open');
        sidebar.style.height = '';
        sidebar.style.transform = '';
      }
      document.getElementById('sidebar-overlay')?.classList.remove('show');
    });

    addListener('sidebar-overlay', 'click', () => {
      const sidebar = document.getElementById('ai-sidebar');
      if (sidebar) {
        sidebar.classList.remove('open');
        sidebar.style.height = '';
        sidebar.style.transform = '';
      }
      document.getElementById('sidebar-overlay')?.classList.remove('show');
    });

    // AI Chat form
    addListener('ai-input-form', 'submit', (e) => {
      e.preventDefault();
      this.sendChatMessage();
    });

    // AI file upload for bulk album adding
    addListener('ai-upload-btn', 'click', () => {
      document.getElementById('ai-file-input')?.click();
    });

    addListener('ai-file-input', 'change', (e) => {
      if (e.target.files[0]) {
        this.handleAlbumFileUpload(e.target.files[0]);
        e.target.value = ''; // Reset input so same file can be uploaded again
      }
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

    // Friends
    addListener('add-friend-btn', 'click', () => this.openAddFriendModal());
    addListener('add-friend-close', 'click', () => this.closeModal('add-friend-modal'));
    addListener('add-friend-cancel', 'click', () => this.closeModal('add-friend-modal'));
    addListener('add-friend-confirm', 'click', () => this.confirmAddFriend());

    // Friend name input with debounce
    let friendSearchTimeout;
    addListener('friend-name-input', 'input', (e) => {
      clearTimeout(friendSearchTimeout);
      const name = e.target.value.trim();
      if (name.length > 0) {
        friendSearchTimeout = setTimeout(() => this.searchFriend(name), 300);
      } else {
        document.getElementById('friend-search-result').innerHTML = '';
        document.getElementById('add-friend-confirm').disabled = true;
        this.searchedFriend = null;
      }
    });

    // View Profile modal
    addListener('view-profile-close', 'click', () => this.closeModal('view-profile-modal'));
    addListener('view-profile-message', 'click', () => this.messageFromProfile());
    addListener('view-profile-unfollow', 'click', () => this.unfollowFromProfile());
    addListener('view-collection-search', 'input', (e) => this.filterViewCollection(e.target.value));

    // Collection search
    addListener('collection-search-input', 'input', (e) => this.filterCollection(e.target.value));

    // Messages Sidebar
    addListener('messages-toggle-btn', 'click', () => this.openMessagesSidebar());
    addListener('messages-close-btn', 'click', () => this.closeMessagesSidebar());
    addListener('conversation-back-btn', 'click', () => this.backToConversations());
    addListener('message-form', 'submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    // Category profile switcher
    addListener('category-profile-select', 'change', (e) => {
      this.switchCategoryProfile(e.target.value);
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
   * Load user's joined categories for the profile switcher
   */
  async loadUserCategories() {
    try {
      const response = await Auth.apiRequest('/api/interests/me');
      if (!response.ok) return;

      const data = await response.json();

      // Extract unique categories from interests
      const categoryMap = new Map();
      data.interests.forEach(interest => {
        if (interest.category_id && !categoryMap.has(interest.category_id)) {
          categoryMap.set(interest.category_id, {
            id: interest.category_id,
            slug: interest.category_slug,
            name: interest.category_name,
            icon: interest.category_icon
          });
        }
      });

      this.userCategories = Array.from(categoryMap.values());

      // Load saved category from localStorage (if user was on a category before)
      const savedCategory = localStorage.getItem('ncc_current_category');

      // Apply UI updates for the saved or first category
      if (this.userCategories.length > 0) {
        // Check if saved category is still valid (user still has it)
        const validSavedCategory = savedCategory && this.userCategories.some(c => c.slug === savedCategory);
        const defaultCategory = validSavedCategory ? savedCategory : this.userCategories[0].slug;
        this.currentCategorySlug = defaultCategory;
        this.updateUIForCategory(defaultCategory);
      } else {
        // Default to vinyl if no categories joined
        this.updateUIForCategory('vinyl');
      }

      // Render switcher after setting current category
      this.renderCategorySwitcher();

    } catch (error) {
      console.error('Error loading user categories:', error);
      // Default to vinyl on error
      this.updateUIForCategory('vinyl');
    }
  },

  /**
   * Render the category profile switcher dropdown
   */
  renderCategorySwitcher() {
    const select = document.getElementById('category-profile-select');
    const section = document.getElementById('category-switcher-section');

    if (!select || !section) return;

    // Hide switcher if user has 1 or fewer categories
    if (this.userCategories.length <= 1) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Populate dropdown with all user categories, selecting the current one
    select.innerHTML = this.userCategories.map(cat => `
      <option value="${cat.slug}" ${cat.slug === this.currentCategorySlug ? 'selected' : ''}>${cat.icon || ''} ${cat.name}</option>
    `).join('');
  },

  /**
   * Switch to a different category profile
   */
  async switchCategoryProfile(categorySlug) {
    if (!categorySlug) return;

    this.currentCategorySlug = categorySlug;

    // Save to localStorage so user returns to this category on page reload
    localStorage.setItem('ncc_current_category', categorySlug);

    try {
      // Load category-specific profile (optional)
      const profileRes = await Auth.apiRequest(`/api/profile/categories/${categorySlug}`);
      if (profileRes.ok) {
        this.currentCategoryProfile = await profileRes.json();
      }

      // Load collection filtered by category (uses the updated loadCollection method)
      await this.loadCollection();

      // Reload showcase for this category
      await this.loadShowcase();

      // Update all UI elements for this category
      this.updateUIForCategory(categorySlug);

      // Reset AI chat for new category context
      this.resetAIChat();

    } catch (error) {
      console.error('Error switching category profile:', error);
    }
  },

  /**
   * Update all UI elements for a category
   */
  updateUIForCategory(categorySlug) {
    // Update section headers
    this.updateSectionHeaders(categorySlug);

    // Apply category color scheme
    this.applyCategoryColor(categorySlug);

    // Update "Add Record" buttons
    this.updateAddButtons(categorySlug);

    // Update AI chat welcome checklist
    this.updateAIWelcome();
  },

  /**
   * Update AI chat welcome message with category-specific capabilities
   */
  updateAIWelcome() {
    const terms = this.getTerms();
    const welcomeList = document.querySelector('.ai-welcome ul');

    if (welcomeList && terms.aiCapabilities) {
      welcomeList.innerHTML = terms.aiCapabilities.map(cap => `<li>${cap}</li>`).join('');
    }
  },

  /**
   * Reset AI chat to welcome state (used when switching categories)
   */
  resetAIChat() {
    const container = document.getElementById('ai-chat-container');
    if (!container) return;

    const terms = this.getTerms();

    // Reset to welcome message with category-specific capabilities
    container.innerHTML = `
      <div class="ai-welcome">
        <div class="welcome-icon">👋</div>
        <h4>Hey there!</h4>
        <p>I can help you with:</p>
        <ul>
          ${terms.aiCapabilities.map(cap => `<li>${cap}</li>`).join('')}
        </ul>
      </div>
    `;
  },

  /**
   * Update Add buttons text based on category
   */
  updateAddButtons(categorySlug) {
    const terms = this.getTerms();
    const capitalizedSingular = terms.itemSingular.charAt(0).toUpperCase() + terms.itemSingular.slice(1);

    // Update showcase add button
    const showcaseBtn = document.getElementById('add-to-showcase-btn');
    if (showcaseBtn) {
      showcaseBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add ${capitalizedSingular}
      `;
    }

    // Update collection add button
    const collectionBtn = document.getElementById('add-record-btn');
    if (collectionBtn) {
      collectionBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add ${capitalizedSingular}
      `;
    }

    // Update modal title
    const modalTitle = document.querySelector('#add-record-modal h3');
    if (modalTitle) {
      modalTitle.textContent = terms.addTitle;
    }

    // Update modal field labels and placeholders
    const artistLabel = document.querySelector('label[for="manual-artist"]');
    const artistInput = document.getElementById('manual-artist');
    if (artistLabel) artistLabel.textContent = terms.field1Label + ' *';
    if (artistInput) artistInput.placeholder = terms.field1Placeholder;

    const albumLabel = document.querySelector('label[for="manual-album"]');
    const albumInput = document.getElementById('manual-album');
    if (albumLabel) albumLabel.textContent = terms.field2Label + ' *';
    if (albumInput) albumInput.placeholder = terms.field2Placeholder;

    // Update showcase empty state text
    const showcaseEmpty = document.getElementById('showcase-empty');
    if (showcaseEmpty) {
      showcaseEmpty.innerHTML = `
        <div class="empty-icon">${terms.emptyIcon}</div>
        <p>${terms.showcaseEmpty}</p>
        <span>${terms.showcaseHint}</span>
      `;
    }

    // Update collection empty state text
    const collectionEmpty = document.getElementById('collection-empty');
    if (collectionEmpty) {
      collectionEmpty.innerHTML = `
        <div class="empty-icon">${terms.emptyIcon}</div>
        <p>${terms.collectionEmpty}</p>
        <span>${terms.collectionHint}</span>
      `;
    }
  },

  /**
   * Apply category-specific color scheme
   */
  applyCategoryColor(categorySlug) {
    const category = this.userCategories.find(c => c.slug === categorySlug);

    // Default colors for each category
    const categoryColors = {
      'vinyl': '#1db954',         // Spotify green
      'trading-cards': '#ff6b35', // Orange
      'cars': '#e63946',          // Red
      'sneakers': '#7b2cbf',      // Purple
      'watches': '#2a9d8f',       // Teal
      'comics': '#f77f00',        // Amber
      'video-games': '#4361ee',   // Blue
      'coins': '#d4a373'          // Gold
    };

    const color = categoryColors[categorySlug] || '#1db954';

    // Update CSS custom property
    document.documentElement.style.setProperty('--accent', color);

    // Update accent-dark (slightly darker version)
    const darkerColor = this.darkenColor(color, 15);
    document.documentElement.style.setProperty('--accent-dark', darkerColor);
  },

  /**
   * Darken a hex color by a percentage
   */
  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  },

  /**
   * Update section headers based on current category
   */
  updateSectionHeaders(categorySlug) {
    // Get category info
    const category = this.userCategories.find(c => c.slug === categorySlug);
    const sectionNames = typeof TemplateRegistry !== 'undefined' ?
      TemplateRegistry.getSections(categorySlug) :
      ['Showcase', 'Collection'];

    // Update showcase section header
    const showcaseHeader = document.querySelector('.showcase-section h2');
    if (showcaseHeader) {
      showcaseHeader.innerHTML = `<span class="section-icon">✨</span> ${sectionNames[0] || 'Showcase'}`;
    }

    // Update collection section header
    const collectionHeader = document.querySelector('.collection-section h2');
    if (collectionHeader && category) {
      const count = this.collection.length;
      collectionHeader.innerHTML = `
        <span class="section-icon">📚</span>
        ${sectionNames[1] || 'Collection'}
        <span class="collection-count">${count}</span>
      `;
    }
  },

  /**
   * Get current category ID from slug
   */
  getCurrentCategoryId() {
    if (!this.currentCategorySlug || !this.userCategories.length) return null;
    const category = this.userCategories.find(c => c.slug === this.currentCategorySlug);
    return category ? category.id : null;
  },

  /**
   * Load user collection (filtered by current category if set)
   */
  async loadCollection() {
    try {
      const categoryId = this.getCurrentCategoryId();
      const url = categoryId
        ? `/api/collection/?category_id=${categoryId}`
        : '/api/collection/';

      const response = await Auth.apiRequest(url);
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
    const terms = this.getTerms();

    if (countEl) countEl.textContent = this.collection.length;
    if (!grid) return;

    if (this.collection.length === 0) {
      grid.innerHTML = `
        <div class="collection-empty" id="collection-empty">
          <div class="empty-icon">${terms.emptyIcon}</div>
          <p>${terms.collectionEmpty}</p>
          <span>${terms.collectionHint}</span>
        </div>
      `;
      return;
    }

    const isVinyl = this.currentCategorySlug === 'vinyl';
    grid.innerHTML = this.collection.map(album => `
      <div class="album-card" data-id="${album.id}">
        <img src="${album.cover || this.getPlaceholderCover(album)}"
             alt="${album.album}" loading="lazy"
             onerror="this.src='${this.getPlaceholderCover(album)}'">
        <div class="album-info">
          <p class="album-title">${this.escapeHtml(album.album)}</p>
          <p class="album-artist">${this.escapeHtml(album.artist)}</p>
        </div>
        <button class="image-btn" onclick="Profile.showImageModal(${album.id})" title="Add/change image">📷</button>
        ${isVinyl ? `<button class="refresh-btn" onclick="Profile.refreshCover(${album.id})" title="Find cover">↻</button>` : ''}
        <button class="remove-btn" onclick="Profile.removeFromCollection(${album.id})" title="Remove">&times;</button>
      </div>
    `).join('');

    // Add click to show in showcase option
    grid.querySelectorAll('.album-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-btn') && !e.target.closest('.refresh-btn') && !e.target.closest('.image-btn')) {
          const id = parseInt(card.dataset.id);
          this.addToShowcase(id);
        }
      });
    });
  },

  /**
   * Add album to collection in alphabetical order and re-render
   */
  addAlbumSorted(album) {
    // Find insertion index for alphabetical order (by artist, then album)
    const key = `${album.artist.toLowerCase()} ${album.album.toLowerCase()}`;
    let insertIndex = this.collection.findIndex(a => {
      const aKey = `${a.artist.toLowerCase()} ${a.album.toLowerCase()}`;
      return aKey > key;
    });

    if (insertIndex === -1) {
      this.collection.push(album);
    } else {
      this.collection.splice(insertIndex, 0, album);
    }

    this.renderCollection();
  },

  /**
   * Fill in missing album covers in background (rate limited)
   */
  async fillMissingCovers() {
    // Find albums without covers
    const missingCovers = this.collection.filter(a => !a.cover);

    if (missingCovers.length === 0) return;

    const total = missingCovers.length;
    const delayMs = 1200; // 1.2 seconds between requests
    let completed = 0;
    let successCount = 0;

    // Show progress bar
    const progressEl = document.getElementById('cover-progress');
    const progressText = document.getElementById('cover-progress-text');
    const progressCount = document.getElementById('cover-progress-count');
    const progressEta = document.getElementById('cover-progress-eta');
    const progressFill = document.getElementById('cover-progress-fill');

    if (progressEl) {
      progressEl.style.display = 'block';
      progressCount.textContent = `0 / ${total}`;
      progressFill.style.width = '0%';
    }

    const formatEta = (seconds) => {
      if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
      const mins = Math.floor(seconds / 60);
      const secs = Math.ceil(seconds % 60);
      return `~${mins}m ${secs}s remaining`;
    };

    console.log(`[Covers] Filling ${total} missing covers...`);

    for (let i = 0; i < missingCovers.length; i++) {
      const album = missingCovers[i];

      // Update progress UI
      if (progressEl) {
        progressText.textContent = `Fetching: ${album.artist} - ${album.album}`;
        progressCount.textContent = `${completed} / ${total}`;
        const remainingSeconds = (total - completed) * (delayMs / 1000);
        progressEta.textContent = formatEta(remainingSeconds);
        progressFill.style.width = `${(completed / total) * 100}%`;
      }

      try {
        // Search Discogs for cover (globally cached)
        const discogsResponse = await Auth.apiRequest(
          `/api/discogs/search?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.album)}`
        );

        if (discogsResponse.ok) {
          const data = await discogsResponse.json();

          if (data.cover) {
            // Update album in collection
            album.cover = data.cover;
            if (data.year && !album.year) album.year = data.year;
            if (data.id && !album.discogs_id) album.discogs_id = data.id;

            // Update in database
            await Auth.apiRequest(`/api/collection/${album.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                cover: data.cover,
                year: data.year || album.year,
                discogs_id: data.id || album.discogs_id
              })
            });

            // Re-render to show new cover
            this.renderCollection();
            successCount++;
            console.log(`[Covers] Updated: ${album.artist} - ${album.album}`);
          }
        }
      } catch (err) {
        console.log(`[Covers] Failed: ${album.artist} - ${album.album}`, err);
      }

      completed++;

      // Rate limit: wait between requests (skip delay on last item)
      if (i < missingCovers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Hide progress bar and show completion
    if (progressEl) {
      progressText.textContent = `Done! Updated ${successCount} of ${total} covers`;
      progressCount.textContent = `${total} / ${total}`;
      progressEta.textContent = '';
      progressFill.style.width = '100%';

      // Hide after 3 seconds
      setTimeout(() => {
        progressEl.style.display = 'none';
      }, 3000);
    }

    console.log(`[Covers] Done filling missing covers (${successCount}/${total})`);
  },

  /**
   * Manually refresh cover for a single album
   */
  async refreshCover(albumId) {
    const album = this.collection.find(a => a.id === albumId);
    if (!album) return;

    // Find the button and show loading state
    const btn = document.querySelector(`.album-card[data-id="${albumId}"] .refresh-btn`);
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
    }

    try {
      const discogsResponse = await Auth.apiRequest(
        `/api/discogs/search?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.album)}`
      );

      if (discogsResponse.ok) {
        const data = await discogsResponse.json();

        if (data.cover) {
          // Update album in collection
          album.cover = data.cover;
          if (data.year && !album.year) album.year = data.year;
          if (data.id && !album.discogs_id) album.discogs_id = data.id;

          // Update in database
          await Auth.apiRequest(`/api/collection/${album.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              cover: data.cover,
              year: data.year || album.year,
              discogs_id: data.id || album.discogs_id
            })
          });

          // Re-render to show new cover
          this.renderCollection();
          console.log(`[Cover] Refreshed: ${album.artist} - ${album.album}`);
        } else {
          // No cover found
          if (btn) {
            btn.classList.remove('loading');
            btn.textContent = '✗';
            setTimeout(() => {
              btn.textContent = '↻';
              btn.disabled = false;
            }, 2000);
          }
        }
      } else {
        // API error
        if (btn) {
          btn.classList.remove('loading');
          btn.textContent = '✗';
          setTimeout(() => {
            btn.textContent = '↻';
            btn.disabled = false;
          }, 2000);
        }
      }
    } catch (err) {
      console.error(`[Cover] Failed to refresh: ${album.artist} - ${album.album}`, err);
      if (btn) {
        btn.classList.remove('loading');
        btn.textContent = '✗';
        setTimeout(() => {
          btn.textContent = '↻';
          btn.disabled = false;
        }, 2000);
      }
    }
  },

  /**
   * Show image modal for adding/changing album cover
   */
  showImageModal(albumId) {
    const album = this.collection.find(a => a.id === albumId);
    if (!album) return;

    this.editingImageAlbumId = albumId;

    // Create modal if it doesn't exist
    let modal = document.getElementById('image-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'image-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
          <button class="modal-close" onclick="Profile.hideImageModal()">&times;</button>
          <h3>Add/Change Image</h3>
          <p id="image-modal-item" style="color: #888; margin-bottom: 20px;"></p>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: #aaa;">Image URL</label>
            <input type="url" id="image-url-input" placeholder="Paste image URL here..."
                   style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444;
                          border-radius: 8px; color: #fff; box-sizing: border-box;">
          </div>

          <div style="text-align: center; margin-bottom: 20px; color: #666;">— or —</div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: #aaa;">Upload Image</label>
            <input type="file" id="image-file-input" accept="image/*"
                   style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444;
                          border-radius: 8px; color: #fff; box-sizing: border-box;">
          </div>

          <div id="image-preview-container" style="margin-bottom: 20px; display: none;">
            <img id="image-preview" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
          </div>

          <div style="display: flex; gap: 10px;">
            <button onclick="Profile.hideImageModal()"
                    style="flex: 1; padding: 12px; background: #333; border: none; border-radius: 8px;
                           color: #fff; cursor: pointer;">Cancel</button>
            <button onclick="Profile.saveImage()" id="save-image-btn"
                    style="flex: 1; padding: 12px; background: var(--accent-color, #1db954); border: none;
                           border-radius: 8px; color: #fff; cursor: pointer; font-weight: 600;">Save</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Add event listeners for preview
      document.getElementById('image-url-input').addEventListener('input', (e) => {
        this.previewImage(e.target.value);
      });

      document.getElementById('image-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.previewImage(ev.target.result);
            document.getElementById('image-url-input').value = '';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Set item name
    document.getElementById('image-modal-item').textContent = `${album.artist} - ${album.album}`;
    document.getElementById('image-url-input').value = album.cover || '';
    document.getElementById('image-file-input').value = '';

    if (album.cover) {
      this.previewImage(album.cover);
    } else {
      document.getElementById('image-preview-container').style.display = 'none';
    }

    modal.classList.add('open');
  },

  /**
   * Preview image in modal
   */
  previewImage(src) {
    const container = document.getElementById('image-preview-container');
    const preview = document.getElementById('image-preview');

    if (src) {
      preview.src = src;
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  },

  /**
   * Hide image modal
   */
  hideImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) modal.classList.remove('open');
    this.editingImageAlbumId = null;
  },

  /**
   * Save image to collection item
   */
  async saveImage() {
    if (!this.editingImageAlbumId) return;

    const album = this.collection.find(a => a.id === this.editingImageAlbumId);
    if (!album) return;

    const urlInput = document.getElementById('image-url-input');
    const fileInput = document.getElementById('image-file-input');
    const btn = document.getElementById('save-image-btn');

    let imageUrl = urlInput.value.trim();

    // If file was uploaded, we need to upload it first
    if (fileInput.files[0]) {
      btn.textContent = 'Uploading...';
      btn.disabled = true;

      try {
        // Read file as base64
        const file = fileInput.files[0];
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const uploadResponse = await Auth.apiRequest('/api/uploads/image', {
          method: 'POST',
          body: JSON.stringify({
            image: base64,
            type: 'item'
          })
        });

        if (uploadResponse.ok) {
          const data = await uploadResponse.json();
          imageUrl = data.url;
        } else {
          throw new Error('Upload failed');
        }
      } catch (err) {
        console.error('Image upload error:', err);
        alert('Failed to upload image. Try using an image URL instead.');
        btn.textContent = 'Save';
        btn.disabled = false;
        return;
      }
    }

    if (!imageUrl) {
      alert('Please enter an image URL or upload a file');
      return;
    }

    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      // Update in database
      const response = await Auth.apiRequest(`/api/collection/${album.id}`, {
        method: 'PUT',
        body: JSON.stringify({ cover: imageUrl })
      });

      if (response.ok) {
        // Update local data
        album.cover = imageUrl;
        this.renderCollection();
        this.renderShowcase();
        this.hideImageModal();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error('Save image error:', err);
      alert('Failed to save image');
    }

    btn.textContent = 'Save';
    btn.disabled = false;
  },

  /**
   * Load showcase (filtered by current category if set)
   */
  async loadShowcase() {
    try {
      const categoryId = this.getCurrentCategoryId();
      const url = categoryId
        ? `/api/profile/me/showcase?category_id=${categoryId}`
        : '/api/profile/me/showcase';

      const response = await Auth.apiRequest(url);
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
    const terms = this.getTerms();

    if (this.showcase.length === 0) {
      grid.innerHTML = `
        <div class="showcase-empty" id="showcase-empty">
          <div class="empty-icon">${terms.emptyIcon}</div>
          <p>${terms.showcaseEmpty}</p>
          <span>${terms.showcaseHint}</span>
        </div>
      `;
      return;
    }

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

  // Cropper state
  cropper: null,
  cropperType: null, // 'profile' or 'background'

  /**
   * Handle profile photo upload - opens cropper
   */
  handlePhotoUpload(file) {
    this.openCropper(file, 'profile');
  },

  /**
   * Handle background image upload - opens cropper
   */
  handleBackgroundUpload(file) {
    this.openCropper(file, 'background');
  },

  /**
   * Open image cropper modal
   */
  openCropper(file, type) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.cropperType = type;

      // Update modal title
      document.getElementById('cropper-title').textContent =
        type === 'profile' ? 'Adjust Profile Picture' : 'Adjust Background Image';

      // Get image element
      const cropperImage = document.getElementById('cropper-image');

      // Destroy previous cropper if exists
      if (this.cropper) {
        this.cropper.destroy();
        this.cropper = null;
      }

      // Open modal
      const modal = document.getElementById('cropper-modal');
      modal.classList.add('open');
      if (type === 'background') {
        modal.classList.add('background-mode');
      } else {
        modal.classList.remove('background-mode');
      }

      // Initialize cropper function
      const initCropper = () => {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          this.cropper = new Cropper(cropperImage, {
            aspectRatio: type === 'profile' ? 1 : 16/9,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.9,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
          });
        }, 100);
      };

      // Set up onload before changing src
      cropperImage.onload = initCropper;

      // Reset src to force reload (add timestamp to prevent caching)
      cropperImage.src = '';
      cropperImage.src = e.target.result;

      // Also handle case where image loads synchronously (cached)
      if (cropperImage.complete && cropperImage.naturalHeight !== 0) {
        initCropper();
      }
    };
    reader.readAsDataURL(file);
  },

  /**
   * Setup cropper event listeners
   */
  setupCropperListeners() {
    const addListener = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };

    addListener('cropper-modal-close', 'click', () => this.closeCropper());
    addListener('cropper-cancel', 'click', () => this.closeCropper());

    addListener('crop-rotate-left', 'click', () => {
      if (this.cropper) this.cropper.rotate(-90);
    });

    addListener('crop-rotate-right', 'click', () => {
      if (this.cropper) this.cropper.rotate(90);
    });

    addListener('crop-zoom-in', 'click', () => {
      if (this.cropper) this.cropper.zoom(0.1);
    });

    addListener('crop-zoom-out', 'click', () => {
      if (this.cropper) this.cropper.zoom(-0.1);
    });

    addListener('crop-reset', 'click', () => {
      if (this.cropper) this.cropper.reset();
    });

    addListener('cropper-save', 'click', () => this.saveCroppedImage());
  },

  /**
   * Close cropper modal
   */
  closeCropper() {
    document.getElementById('cropper-modal').classList.remove('open');
    document.getElementById('cropper-modal').classList.remove('background-mode');
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
    this.cropperType = null;
  },

  /**
   * Save cropped image - upload to R2
   */
  async saveCroppedImage() {
    if (!this.cropper) return;

    const saveBtn = document.getElementById('cropper-save');
    const btnText = saveBtn.querySelector('.btn-text');
    const btnLoading = saveBtn.querySelector('.btn-loading');

    try {
      // Show loading state
      btnText.style.display = 'none';
      btnLoading.style.display = 'inline-flex';
      saveBtn.disabled = true;

      // Get cropped canvas
      const canvas = this.cropper.getCroppedCanvas({
        width: this.cropperType === 'profile' ? 400 : 1200,
        height: this.cropperType === 'profile' ? 400 : 675,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.9);

      // Upload to server
      const response = await Auth.apiRequest('/api/uploads/image', {
        method: 'POST',
        body: JSON.stringify({
          image: base64,
          type: this.cropperType
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Update UI
        if (this.cropperType === 'profile') {
          document.getElementById('profile-picture').src = data.url;
          if (this.profile) this.profile.picture = data.url;
        } else {
          document.getElementById('hero-background').style.backgroundImage = `url(${data.url})`;
          if (this.profile) this.profile.background_image = data.url;
        }

        this.closeCropper();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      // Reset button state
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      saveBtn.disabled = false;
    }
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

    // Only show Discogs search tab for vinyl category
    const isVinyl = this.currentCategorySlug === 'vinyl';
    const discogsTab = document.querySelector('#add-record-modal .tab-btn[data-tab="search"]');
    const discogsContent = document.getElementById('tab-search');

    if (discogsTab) {
      discogsTab.style.display = isVinyl ? '' : 'none';
    }

    // If not vinyl, ensure manual tab is active
    if (!isVinyl) {
      const manualTab = document.querySelector('#add-record-modal .tab-btn[data-tab="manual"]');
      const manualContent = document.getElementById('tab-manual');

      document.querySelectorAll('#add-record-modal .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#add-record-modal .tab-content').forEach(c => c.classList.remove('active'));

      if (manualTab) manualTab.classList.add('active');
      if (manualContent) manualContent.classList.add('active');
    }

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
      const categoryId = this.getCurrentCategoryId();
      const response = await Auth.apiRequest('/api/collection/', {
        method: 'POST',
        body: JSON.stringify({
          artist,
          album,
          year: year ? parseInt(year) : null,
          cover: cover || null,
          category_id: categoryId
        })
      });

      if (response.ok) {
        const newAlbum = await response.json();
        this.addAlbumSorted(newAlbum);
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
      const categoryId = this.getCurrentCategoryId();
      const response = await Auth.apiRequest('/api/collection/', {
        method: 'POST',
        body: JSON.stringify({
          ...albumData,
          category_id: categoryId
        })
      });

      if (response.ok) {
        const newAlbum = await response.json();
        this.addAlbumSorted(newAlbum);
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
    const terms = this.getTerms();

    // Check if already in showcase
    if (this.showcase.find(s => s.collection_id === collectionId)) {
      alert(`This ${terms.itemSingular} is already in your showcase`);
      return;
    }

    // Check showcase limit
    if (this.showcase.length >= 8) {
      alert(`Showcase limit reached (max 8 ${terms.itemPlural}). Remove one to add another.`);
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
   * Remove from showcase (no confirmation popup)
   */
  async removeFromShowcase(showcaseId) {
    try {
      const response = await Auth.apiRequest(`/api/profile/me/showcase/${showcaseId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Immediately remove from local state and re-render
        this.showcase = this.showcase.filter(s => s.id !== showcaseId);
        this.renderShowcase();
      }
    } catch (error) {
      console.error('Error removing from showcase:', error);
    }
  },

  /**
   * Remove from collection (no confirmation popup)
   */
  async removeFromCollection(albumId) {
    try {
      const response = await Auth.apiRequest(`/api/collection/${albumId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Immediately remove from local state and re-render
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
    const sendBtn = document.querySelector('#ai-input-form button[type="submit"]');
    const message = input.value.trim();
    if (!message) return;

    // Disable input while processing
    input.value = '';
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    // Add user message to chat
    this.addChatMessage(message, 'user');

    // Show typing indicator
    this.showTypingIndicator();

    // Add to history
    this.chatHistory.push({ role: 'user', content: message });

    try {
      const response = await Auth.apiRequest('/api/chat/', {
        method: 'POST',
        body: JSON.stringify({
          message,
          collection: this.collection.map(a => ({ artist: a.artist, album: a.album })),
          history: this.chatHistory.slice(-10),
          category_slug: this.currentCategorySlug || 'vinyl'
        })
      });

      // Remove typing indicator
      this.hideTypingIndicator();

      if (response.ok) {
        const data = await response.json();

        // Sanitize and add response
        const cleanResponse = typeof DOMPurify !== 'undefined'
          ? DOMPurify.sanitize(data.response)
          : data.response;
        this.addChatMessage(cleanResponse, 'assistant');

        // Add to history
        this.chatHistory.push({ role: 'assistant', content: data.response });

        // Track actions for feedback
        const actions = [];

        // Process album additions
        if (data.albums_to_add?.length > 0) {
          console.log('[Chat] Albums to add:', data.albums_to_add);
          for (const album of data.albums_to_add) {
            const success = await this.addAlbumFromChat(album);
            if (success) {
              actions.push(`Added: ${album.artist} - ${album.album}`);
            }
          }
        }

        // Process album removals
        if (data.albums_to_remove?.length > 0) {
          console.log('[Chat] Albums to remove:', data.albums_to_remove);
          for (const album of data.albums_to_remove) {
            const success = await this.removeAlbumFromChat(album);
            if (success) {
              actions.push(`Removed: ${album.artist} - ${album.album}`);
            }
          }
        }

        // Process showcase actions
        if (data.albums_to_showcase?.length > 0) {
          console.log('[Chat] Albums to showcase:', data.albums_to_showcase);
          for (const album of data.albums_to_showcase) {
            const success = await this.showcaseAlbumFromChat(album);
            if (success) {
              actions.push(`Showcased: ${album.artist} - ${album.album}`);
            }
          }
        }

        // Show action summary if any actions were performed
        if (actions.length > 0) {
          this.showActionFeedback(actions);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        this.addChatMessage(errorData.detail || 'Sorry, I had trouble processing that. Please try again.', 'assistant');
      }
    } catch (error) {
      console.error('Chat error:', error);
      this.hideTypingIndicator();
      this.addChatMessage('Sorry, something went wrong. Please try again.', 'assistant');
    } finally {
      // Re-enable input
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  },

  /**
   * Show typing indicator in chat
   */
  showTypingIndicator() {
    const container = document.getElementById('ai-chat-container');
    const existing = container.querySelector('.typing-indicator');
    if (existing) return;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  },

  /**
   * Hide typing indicator
   */
  hideTypingIndicator() {
    const container = document.getElementById('ai-chat-container');
    const indicator = container.querySelector('.typing-indicator');
    if (indicator) indicator.remove();
  },

  /**
   * Show action feedback toast
   */
  showActionFeedback(actions) {
    // Create or update feedback toast
    let toast = document.getElementById('action-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'action-toast';
      toast.className = 'action-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = actions.map(a => `<div class="action-item">${this.escapeHtml(a)}</div>`).join('');
    toast.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
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
   * Handle .txt file upload for bulk album adding
   * Expected format: "Artist - Album" per line
   */
  async handleAlbumFileUpload(file) {
    if (!file.name.endsWith('.txt')) {
      this.addChatMessage('Please upload a .txt file with albums in "Artist - Album" format, one per line.', 'assistant');
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

      if (lines.length === 0) {
        this.addChatMessage('The file appears to be empty. Please add albums in "Artist - Album" format, one per line.', 'assistant');
        return;
      }

      // Parse albums from the file
      const albums = [];
      const invalidLines = [];

      for (const line of lines) {
        // Skip comment lines
        if (line.startsWith('#') || line.startsWith('//')) continue;

        // Try to parse "Artist - Album" format
        const separators = [' - ', ' – ', ' — ', ' : '];
        let parsed = false;

        for (const sep of separators) {
          const parts = line.split(sep);
          if (parts.length >= 2) {
            const artist = parts[0].trim();
            const album = parts.slice(1).join(sep).trim();
            if (artist && album) {
              albums.push({ artist, album });
              parsed = true;
              break;
            }
          }
        }

        if (!parsed) {
          invalidLines.push(line);
        }
      }

      if (albums.length === 0) {
        this.addChatMessage('No valid albums found. Please use "Artist - Album" format, one per line.', 'assistant');
        return;
      }

      // Show user message with summary
      this.addChatMessage(`Uploading ${albums.length} album(s) from file...`, 'user');

      // Add albums directly to collection with Discogs enrichment
      let added = 0;
      let skipped = 0;

      for (let i = 0; i < albums.length; i++) {
        const album = albums[i];

        // Update progress
        this.updateLastChatMessage(`Adding albums... ${i + 1}/${albums.length} (${album.artist} - ${album.album})`);

        // Check if already in collection
        const exists = this.collection.some(a =>
          a.artist.toLowerCase() === album.artist.toLowerCase() &&
          a.album.toLowerCase() === album.album.toLowerCase()
        );

        if (exists) {
          skipped++;
          continue;
        }

        // Search Discogs for cover art (globally cached)
        let cover = null;
        let year = null;
        let discogs_id = null;

        try {
          const discogsResponse = await Auth.apiRequest(
            `/api/discogs/search?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.album)}`
          );

          if (discogsResponse.ok) {
            const discogsData = await discogsResponse.json();
            cover = discogsData.cover || null;
            year = discogsData.year || null;
            discogs_id = discogsData.id || null;
          }
        } catch (err) {
          // Discogs failed, continue without cover
          console.log(`Discogs lookup failed for: ${album.artist} - ${album.album}`);
        }

        // Add to collection
        try {
          const categoryId = this.getCurrentCategoryId();
          const response = await Auth.apiRequest('/api/collection/', {
            method: 'POST',
            body: JSON.stringify({
              artist: album.artist,
              album: album.album,
              cover: cover,
              year: year,
              discogs_id: discogs_id,
              category_id: categoryId
            })
          });

          if (response.ok) {
            const newAlbum = await response.json();
            this.collection.push(newAlbum);
            added++;
          }
        } catch (err) {
          console.error(`Failed to add: ${album.artist} - ${album.album}`, err);
        }

        // Rate limit: wait 1.2 seconds between Discogs requests (50/min to be safe)
        if (i < albums.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      // Sort collection alphabetically and render
      this.collection.sort((a, b) => {
        const aKey = `${a.artist.toLowerCase()} ${a.album.toLowerCase()}`;
        const bKey = `${b.artist.toLowerCase()} ${b.album.toLowerCase()}`;
        return aKey.localeCompare(bKey);
      });
      this.renderCollection();

      // Show completion message
      let message = `Added ${added} album(s) to your collection.`;
      if (skipped > 0) message += ` ${skipped} already in collection.`;
      if (invalidLines.length > 0) message += ` ${invalidLines.length} line(s) couldn't be parsed.`;

      this.addChatMessage(message, 'assistant');

    } catch (error) {
      console.error('File upload error:', error);
      this.addChatMessage('Error reading file. Please try again.', 'assistant');
    }
  },

  /**
   * Update the last chat message (for progress updates)
   */
  updateLastChatMessage(content) {
    const container = document.getElementById('ai-chat-container');
    const messages = container.querySelectorAll('.ai-message.user');
    if (messages.length > 0) {
      messages[messages.length - 1].textContent = content;
    }
  },

  /**
   * Add album from chat (includes Discogs cover data)
   * @returns {Promise<boolean>} true if album was added successfully
   */
  async addAlbumFromChat(album) {
    try {
      // Check if album already exists (fuzzy match)
      const exists = this.collection.some(a =>
        a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
        a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
      );

      if (exists) {
        console.log('[Chat] Album already in collection:', album.artist, '-', album.album);
        return false;
      }

      const categoryId = this.getCurrentCategoryId();
      const response = await Auth.apiRequest('/api/collection/', {
        method: 'POST',
        body: JSON.stringify({
          artist: album.artist,
          album: album.album,
          cover: album.cover || null,
          year: album.year || null,
          discogs_id: album.discogs_id || null,
          category_id: categoryId
        })
      });

      if (response.ok) {
        const newAlbum = await response.json();
        this.addAlbumSorted(newAlbum);
        console.log('[Chat] Added album:', album.artist, '-', album.album);
        return true;
      } else {
        console.error('[Chat] Failed to add album:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Error adding album from chat:', error);
      return false;
    }
  },

  /**
   * Remove album from chat
   * @returns {Promise<boolean>} true if album was removed successfully
   */
  async removeAlbumFromChat(album) {
    // Find album with fuzzy matching
    const found = this.collection.find(a =>
      a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
      a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
    );

    if (!found) {
      // Try partial match
      const partialMatch = this.collection.find(a =>
        a.artist.toLowerCase().includes(album.artist.toLowerCase()) ||
        a.album.toLowerCase().includes(album.album.toLowerCase())
      );

      if (partialMatch) {
        console.log('[Chat] Partial match found, removing:', partialMatch.artist, '-', partialMatch.album);
        await this.removeFromCollection(partialMatch.id);
        return true;
      }

      console.log('[Chat] Album not found in collection:', album.artist, '-', album.album);
      return false;
    }

    try {
      await this.removeFromCollection(found.id);
      console.log('[Chat] Removed album:', album.artist, '-', album.album);
      return true;
    } catch (error) {
      console.error('Error removing album from chat:', error);
      return false;
    }
  },

  /**
   * Showcase album from chat
   * @returns {Promise<boolean>} true if album was showcased successfully
   */
  async showcaseAlbumFromChat(album) {
    // Find the album in collection (fuzzy match)
    let found = this.collection.find(a =>
      a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
      a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
    );

    // Try partial match if exact match not found
    if (!found) {
      found = this.collection.find(a =>
        a.album.toLowerCase().includes(album.album.toLowerCase()) ||
        (a.artist.toLowerCase().includes(album.artist.toLowerCase()) &&
         a.album.toLowerCase().includes(album.album.toLowerCase().split(' ')[0]))
      );
    }

    if (!found) {
      console.log('[Chat] Album not in collection, cannot showcase:', album.artist, '-', album.album);
      return false;
    }

    // Check if already in showcase
    if (this.showcase.find(s => s.collection_id === found.id)) {
      console.log('[Chat] Album already in showcase:', album.album);
      return false;
    }

    // Check showcase limit
    if (this.showcase.length >= 8) {
      console.log('[Chat] Showcase full (max 8), cannot add:', album.album);
      return false;
    }

    try {
      const response = await Auth.apiRequest('/api/profile/me/showcase', {
        method: 'POST',
        body: JSON.stringify({ collection_id: found.id })
      });

      if (response.ok) {
        const newShowcase = await response.json();
        this.showcase.push(newShowcase);
        this.renderShowcase();
        console.log('[Chat] Added to showcase:', album.artist, '-', album.album);
        return true;
      } else {
        console.error('[Chat] Failed to add to showcase:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Error adding to showcase from chat:', error);
      return false;
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
  },

  // ============================================
  // FRIENDS FUNCTIONALITY
  // ============================================

  /**
   * Load friends list
   */
  async loadFriends() {
    try {
      const response = await Auth.apiRequest('/api/friends/');
      if (response.ok) {
        this.friends = await response.json();
        this.renderFriends();
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  },

  /**
   * Load pending friend requests
   */
  async loadFriendRequests() {
    try {
      const response = await Auth.apiRequest('/api/friends/requests');
      if (response.ok) {
        this.friendRequests = await response.json();
        this.pendingRequestCount = this.friendRequests.length;
        this.renderFriendRequests();
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  },

  /**
   * Render friend requests section
   */
  renderFriendRequests() {
    let container = document.getElementById('friend-requests-container');

    // Create container if it doesn't exist
    if (!container) {
      const friendsSection = document.querySelector('.friends-section');
      if (!friendsSection) return;

      container = document.createElement('div');
      container.id = 'friend-requests-container';
      container.className = 'friend-requests-container';
      friendsSection.insertBefore(container, document.getElementById('friends-grid'));
    }

    if (this.friendRequests.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <h3 class="requests-title">Friend Requests <span class="request-badge">${this.friendRequests.length}</span></h3>
      <div class="requests-list">
        ${this.friendRequests.map(req => `
          <div class="request-card" data-id="${req.id}">
            <img src="${req.sender_picture || this.getDefaultAvatar(req.sender_name)}"
                 alt="${req.sender_name}"
                 class="request-avatar"
                 onerror="this.src='${this.getDefaultAvatar(req.sender_name)}'">
            <div class="request-info">
              <div class="request-name">${this.escapeHtml(req.sender_name || 'Anonymous')}</div>
              <div class="request-time">${this.formatTime(req.created_at)}</div>
            </div>
            <div class="request-actions">
              <button class="btn-accept" onclick="Profile.acceptRequest(${req.id})">Accept</button>
              <button class="btn-reject" onclick="Profile.rejectRequest(${req.id})">Reject</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * Accept friend request
   */
  async acceptRequest(requestId) {
    try {
      const response = await Auth.apiRequest(`/api/friends/requests/${requestId}/accept`, {
        method: 'POST'
      });

      if (response.ok) {
        // Remove from local state
        this.friendRequests = this.friendRequests.filter(r => r.id !== requestId);
        this.pendingRequestCount = this.friendRequests.length;
        this.renderFriendRequests();

        // Reload friends list
        await this.loadFriends();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request');
    }
  },

  /**
   * Reject friend request
   */
  async rejectRequest(requestId) {
    try {
      const response = await Auth.apiRequest(`/api/friends/requests/${requestId}/reject`, {
        method: 'POST'
      });

      if (response.ok) {
        // Remove from local state
        this.friendRequests = this.friendRequests.filter(r => r.id !== requestId);
        this.pendingRequestCount = this.friendRequests.length;
        this.renderFriendRequests();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request');
    }
  },

  /**
   * Render friends grid
   */
  renderFriends() {
    const grid = document.getElementById('friends-grid');
    const countEl = document.getElementById('friends-count');

    if (countEl) countEl.textContent = this.friends.length;

    if (this.friends.length === 0) {
      grid.innerHTML = `
        <div class="friends-empty" id="friends-empty">
          <div class="empty-icon">👥</div>
          <p>No friends yet</p>
          <span>Add friends to connect with other collectors!</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.friends.map(friend => `
      <div class="friend-card" data-id="${friend.id}" onclick="Profile.viewFriendProfile(${friend.id})">
        <img src="${friend.picture || this.getDefaultAvatar(friend.name)}"
             alt="${friend.name || 'Friend'}"
             class="friend-avatar"
             onerror="this.src='${this.getDefaultAvatar(friend.name)}'">
        <div class="friend-name">${this.escapeHtml(friend.name || 'Anonymous')}</div>
        ${friend.pronouns ? `<div class="friend-pronouns">${this.escapeHtml(friend.pronouns)}</div>` : ''}
      </div>
    `).join('');
  },

  /**
   * Get default avatar for user
   */
  getDefaultAvatar(name) {
    const initial = (name || 'A')[0].toUpperCase();
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%231a1a1a' width='100' height='100'/><text x='50' y='65' font-size='45' text-anchor='middle' fill='%231db954'>${initial}</text></svg>`;
  },

  /**
   * Open add friend modal
   */
  openAddFriendModal() {
    document.getElementById('friend-name-input').value = '';
    document.getElementById('friend-search-result').innerHTML = '';
    document.getElementById('add-friend-confirm').disabled = true;
    this.searchedFriend = null;
    document.getElementById('add-friend-modal').classList.add('open');
    document.getElementById('friend-name-input').focus();
  },

  /**
   * Search for friend by name
   */
  async searchFriend(name) {
    try {
      const response = await Auth.apiRequest(`/api/friends/search?name=${encodeURIComponent(name)}`);
      const resultEl = document.getElementById('friend-search-result');
      const confirmBtn = document.getElementById('add-friend-confirm');

      if (response.ok) {
        const user = await response.json();

        if (user) {
          // Check if already following
          const alreadyFollowing = this.friends.some(f => f.id === user.id);
          const isMe = user.id === this.profile?.id;

          this.searchedFriend = isMe || alreadyFollowing ? null : user;

          resultEl.innerHTML = `
            <div class="friend-preview">
              <img src="${user.picture || this.getDefaultAvatar(user.name)}"
                   alt="${user.name}"
                   onerror="this.src='${this.getDefaultAvatar(user.name)}'">
              <div class="friend-preview-info">
                <h4>${this.escapeHtml(user.name || 'Anonymous')}</h4>
                <p>${user.bio ? this.escapeHtml(user.bio.substring(0, 60)) + '...' : 'No bio'}</p>
                ${alreadyFollowing ? '<span class="already-following">Already following</span>' : ''}
                ${isMe ? '<span class="already-following">This is you!</span>' : ''}
              </div>
            </div>
          `;

          confirmBtn.disabled = alreadyFollowing || isMe;
        } else {
          resultEl.innerHTML = '<div class="not-found">No user found with that name</div>';
          confirmBtn.disabled = true;
          this.searchedFriend = null;
        }
      } else {
        resultEl.innerHTML = '<div class="not-found">Search failed</div>';
        confirmBtn.disabled = true;
        this.searchedFriend = null;
      }
    } catch (error) {
      console.error('Error searching friend:', error);
    }
  },

  /**
   * Confirm sending friend request
   */
  async confirmAddFriend() {
    if (!this.searchedFriend) return;

    try {
      const response = await Auth.apiRequest('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ name: this.searchedFriend.name })
      });

      if (response.ok) {
        // Request sent successfully
        this.closeModal('add-friend-modal');
        alert('Friend request sent!');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to send request');
      }
    } catch (error) {
      console.error('Error sending request:', error);
      alert('Failed to send request');
    }
  },

  /**
   * View friend's profile (quick modal view)
   */
  async viewFriendProfile(userId) {
    try {
      const response = await Auth.apiRequest(`/api/friends/user/${userId}`);
      if (response.ok) {
        const profile = await response.json();
        this.renderViewProfile(profile);
        document.getElementById('view-profile-modal').classList.add('open');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  },

  /**
   * State for full page friend profile view
   */
  friendProfileState: {
    userId: null,
    profile: null,
    categories: [],
    currentCategoryId: null,
    showcase: [],
    collection: []
  },

  /**
   * Open full page friend profile view
   */
  async openFriendFullProfile(userId) {
    // Hide both views, show friend profile page
    const profileView = document.getElementById('profile-view');
    const forumsView = document.getElementById('forums-view');
    let friendPage = document.getElementById('friend-profile-page');

    // Create friend profile page container if it doesn't exist
    if (!friendPage) {
      friendPage = document.createElement('div');
      friendPage.id = 'friend-profile-page';
      friendPage.className = 'friend-profile-page';
      profileView.parentNode.insertBefore(friendPage, profileView.nextSibling);
    }

    // Hide both tab views
    profileView.style.display = 'none';
    if (forumsView) forumsView.style.display = 'none';
    friendPage.style.display = 'block';
    friendPage.innerHTML = '<div class="friend-profile-loading">Loading profile...</div>';

    try {
      // Fetch friend's profile, categories in parallel
      const [profileRes, categoriesRes] = await Promise.all([
        Auth.apiRequest(`/api/friends/user/${userId}`),
        Auth.apiRequest(`/api/friends/user/${userId}/categories`)
      ]);

      if (!profileRes.ok) throw new Error('Failed to load profile');

      const profile = await profileRes.json();
      const categories = categoriesRes.ok ? await categoriesRes.json() : [];

      // Store state
      this.friendProfileState = {
        userId,
        profile,
        categories,
        currentCategoryId: categories.length > 0 ? categories[0].id : null,
        showcase: [],
        collection: []
      };

      // Load category-specific data
      if (this.friendProfileState.currentCategoryId) {
        await this.loadFriendCategoryData(userId, this.friendProfileState.currentCategoryId);
      } else {
        // Load all data if no categories
        const [showcaseRes, collectionRes] = await Promise.all([
          Auth.apiRequest(`/api/friends/user/${userId}/showcase`),
          Auth.apiRequest(`/api/friends/user/${userId}/collection`)
        ]);
        this.friendProfileState.showcase = showcaseRes.ok ? await showcaseRes.json() : [];
        this.friendProfileState.collection = collectionRes.ok ? await collectionRes.json() : [];
      }

      this.renderFriendFullProfile();

    } catch (error) {
      console.error('Error loading friend profile:', error);
      friendPage.innerHTML = `
        <div class="friend-profile-error">
          <button class="back-btn" onclick="Profile.closeFriendFullProfile()">← Back</button>
          <p>Failed to load profile</p>
        </div>
      `;
    }
  },

  /**
   * Load friend's category-specific showcase and collection
   */
  async loadFriendCategoryData(userId, categoryId) {
    try {
      const [showcaseRes, collectionRes] = await Promise.all([
        Auth.apiRequest(`/api/friends/user/${userId}/showcase?category_id=${categoryId}`),
        Auth.apiRequest(`/api/friends/user/${userId}/collection?category_id=${categoryId}`)
      ]);

      this.friendProfileState.showcase = showcaseRes.ok ? await showcaseRes.json() : [];
      this.friendProfileState.collection = collectionRes.ok ? await collectionRes.json() : [];
    } catch (error) {
      console.error('Error loading friend category data:', error);
    }
  },

  /**
   * Switch friend profile category
   */
  async switchFriendCategory(categoryId) {
    if (!this.friendProfileState.userId) return;

    this.friendProfileState.currentCategoryId = categoryId;
    await this.loadFriendCategoryData(this.friendProfileState.userId, categoryId);
    this.renderFriendFullProfile();
  },

  /**
   * Render full page friend profile
   */
  renderFriendFullProfile() {
    const { profile, categories, currentCategoryId, showcase, collection } = this.friendProfileState;
    const friendPage = document.getElementById('friend-profile-page');
    const currentCategory = categories.find(c => c.id === currentCategoryId);

    friendPage.innerHTML = `
      <div class="friend-profile-content">
        <button class="back-btn" onclick="Profile.closeFriendFullProfile()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Profile
        </button>

        <div class="friend-profile-header" style="${profile.background_image ? `background-image: url(${profile.background_image})` : ''}">
          <img src="${profile.picture || this.getDefaultAvatar(profile.name)}"
               alt="${profile.name}"
               class="friend-profile-picture"
               onerror="this.src='${this.getDefaultAvatar(profile.name)}'">
          <div class="friend-profile-info">
            <h1 class="friend-profile-name">${this.escapeHtml(profile.name || 'Anonymous')}</h1>
            ${profile.pronouns ? `<span class="friend-profile-pronouns">${this.escapeHtml(profile.pronouns)}</span>` : ''}
            ${profile.bio ? `<p class="friend-profile-bio">${this.escapeHtml(profile.bio)}</p>` : ''}
          </div>
          <div class="friend-profile-actions">
            ${profile.is_friend ? `
              <button class="btn-message" onclick="Profile.messageFromFriendProfile()">Message</button>
            ` : ''}
          </div>
        </div>

        ${categories.length > 0 ? `
          <div class="friend-category-tabs">
            ${categories.map(cat => `
              <button class="friend-category-tab ${cat.id === currentCategoryId ? 'active' : ''}"
                      onclick="Profile.switchFriendCategory(${cat.id})">
                <span class="category-icon">${cat.icon || ''}</span>
                <span class="category-name">${cat.name}</span>
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div class="friend-profile-section">
          <h2 class="section-title">${currentCategory ? currentCategory.icon + ' ' + currentCategory.name : ''} Showcase</h2>
          <div class="friend-showcase-grid">
            ${showcase.length > 0 ? showcase.map(album => `
              <div class="showcase-item">
                <img src="${album.cover || this.getPlaceholderCover(album)}"
                     alt="${album.album}"
                     onerror="this.src='${this.getPlaceholderCover(album)}'">
                <div class="showcase-info">
                  <span class="showcase-album">${this.escapeHtml(album.album)}</span>
                  <span class="showcase-artist">${this.escapeHtml(album.artist)}</span>
                </div>
              </div>
            `).join('') : '<p class="empty-msg">No items in showcase</p>'}
          </div>
        </div>

        <div class="friend-profile-section">
          <h2 class="section-title">${currentCategory ? currentCategory.icon + ' ' + currentCategory.name : ''} Collection
            <span class="collection-count">(${collection.length})</span>
          </h2>
          <div class="friend-collection-grid">
            ${collection.length > 0 ? collection.map(album => `
              <div class="collection-item">
                <img src="${album.cover || this.getPlaceholderCover(album)}"
                     alt="${album.album}"
                     onerror="this.src='${this.getPlaceholderCover(album)}'">
                <div class="collection-info">
                  <span class="collection-album">${this.escapeHtml(album.album)}</span>
                  <span class="collection-artist">${this.escapeHtml(album.artist)}</span>
                </div>
              </div>
            `).join('') : '<p class="empty-msg">No items in collection</p>'}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Close friend full profile and return to correct tab view
   */
  closeFriendFullProfile() {
    const profileView = document.getElementById('profile-view');
    const forumsView = document.getElementById('forums-view');
    const friendPage = document.getElementById('friend-profile-page');

    if (friendPage) friendPage.style.display = 'none';

    // Restore the correct view based on saved tab state
    const activeTab = localStorage.getItem('ncc_active_tab') || 'profile';
    if (activeTab === 'forums' && forumsView) {
      if (profileView) profileView.style.display = 'none';
      forumsView.style.display = 'block';
    } else {
      if (profileView) profileView.style.display = 'block';
      if (forumsView) forumsView.style.display = 'none';
    }

    this.friendProfileState = {
      userId: null,
      profile: null,
      categories: [],
      currentCategoryId: null,
      showcase: [],
      collection: []
    };
  },

  /**
   * Message from friend full profile page
   */
  messageFromFriendProfile() {
    if (!this.friendProfileState.profile) return;
    const { profile } = this.friendProfileState;
    this.closeFriendFullProfile();
    this.openConversation(profile.id, profile.name || '', profile.picture || '');
  },

  /**
   * Current viewed profile (for actions)
   */
  viewedProfile: null,

  /**
   * Render view profile modal
   */
  renderViewProfile(profile) {
    this.viewedProfile = profile;

    // Background
    const bgEl = document.getElementById('view-profile-bg');
    if (profile.background_image) {
      bgEl.style.backgroundImage = `url(${profile.background_image})`;
    } else {
      bgEl.style.backgroundImage = '';
    }

    // Picture
    document.getElementById('view-profile-picture').src = profile.picture || this.getDefaultAvatar(profile.name);

    // Name
    document.getElementById('view-profile-name').textContent = profile.name || 'Anonymous';

    // Pronouns
    const pronounsEl = document.getElementById('view-profile-pronouns');
    if (profile.pronouns) {
      pronounsEl.textContent = profile.pronouns;
      pronounsEl.style.display = 'inline-block';
    } else {
      pronounsEl.style.display = 'none';
    }

    // Bio
    document.getElementById('view-profile-bio').textContent = profile.bio || '';

    // Collection count
    const terms = this.getTerms();
    document.getElementById('view-profile-collection-count').textContent = `${profile.collection_count || 0} ${terms.itemPlural}`;

    // Actions - show different buttons based on relationship
    const actionsEl = document.getElementById('view-profile-actions');
    actionsEl.style.display = 'flex';

    if (profile.is_friend) {
      // Already friends - show Message, View Full Profile, and Unfriend
      actionsEl.innerHTML = `
        <button class="btn-message" id="view-profile-message">Message</button>
        <button class="btn-view-full" id="view-full-btn">View Full Profile</button>
        <button class="btn-unfriend" id="view-profile-unfollow">Unfriend</button>
      `;
      document.getElementById('view-profile-message').onclick = () => this.messageFromProfile();
      document.getElementById('view-full-btn').onclick = () => {
        this.closeModal('view-profile-modal');
        this.openFriendFullProfile(profile.id);
      };
      document.getElementById('view-profile-unfollow').onclick = () => this.unfollowFromProfile();
    } else if (profile.request_sent) {
      // Request pending
      actionsEl.innerHTML = `
        <button class="btn-pending" disabled>Request Sent</button>
      `;
    } else if (profile.request_received) {
      // They sent us a request
      actionsEl.innerHTML = `
        <button class="btn-accept" onclick="Profile.acceptRequestFromProfile(${profile.request_id})">Accept Request</button>
        <button class="btn-reject" onclick="Profile.rejectRequestFromProfile(${profile.request_id})">Reject</button>
      `;
    } else {
      // Not friends - show Send Request
      actionsEl.innerHTML = `
        <button class="btn-add-friend" onclick="Profile.sendRequestFromProfile()">Send Request</button>
      `;
    }

    // Showcase
    const showcaseGrid = document.getElementById('view-showcase-grid');
    if (profile.showcase && profile.showcase.length > 0) {
      showcaseGrid.innerHTML = profile.showcase.map(album => `
        <div class="showcase-item">
          <img src="${album.cover || this.getPlaceholderCover(album)}"
               alt="${album.album}"
               onerror="this.src='${this.getPlaceholderCover(album)}'">
        </div>
      `).join('');
    } else {
      const showcaseTerms = this.getTerms();
      showcaseGrid.innerHTML = `<div class="showcase-empty-msg">No ${showcaseTerms.itemPlural} in showcase</div>`;
    }

    // Reset collection state
    this.viewedProfileCollection = null;
  },

  /**
   * Load and display full profile with collection
   */
  async loadFullProfile() {
    if (!this.viewedProfile) return;

    const btn = document.getElementById('view-full-profile-btn');
    const collectionSection = document.getElementById('view-profile-collection');

    // Toggle off if already showing
    if (collectionSection.style.display !== 'none') {
      collectionSection.style.display = 'none';
      btn.textContent = 'View Full Profile';
      return;
    }

    btn.textContent = 'Loading...';

    try {
      // Fetch user's collection
      const response = await Auth.apiRequest(`/api/friends/user/${this.viewedProfile.id}/collection`);

      if (response.ok) {
        const collection = await response.json();
        this.viewedProfileCollection = collection;

        // Update count
        document.getElementById('view-collection-count').textContent = `(${collection.length})`;

        // Render collection
        this.renderViewCollection(collection);

        // Show section
        collectionSection.style.display = 'block';
        btn.textContent = 'Hide Collection';
      } else {
        btn.textContent = 'View Full Profile';
        console.error('Failed to load collection');
      }
    } catch (err) {
      btn.textContent = 'View Full Profile';
      console.error('Error loading collection:', err);
    }
  },

  /**
   * Render viewed profile's collection
   */
  renderViewCollection(collection) {
    const grid = document.getElementById('view-collection-grid');

    if (collection.length === 0) {
      const collTerms = this.getTerms();
      grid.innerHTML = `<div class="showcase-empty-msg">No ${collTerms.itemPlural} in collection</div>`;
      return;
    }

    grid.innerHTML = collection.map(album => `
      <div class="album-card">
        <img src="${album.cover || this.getPlaceholderCover(album)}"
             alt="${album.album}"
             onerror="this.src='${this.getPlaceholderCover(album)}'">
        <div class="album-info">
          <p class="album-title">${this.escapeHtml(album.album)}</p>
          <p class="album-artist">${this.escapeHtml(album.artist)}</p>
        </div>
      </div>
    `).join('');
  },

  /**
   * Filter viewed profile's collection
   */
  filterViewCollection(query) {
    if (!this.viewedProfileCollection) return;

    const q = query.toLowerCase().trim();

    if (!q) {
      this.renderViewCollection(this.viewedProfileCollection);
      return;
    }

    const filtered = this.viewedProfileCollection.filter(a =>
      a.artist.toLowerCase().includes(q) ||
      a.album.toLowerCase().includes(q)
    );

    this.renderViewCollection(filtered);
  },

  /**
   * Filter own collection
   */
  filterCollection(query) {
    const q = query.toLowerCase().trim();
    const grid = document.getElementById('collection-grid');

    if (!q) {
      this.renderCollection();
      return;
    }

    const filtered = this.collection.filter(a =>
      a.artist.toLowerCase().includes(q) ||
      a.album.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      const terms = this.getTerms();
      grid.innerHTML = `
        <div class="collection-empty">
          <div class="empty-icon">🔍</div>
          <p>No ${terms.itemPlural} found matching "${this.escapeHtml(query)}"</p>
        </div>
      `;
      return;
    }

    const isVinyl = this.currentCategorySlug === 'vinyl';
    grid.innerHTML = filtered.map(album => `
      <div class="album-card" data-id="${album.id}">
        <img src="${album.cover || this.getPlaceholderCover(album)}"
             alt="${album.album}" loading="lazy"
             onerror="this.src='${this.getPlaceholderCover(album)}'">
        <div class="album-info">
          <p class="album-title">${this.escapeHtml(album.album)}</p>
          <p class="album-artist">${this.escapeHtml(album.artist)}</p>
        </div>
        ${isVinyl ? `<button class="refresh-btn" onclick="Profile.refreshCover(${album.id})" title="Find cover">↻</button>` : ''}
        <button class="remove-btn" onclick="Profile.removeFromCollection(${album.id})" title="Remove">&times;</button>
      </div>
    `).join('');

    // Add click to add to showcase
    grid.querySelectorAll('.album-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-btn') && !e.target.closest('.refresh-btn')) {
          const id = parseInt(card.dataset.id);
          this.addToShowcase(id);
        }
      });
    });
  },

  /**
   * Message from profile view
   */
  messageFromProfile() {
    if (!this.viewedProfile) return;
    this.closeModal('view-profile-modal');
    this.openConversation(
      this.viewedProfile.id,
      this.viewedProfile.name || 'Anonymous',
      this.viewedProfile.picture || ''
    );
  },

  /**
   * Send friend request from profile view
   */
  async sendRequestFromProfile() {
    if (!this.viewedProfile) return;

    try {
      const response = await Auth.apiRequest('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ name: this.viewedProfile.name })
      });

      if (response.ok) {
        // Update the viewed profile and re-render
        this.viewedProfile.request_sent = true;
        this.renderViewProfile(this.viewedProfile);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to send request');
      }
    } catch (error) {
      console.error('Error sending request:', error);
    }
  },

  /**
   * Accept friend request from profile view
   */
  async acceptRequestFromProfile(requestId) {
    try {
      const response = await Auth.apiRequest(`/api/friends/requests/${requestId}/accept`, {
        method: 'POST'
      });

      if (response.ok) {
        // Reload friends and update profile view
        await this.loadFriends();
        await this.loadFriendRequests();

        // Update viewed profile to show as friend
        this.viewedProfile.is_friend = true;
        this.viewedProfile.request_received = false;
        this.viewedProfile.request_id = null;
        this.renderViewProfile(this.viewedProfile);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  },

  /**
   * Reject friend request from profile view
   */
  async rejectRequestFromProfile(requestId) {
    try {
      const response = await Auth.apiRequest(`/api/friends/requests/${requestId}/reject`, {
        method: 'POST'
      });

      if (response.ok) {
        await this.loadFriendRequests();
        this.closeModal('view-profile-modal');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  },

  /**
   * Unfriend from profile view (no confirmation popup)
   */
  async unfollowFromProfile() {
    if (!this.viewedProfile) return;

    try {
      const response = await Auth.apiRequest(`/api/friends/${this.viewedProfile.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Immediately remove from local state and re-render
        this.friends = this.friends.filter(f => f.id !== this.viewedProfile.id);
        this.renderFriends();
        this.closeModal('view-profile-modal');
      }
    } catch (error) {
      console.error('Error unfriending:', error);
    }
  },

  // ============================================
  // MESSAGING FUNCTIONALITY
  // ============================================

  /**
   * Load unread message count
   */
  async loadUnreadCount() {
    try {
      const response = await Auth.apiRequest('/api/messages/unread-count');
      if (response.ok) {
        const data = await response.json();
        this.unreadCount = data.count;
        this.updateUnreadBadge();
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  },

  /**
   * Update unread badge in header
   */
  updateUnreadBadge() {
    const badge = document.getElementById('unread-badge');
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      } else {
        badge.textContent = '';
      }
    }
  },

  /**
   * Start polling for updates (messages, friend requests, friends)
   */
  startPolling() {
    // Poll every 5 seconds for live updates
    this.pollingInterval = setInterval(async () => {
      // Load friend requests (for live accept notifications)
      const oldRequestCount = this.pendingRequestCount;
      await this.loadFriendRequests();

      // If we had pending requests and now we have new friends, someone accepted our request
      const oldFriendsCount = this.friends.length;
      await this.loadFriends();

      // If friends count increased, show notification
      if (this.friends.length > oldFriendsCount) {
        // Friends list updated - re-render
        this.renderFriends();
      }

      // Load unread message count
      await this.loadUnreadCount();

      // If in a conversation, refresh messages
      if (this.currentConversation) {
        await this.loadConversationMessages(this.currentConversation.id);
      }
    }, 5000);
  },

  /**
   * Open messages sidebar
   */
  async openMessagesSidebar() {
    document.getElementById('messages-sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');

    // Show friends list for messaging
    this.renderFriendsMessageList();
    this.showFriendsList();
  },

  /**
   * Close messages sidebar
   */
  closeMessagesSidebar() {
    document.getElementById('messages-sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
    this.currentConversation = null;
  },

  /**
   * Render friends list in messages sidebar
   */
  renderFriendsMessageList() {
    const listEl = document.getElementById('friends-message-list');

    if (this.friends.length === 0) {
      listEl.innerHTML = `
        <div class="friends-list-empty">
          <div class="empty-icon">👥</div>
          <p>No friends yet</p>
          <span>Add friends to start messaging!</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.friends.map(friend => `
      <div class="friend-message-item"
           onclick="Profile.openConversation(${friend.id}, '${this.escapeHtml(friend.name || '')}', '${friend.picture || ''}')">
        <img src="${friend.picture || this.getDefaultAvatar(friend.name)}"
             alt="${friend.name}"
             class="avatar"
             onerror="this.src='${this.getDefaultAvatar(friend.name)}'">
        <div class="friend-message-info">
          <div class="friend-message-name">${this.escapeHtml(friend.name || 'Anonymous')}</div>
          ${friend.pronouns ? `<div class="friend-message-pronouns">${this.escapeHtml(friend.pronouns)}</div>` : ''}
        </div>
      </div>
    `).join('');
  },

  /**
   * Format time for display
   */
  formatTime(timestamp) {
    // SQLite timestamps are UTC but don't have 'Z' suffix - add it if missing
    let ts = timestamp;
    if (ts && !ts.endsWith('Z') && !ts.includes('+') && !ts.includes('-', 10)) {
      ts = ts.replace(' ', 'T') + 'Z';
    }
    const date = new Date(ts);
    const now = new Date();
    const diff = now - date;

    // Less than 24 hours ago
    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Less than 7 days ago
    if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    // Otherwise show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  },

  /**
   * Show friends list view in messages sidebar
   */
  showFriendsList() {
    document.getElementById('friends-list-view').style.display = 'block';
    document.getElementById('conversation-view').style.display = 'none';
  },

  /**
   * Open a specific conversation
   */
  async openConversation(userId, userName, userPicture) {
    this.currentConversation = { id: userId, name: userName, picture: userPicture };

    // Update header
    document.getElementById('conversation-avatar').src = userPicture || this.getDefaultAvatar(userName);
    document.getElementById('conversation-with').textContent = userName || 'Anonymous';

    // Show conversation view
    document.getElementById('friends-list-view').style.display = 'none';
    document.getElementById('conversation-view').style.display = 'flex';

    // Make sure sidebar is open
    document.getElementById('messages-sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');

    // Load messages
    await this.loadConversationMessages(userId);
  },

  /**
   * Load messages for a conversation
   */
  async loadConversationMessages(userId) {
    try {
      const response = await Auth.apiRequest(`/api/messages/conversation/${userId}`);
      if (response.ok) {
        this.currentConversationMessages = await response.json();
        this.renderMessages();
        // Refresh unread count after reading messages
        this.loadUnreadCount();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  },

  /**
   * Render messages in conversation
   */
  renderMessages() {
    const listEl = document.getElementById('messages-list');

    if (this.currentConversationMessages.length === 0) {
      listEl.innerHTML = '<div class="messages-empty" style="text-align:center;color:#666;padding:40px;">No messages yet. Say hi!</div>';
      return;
    }

    listEl.innerHTML = this.currentConversationMessages.map(msg => `
      <div class="message-bubble ${msg.is_mine ? 'mine' : 'theirs'}">
        ${this.escapeHtml(msg.content)}
        <div class="message-time">${this.formatTime(msg.created_at)}</div>
      </div>
    `).join('');

    // Scroll to bottom
    listEl.scrollTop = listEl.scrollHeight;
  },

  /**
   * Go back to friends list
   */
  backToConversations() {
    this.currentConversation = null;
    this.renderFriendsMessageList();
    this.showFriendsList();
  },

  /**
   * Send a message
   */
  async sendMessage() {
    if (!this.currentConversation) return;

    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = '';

    try {
      const response = await Auth.apiRequest('/api/messages/', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: this.currentConversation.id,
          content
        })
      });

      if (response.ok) {
        const newMessage = await response.json();
        this.currentConversationMessages.push(newMessage);
        this.renderMessages();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to send message');
        input.value = content; // Restore message
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
      input.value = content;
    }
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
