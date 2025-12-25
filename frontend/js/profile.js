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
  collectionStats: null,  // Total stats across all categories

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
    // Mix in module methods - only ChatModule is ready for use
    // MessagesModule and FriendsModule have different API structures and are disabled for now
    if (window.ChatModule) Object.assign(this, window.ChatModule);

    Auth.mobileLog('[Profile] init() starting');

    // Handle OAuth callback first (extracts token from URL if present)
    const authResult = Auth.init();
    const isAuth = Auth.isAuthenticated();
    Auth.mobileLog('[Profile] Auth.init returned: ' + authResult + ', isAuth: ' + isAuth);
    console.log('[Profile] Auth.init result:', authResult, 'isAuthenticated:', isAuth);

    // Then check authentication
    if (!isAuth) {
      Auth.mobileLog('[Profile] NOT AUTHENTICATED - redirecting to /');
      console.log('[Profile] Not authenticated, redirecting to login');
      window.location.href = '/';
      return;
    }

    Auth.mobileLog('[Profile] Authenticated! Loading profile...');

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

    // Now load collection, showcase, and wishlist with category filter applied
    await Promise.all([
      this.loadCollection(),
      this.loadShowcase(),
      this.loadWishlist()
    ]);

    // Render user menu
    this.renderUserMenu();

    // Render collection summary card (and fetch stats for profile completion)
    await this.renderCollectionSummary();

    // Update profile completion now that we have all data including stats
    this.renderProfileCompletion();

    // Start polling for updates (messages, friend requests, friends)
    this.startPolling();

    // Fill in missing album covers in background
    this.fillMissingCovers();

    // Restore saved main tab (Profile/Forums)
    if (typeof Forums !== 'undefined') {
      Forums.restoreSavedTab();
    }

    Auth.mobileLog('[Profile] init() complete - profile loaded successfully');
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Helper to safely add event listeners
    // Set silent=true for elements that may not exist on page load (e.g., modal content)
    const addListener = (id, event, handler, silent = false) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
      else if (!silent) console.warn(`Element #${id} not found`);
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

    // Social links add button
    addListener('add-social-btn', 'click', () => {
      this.showSocialPicker();
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

    // Wishlist
    addListener('add-wishlist-btn', 'click', () => this.openAddWishlistModal());
    addListener('add-wishlist-close', 'click', () => this.closeModal('add-wishlist-modal'));
    addListener('add-wishlist-cancel', 'click', () => this.closeModal('add-wishlist-modal'));
    addListener('add-wishlist-form', 'submit', (e) => {
      e.preventDefault();
      this.addWishlistItem();
    });

    // View Profile modal
    addListener('view-profile-close', 'click', () => this.closeModal('view-profile-modal'));
    addListener('view-profile-message', 'click', () => this.messageFromProfile());
    addListener('view-profile-unfollow', 'click', () => this.unfollowFromProfile());
    addListener('view-collection-search', 'input', (e) => this.filterViewCollection(e.target.value), true);

    // Collection search and filters
    addListener('collection-search-input', 'input', () => this.applyCollectionFilters());
    addListener('filter-genre', 'change', () => this.applyCollectionFilters());
    addListener('filter-year', 'change', () => this.applyCollectionFilters());
    addListener('filter-sort', 'change', () => this.applyCollectionFilters());

    // Messages Sidebar
    addListener('messages-toggle-btn', 'click', () => this.openMessagesSidebar());
    addListener('messages-close-btn', 'click', () => this.closeMessagesSidebar());
    addListener('conversation-back-btn', 'click', () => this.backToConversations());
    addListener('message-form', 'submit', (e) => {
      e.preventDefault();
      this.sendMessage();
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

    // Member Since
    const memberSinceEl = document.getElementById('member-since');
    if (memberSinceEl && this.profile.created_at) {
      const date = new Date(this.profile.created_at);
      const options = { year: 'numeric', month: 'short' };
      memberSinceEl.textContent = `Member since ${date.toLocaleDateString('en-US', options)}`;
    }

    // Location
    const locationEl = document.getElementById('profile-location');
    if (locationEl) {
      if (this.profile.location) {
        locationEl.innerHTML = `<span class="location-icon">📍</span> ${this.escapeHtml(this.profile.location)}`;
        locationEl.style.display = 'block';
      } else {
        locationEl.style.display = 'none';
      }
    }

    // Bio
    document.getElementById('profile-bio').textContent = this.profile.bio || '';

    // External Links
    this.renderExternalLinks();

    // Background
    if (this.profile.background_image) {
      document.getElementById('hero-background').style.backgroundImage = `url(${this.profile.background_image})`;
    }

    // Note: Profile completion is rendered after all data is loaded in init()
    // to avoid flickering when showcase/collection aren't loaded yet
  },

  /**
   * Calculate and render profile completion progress
   */
  renderProfileCompletion() {
    const completionEl = document.getElementById('profile-completion');
    const fillEl = document.getElementById('completion-fill');
    const textEl = document.getElementById('completion-text');

    if (!completionEl) return;

    // Use total stats across all categories for collection/showcase checks
    const stats = this.collectionStats;
    const fields = {
      name: !!this.profile?.name,
      bio: !!this.profile?.bio && this.profile.bio.length > 10,
      picture: !!this.profile?.picture,
      pronouns: !!this.profile?.pronouns,
      location: !!this.profile?.location,
      showcase: (stats?.total_showcase || 0) >= 1,
      collection: (stats?.total_albums || 0) >= 1,
      categories: this.userCategories && this.userCategories.length >= 1
    };

    const completed = Object.values(fields).filter(Boolean).length;
    const total = Object.keys(fields).length;
    const percent = Math.round((completed / total) * 100);

    // Always show progress bar
    completionEl.style.display = 'flex';
    fillEl.style.width = `${percent}%`;
    if (percent < 100) {
      textEl.textContent = `Profile ${percent}% complete`;
    } else {
      textEl.textContent = `Profile complete! 🎉`;
      fillEl.style.background = 'linear-gradient(90deg, #1db954, #1ed760)';
    }
  },

  // Social link platform configurations with SVG icons
  socialPlatforms: {
    instagram: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>', label: 'Instagram', urlPrefix: 'https://instagram.com/', placeholder: '@username' },
    tiktok: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>', label: 'TikTok', urlPrefix: 'https://tiktok.com/@', placeholder: '@username' },
    twitter: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>', label: 'Twitter/X', urlPrefix: 'https://twitter.com/', placeholder: '@username' },
    youtube: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>', label: 'YouTube', urlPrefix: '', placeholder: 'Channel URL' },
    facebook: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>', label: 'Facebook', urlPrefix: 'https://facebook.com/', placeholder: 'Profile URL or username' },
    threads: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.33-3.022.88-.73 2.082-1.147 3.478-1.208l.186-.005c1.033 0 1.942.189 2.694.562.314-.77.48-1.656.48-2.645 0-.443-.038-.874-.114-1.29l2.024-.353c.102.562.154 1.137.154 1.716 0 1.285-.233 2.46-.682 3.471.67.586 1.18 1.301 1.49 2.138.63 1.705.528 4.322-1.637 6.442-1.87 1.826-4.155 2.62-7.384 2.644zm-.016-8.71c-1.424.058-2.317.545-2.317 1.384 0 .603.522 1.236 1.782 1.288 1.363-.006 2.287-.593 2.748-1.747a6.557 6.557 0 0 0-.645-.084 6.523 6.523 0 0 0-.546-.029c-.337 0-.683.063-1.022.188z"/></svg>', label: 'Threads', urlPrefix: 'https://threads.net/@', placeholder: '@username' },
    bluesky: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.296 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>', label: 'Bluesky', urlPrefix: 'https://bsky.app/profile/', placeholder: 'handle.bsky.social' },
    mastodon: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.668 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"/></svg>', label: 'Mastodon', urlPrefix: '', placeholder: '@user@instance.social' },
    twitch: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>', label: 'Twitch', urlPrefix: 'https://twitch.tv/', placeholder: 'username' },
    discord: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>', label: 'Discord', urlPrefix: '', placeholder: 'username or invite link' },
    spotify: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>', label: 'Spotify', urlPrefix: '', placeholder: 'Profile or playlist URL' },
    soundcloud: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.048-.1-.098-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094s.089-.037.099-.094l.21-1.308-.21-1.319c-.01-.057-.044-.094-.09-.094m1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.104.106.104.061 0 .12-.044.12-.104l.24-2.474-.24-2.547c0-.06-.06-.104-.12-.104m.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.627c-.015-.09-.074-.15-.15-.15l-.016.002m.93-.585c-.089 0-.165.075-.179.164l-.18 3.209.18 2.494c.015.09.09.164.18.164.089 0 .164-.074.164-.164l.21-2.494-.21-3.21c-.014-.089-.075-.163-.164-.163m.97-.705c-.105 0-.195.09-.21.195l-.165 3.884.18 2.43c.014.104.09.195.21.195.104 0 .194-.09.21-.195l.195-2.43-.195-3.885c-.016-.104-.106-.194-.211-.194m1.065-.584c-.12 0-.225.105-.225.225l-.15 4.439.165 2.369c.015.12.105.225.225.225.119 0 .225-.105.224-.225l.18-2.37-.18-4.439c-.015-.12-.105-.225-.224-.225m.96-.089c-.135 0-.255.12-.27.254l-.12 4.498.136 2.328c.015.135.12.255.255.255.135 0 .254-.12.27-.255l.154-2.328-.154-4.499c-.015-.135-.12-.254-.255-.254l-.016.001m2.04-.209c-.015-.165-.135-.3-.315-.3-.165 0-.3.135-.315.3l-.105 4.678.12 2.28c.015.164.135.3.3.3.164 0 .3-.135.3-.3l.135-2.28-.12-4.678m.916.195c-.164 0-.314.15-.329.315l-.106 4.455.121 2.205c.015.165.15.315.315.315.164 0 .314-.15.314-.315l.135-2.205-.12-4.455c-.015-.18-.15-.315-.314-.315l-.016.001m.96-.104c-.18 0-.33.15-.33.33l-.105 4.529.105 2.145c.016.18.166.33.33.33.18 0 .33-.15.33-.33l.121-2.145-.121-4.529c0-.18-.15-.33-.33-.33m1.05-.119c-.195 0-.36.164-.375.359l-.09 4.619.105 2.085c.015.195.165.36.36.36.195 0 .36-.165.36-.36l.12-2.085-.12-4.619c-.015-.195-.165-.359-.36-.359m.989-.119c-.21 0-.375.18-.39.39l-.09 4.694.09 2.025c.015.211.18.39.39.39.21 0 .375-.18.375-.39l.105-2.025-.105-4.694c0-.21-.165-.39-.375-.39m1.051.029c-.225 0-.405.18-.42.405l-.075 4.65.09 1.98c.015.225.195.405.405.405.225 0 .405-.18.405-.405l.105-1.98-.12-4.65c-.014-.24-.18-.405-.39-.405m1.021.24c0-.225-.194-.42-.435-.42-.24 0-.42.195-.42.42l-.075 4.38.09 1.935c0 .225.194.42.42.42.225 0 .42-.195.435-.42l.105-1.935-.12-4.38m.93-.181c-.255 0-.465.21-.465.465l-.06 4.065.075 1.905c.015.24.21.45.45.45.255 0 .465-.21.465-.45l.075-1.905-.075-4.065c0-.255-.21-.465-.465-.465m7.064 4.5c-.645 0-1.246.18-1.77.494-.33-3.75-3.42-6.69-7.215-6.69-.929 0-1.816.195-2.64.525-.316.13-.404.26-.404.51v13.095c0 .27.194.49.45.525.016 0 11.58 0 11.58 0 2.16 0 3.93-1.77 3.93-3.93-.015-2.175-1.77-3.93-3.93-3.93v.001z"/></svg>', label: 'SoundCloud', urlPrefix: 'https://soundcloud.com/', placeholder: 'username' },
    bandcamp: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/></svg>', label: 'Bandcamp', urlPrefix: '', placeholder: 'Profile URL' },
    linkedin: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>', label: 'LinkedIn', urlPrefix: 'https://linkedin.com/in/', placeholder: 'profile-name' },
    pinterest: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>', label: 'Pinterest', urlPrefix: 'https://pinterest.com/', placeholder: 'username' },
    reddit: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>', label: 'Reddit', urlPrefix: 'https://reddit.com/user/', placeholder: 'u/username' },
    website: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.5 2.05c1.05.04 2.05.26 2.98.62-.46.55-1 1.08-1.62 1.56-.5-.56-.99-1.08-1.36-1.5v-.68zm-2 .32c-.36.46-.77 1.04-1.18 1.72-.58-.22-1.12-.47-1.62-.75.81-.49 1.78-.84 2.8-.97zm-4.54 1.77c.59.34 1.24.64 1.94.9-.27.63-.5 1.31-.69 2.01H3.22c.42-1.13 1.06-2.15 1.87-3l-.13.09zm-1.74 4.91h3.26c-.16 1.16-.25 2.4-.25 3.7 0 .65.03 1.29.08 1.9H3.09c-.24-.81-.38-1.67-.38-2.55 0-.72.11-1.42.31-2.1l.2-.95zm.53 7.6h2.94c.22 1.31.56 2.47 1 3.43-.6.17-1.16.38-1.68.61A9.922 9.922 0 0 1 3.75 16.65zm4.72 4.95c-.72-.11-1.41-.31-2.05-.58.34-.2.69-.38 1.06-.53.29.41.62.79.99 1.11zm.53-5.91v-.04H12v5.23c-.68-.49-1.32-1.21-1.89-2.12-.4-.68-.72-1.46-.96-2.28-.03-.27-.07-.53-.07-.79h-.08zm3.58 5.23V15.7h3.07c-.15.59-.35 1.14-.57 1.65-.62 1.4-1.43 2.44-2.5 3.37v.2zm4.25-1.11c.64-.75 1.17-1.6 1.56-2.54.12-.28.23-.56.32-.84h1.9a9.94 9.94 0 0 1-3.78 3.38zm2.34-5.31h-2.32c.09-.83.15-1.71.15-2.65s-.06-1.84-.15-2.7h3.05c.23.84.38 1.72.38 2.65 0 .93-.12 1.83-.35 2.7h-.76zm.95-7.4h-2.52c-.19-.77-.43-1.5-.72-2.17.67-.22 1.29-.5 1.88-.82a9.96 9.96 0 0 1 1.36 2.99zm-3.73-4.1c.43.26.83.55 1.21.87-.42.22-.88.42-1.36.6a8.11 8.11 0 0 0 .15-1.47zm-2.49-.58V5h-.02c-.38-.48-.76-.92-1.11-1.3.35-.1.71-.18 1.08-.24l.05-.01zm.05 1.86h2.33c.22.85.4 1.78.51 2.79h-2.84V7.35zm0 4.79h3.01c.01.53.02 1.05.02 1.56 0 .87-.06 1.71-.16 2.5h-2.87v-4.06zm-2 9.04v-3.18h2.85c-.1.59-.22 1.14-.38 1.65-.36.74-.82 1.32-1.39 1.73-.36.09-.72.13-1.08.13v-.33zm0-5.14V12.1h-3.06c-.07-.82-.11-1.65-.11-2.5 0-.87.06-1.71.15-2.5H12v4.9zm0-6.89V5.58c.49.39 1.01.93 1.54 1.63H12zm-2 0H9.45c.28-.34.58-.67.91-.98.23-.22.47-.43.72-.63.06-.02.12-.02.17-.02.29.19.58.4.83.65V9.08l-.08.07zm0 1.99v4.02h-3.2c-.12-.93-.18-1.9-.18-2.93 0-.37.01-.73.03-1.09H10v.01-.01z"/></svg>', label: 'Website', urlPrefix: '', placeholder: 'https://...' }
  },

  /**
   * Render external links display
   */
  renderExternalLinks() {
    const container = document.getElementById('external-links-display');
    if (!container) return;

    const links = this.profile?.external_links || {};
    const hasLinks = Object.values(links).some(v => v);

    if (!hasLinks) {
      container.style.display = 'none';
      return;
    }

    const linksHtml = Object.entries(links)
      .filter(([key, value]) => value && this.socialPlatforms[key])
      .map(([key, value]) => {
        const config = this.socialPlatforms[key];
        let url = value;
        const isClickable = config.urlPrefix || value.startsWith('http');

        if (config.urlPrefix && !value.startsWith('http')) {
          url = config.urlPrefix + value.replace(/^@/, '');
        }

        // For non-linkable items (like Discord usernames), show as non-clickable
        if (!isClickable) {
          return `<span class="external-link non-clickable" title="${config.label}: ${this.escapeHtml(value)}">
            <span class="link-icon">${config.icon}</span>
          </span>`;
        }

        return `<a href="${this.sanitizeUrl(url)}" target="_blank" rel="noopener" class="external-link" title="${config.label}">
          <span class="link-icon">${config.icon}</span>
        </a>`;
      })
      .join('');

    container.innerHTML = linksHtml;
    container.style.display = 'flex';
  },

  /**
   * Populate social links in edit modal
   */
  populateSocialLinksEditor() {
    const container = document.getElementById('social-links-list');
    if (!container) return;

    const links = this.profile?.external_links || {};
    container.innerHTML = '';

    // Add existing links
    Object.entries(links).forEach(([key, value]) => {
      if (value && this.socialPlatforms[key]) {
        this.addSocialLinkField(key, value);
      }
    });
  },

  /**
   * Add a social link input field
   */
  addSocialLinkField(platform, value = '') {
    const container = document.getElementById('social-links-list');
    const config = this.socialPlatforms[platform];
    if (!config) return;

    const fieldId = `social-link-${platform}`;

    // Check if field already exists
    if (document.getElementById(fieldId)) return;

    const fieldHtml = `
      <div class="social-link-field" data-platform="${platform}" id="field-${platform}">
        <span class="social-link-icon">${config.icon}</span>
        <input type="text" id="${fieldId}" value="${this.escapeHtml(value)}"
               placeholder="${config.placeholder}" maxlength="200">
        <button type="button" class="remove-social-btn" onclick="Profile.removeSocialLinkField('${platform}')">&times;</button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', fieldHtml);

    // Hide this option from picker
    this.updateSocialPicker();
  },

  /**
   * Remove a social link field
   */
  removeSocialLinkField(platform) {
    const field = document.getElementById(`field-${platform}`);
    if (field) field.remove();
    this.updateSocialPicker();
  },

  /**
   * Show social platform picker
   */
  showSocialPicker() {
    const picker = document.getElementById('social-picker');
    const options = document.getElementById('social-picker-options');

    // Get already added platforms
    const addedPlatforms = Array.from(document.querySelectorAll('.social-link-field'))
      .map(el => el.dataset.platform);

    // Build options for platforms not yet added
    const availableHtml = Object.entries(this.socialPlatforms)
      .filter(([key]) => !addedPlatforms.includes(key))
      .map(([key, config]) => `
        <button type="button" class="social-option" onclick="Profile.selectSocialPlatform('${key}')">
          <span>${config.icon}</span> ${config.label}
        </button>
      `)
      .join('');

    if (availableHtml) {
      options.innerHTML = availableHtml;
      picker.style.display = 'block';
    }
  },

  /**
   * Hide social platform picker
   */
  hideSocialPicker() {
    const picker = document.getElementById('social-picker');
    if (picker) picker.style.display = 'none';
  },

  /**
   * Select a platform from picker
   */
  selectSocialPlatform(platform) {
    this.addSocialLinkField(platform, '');
    this.hideSocialPicker();
    // Focus the new input
    const input = document.getElementById(`social-link-${platform}`);
    if (input) input.focus();
  },

  /**
   * Update social picker options
   */
  updateSocialPicker() {
    // Just hide picker after changes
    this.hideSocialPicker();
  },

  /**
   * Get social links from form
   */
  getSocialLinksFromForm() {
    const links = {};
    document.querySelectorAll('.social-link-field').forEach(field => {
      const platform = field.dataset.platform;
      const input = field.querySelector('input');
      if (input && input.value.trim()) {
        links[platform] = input.value.trim();
      }
    });
    return links;
  },

  /**
   * Render item tags as badges
   */
  renderItemTags(tagsStr) {
    if (!tagsStr) return '';

    const tagConfig = {
      'for_trade': { label: 'For Trade', class: 'tag-trade' },
      'grail': { label: 'Grail', class: 'tag-grail' },
      'sealed': { label: 'Sealed', class: 'tag-sealed' },
      'signed': { label: 'Signed', class: 'tag-signed' },
      'first_press': { label: '1st Press', class: 'tag-first' },
      'rare': { label: 'Rare', class: 'tag-rare' }
    };

    // Filter to only valid tags (must be in tagConfig), ignore junk like "[]"
    const validTagKeys = Object.keys(tagConfig);
    const tags = tagsStr.split(',')
      .map(t => t.trim())
      .filter(t => t && validTagKeys.includes(t));

    if (tags.length === 0) return '';

    return `<div class="item-tags">${tags.map(tag => {
      const config = tagConfig[tag];
      return `<span class="item-tag ${config.class}">${config.label}</span>`;
    }).join('')}</div>`;
  },

  /**
   * Show tag editing modal
   */
  showTagModal(albumId) {
    const album = this.collection.find(a => a.id === albumId);
    if (!album) return;

    const currentTags = album.tags ? album.tags.split(',') : [];
    const allTags = ['for_trade', 'grail', 'sealed', 'signed', 'first_press', 'rare'];
    const tagLabels = {
      'for_trade': 'For Trade',
      'grail': 'Grail / Holy Grail',
      'sealed': 'Sealed / Mint',
      'signed': 'Signed',
      'first_press': '1st Press',
      'rare': 'Rare'
    };

    const html = `
      <div class="tag-modal-content">
        <h3>Edit Tags</h3>
        <p class="tag-album-name">${this.escapeHtml(album.album)} - ${this.escapeHtml(album.artist)}</p>
        <div class="tag-options">
          ${allTags.map(tag => `
            <label class="tag-option">
              <input type="checkbox" value="${tag}" ${currentTags.includes(tag) ? 'checked' : ''}>
              <span>${tagLabels[tag]}</span>
            </label>
          `).join('')}
        </div>
        <div class="tag-modal-actions">
          <button class="btn-cancel" onclick="Profile.closeTagModal()">Cancel</button>
          <button class="btn-clear" onclick="Profile.clearItemTags(${albumId})">Clear All</button>
          <button class="btn-save" onclick="Profile.saveItemTags(${albumId})">Save</button>
        </div>
      </div>
    `;

    // Create or show modal
    let modal = document.getElementById('tag-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tag-modal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = html;
    modal.classList.add('open');
  },

  /**
   * Close tag modal
   */
  closeTagModal() {
    const modal = document.getElementById('tag-modal');
    if (modal) modal.classList.remove('open');
  },

  /**
   * Save item tags
   */
  async saveItemTags(albumId) {
    const modal = document.getElementById('tag-modal');
    const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
    const tags = Array.from(checkboxes).map(cb => cb.value).join(',');

    try {
      const response = await Auth.apiRequest(`/api/collection/${albumId}`, {
        method: 'PUT',
        body: JSON.stringify({ tags: tags || "" })
      });

      if (response.ok) {
        const album = this.collection.find(a => a.id === albumId);
        if (album) album.tags = tags || null;
        this.renderCollection();
        this.closeTagModal();
      } else {
        const errorText = await response.text();
        console.error('Error saving tags:', errorText);
        alert('Failed to save tags');
      }
    } catch (error) {
      console.error('Error saving tags:', error);
      alert('Failed to save tags');
    }
  },

  /**
   * Clear all tags from an item
   */
  async clearItemTags(albumId) {
    try {
      const response = await Auth.apiRequest(`/api/collection/${albumId}`, {
        method: 'PUT',
        body: JSON.stringify({ tags: "" })
      });

      if (response.ok) {
        const album = this.collection.find(a => a.id === albumId);
        if (album) album.tags = null;
        this.renderCollection();
        this.closeTagModal();
      } else {
        const errorText = await response.text();
        console.error('Error clearing tags:', errorText);
        alert('Failed to clear tags');
      }
    } catch (error) {
      console.error('Error clearing tags:', error);
      alert('Failed to clear tags');
    }
  },

  /**
   * Render collection summary card showing all collections at a glance
   */
  async renderCollectionSummary() {
    const section = document.getElementById('collection-summary-section');
    const card = document.getElementById('collection-summary-card');

    try {
      // Always fetch stats for profile completion, even if we don't render summary card
      const response = await Auth.apiRequest('/api/collection/stats');
      if (response.ok) {
        this.collectionStats = await response.json();
      }
    } catch (error) {
      console.error('Error fetching collection stats:', error);
    }

    if (!section || !card || !this.userCategories || this.userCategories.length === 0) {
      if (section) section.style.display = 'none';
      return;
    }

    const stats = this.collectionStats;
    if (!stats) {
      section.style.display = 'none';
      return;
    }

    // Only show if user has multiple categories or significant collection
    if (this.userCategories.length <= 1 && stats.total_albums < 5) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Calculate collector score (gamification)
    const collectorScore = this.calculateCollectorScore(stats);

    // Build badges HTML
    const categoryBadges = this.userCategories.map(cat => {
      const count = stats.category_breakdown?.[cat.id] || 0;
      const isActive = cat.slug === this.currentCategorySlug;
      return `
        <div class="collection-badge ${isActive ? 'active' : ''}"
             data-category="${cat.slug}"
             onclick="Profile.switchCategoryProfile('${cat.slug}')"
             title="View ${cat.name} collection">
          <span class="badge-icon">${cat.icon || '📦'}</span>
          <span class="badge-count">${count}</span>
          <span class="badge-label">${cat.name}</span>
        </div>
      `;
    }).join('');

    const scoreHtml = collectorScore > 0 ? `
      <div class="collector-score" title="Your Collector Score based on activity">
        <span>⭐</span>
        <span>${collectorScore}</span>
      </div>
    ` : '';

    card.innerHTML = categoryBadges + scoreHtml;
  },

  /**
   * Calculate collector score based on activity
   */
  calculateCollectorScore(stats) {
    let score = 0;

    // Points for collection size
    score += Math.min(stats.total_albums * 2, 200);

    // Points for showcase items (use total from stats, not current category)
    score += (stats.total_showcase || 0) * 10;

    // Points for diversity (multiple categories)
    const categoryCount = Object.keys(stats.category_breakdown || {}).length;
    score += categoryCount * 25;

    // Points for profile completion
    if (this.profile?.bio) score += 15;
    if (this.profile?.picture) score += 10;
    if (this.profile?.pronouns) score += 5;

    return score;
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

      // Reload wishlist for this category
      await this.loadWishlist();

      // Update all UI elements for this category
      this.updateUIForCategory(categorySlug);

      // Re-render collection summary to update active badge highlighting
      await this.renderCollectionSummary();

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

    // Update sort filter labels
    this.updateSortFilterLabels(categorySlug);

    // Update AI chat welcome checklist
    this.updateAIWelcome();
  },

  /**
   * Update sort filter dropdown labels based on category
   */
  updateSortFilterLabels(categorySlug) {
    const sortSelect = document.getElementById('filter-sort');
    if (!sortSelect) return;

    const terms = this.getTerms(categorySlug);
    const field1 = terms.field1Label || 'Artist';
    const field2 = terms.field2Label || 'Album';

    // Update the option labels
    const options = sortSelect.querySelectorAll('option');
    options.forEach(opt => {
      switch (opt.value) {
        case 'artist-asc':
          opt.textContent = `${field1} A-Z`;
          break;
        case 'artist-desc':
          opt.textContent = `${field1} Z-A`;
          break;
        case 'album-asc':
          opt.textContent = `${field2} A-Z`;
          break;
        case 'album-desc':
          opt.textContent = `${field2} Z-A`;
          break;
      }
    });
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
        <span class="collection-count" id="collection-count">${count}</span>
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
        this.populateFilterOptions();
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
        ${this.renderItemTags(album.tags)}
        <div class="album-info">
          <p class="album-title">${this.escapeHtml(album.album)}</p>
          <p class="album-artist">${this.escapeHtml(album.artist)}</p>
        </div>
        <button class="tag-btn" onclick="event.stopPropagation(); Profile.showTagModal(${album.id})" title="Edit tags">🏷️</button>
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
            // Convert relative API paths to full URLs
            let coverUrl = data.cover;
            if (coverUrl.startsWith('/api/')) {
              coverUrl = CONFIG.API_BASE + coverUrl;
            }

            // Update album in collection
            album.cover = coverUrl;
            if (data.year && !album.year) album.year = data.year;
            if (data.id && !album.discogs_id) album.discogs_id = data.id;

            // Update in database
            await Auth.apiRequest(`/api/collection/${album.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                cover: coverUrl,
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
      // Use refresh=true to bypass cache and get fresh cover data
      const discogsResponse = await Auth.apiRequest(
        `/api/discogs/search?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.album)}&refresh=true`
      );

      if (discogsResponse.ok) {
        const data = await discogsResponse.json();

        if (data.cover) {
          // Convert relative API paths to full URLs
          let coverUrl = data.cover;
          if (coverUrl.startsWith('/api/')) {
            coverUrl = CONFIG.API_BASE + coverUrl;
          }

          // Update album in collection
          album.cover = coverUrl;
          if (data.year && !album.year) album.year = data.year;
          if (data.id && !album.discogs_id) album.discogs_id = data.id;

          // Update in database
          await Auth.apiRequest(`/api/collection/${album.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              cover: coverUrl,
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
        ${album.notes ? `<div class="showcase-note">${this.escapeHtml(album.notes)}</div>` : ''}
        <div class="album-info">
          <p class="album-title">${this.escapeHtml(album.album)}</p>
          <p class="album-artist">${this.escapeHtml(album.artist)}</p>
        </div>
        <button class="note-btn" onclick="event.stopPropagation(); Profile.showShowcaseNoteModal(${album.id})" title="Add note">📝</button>
        <button class="remove-btn" onclick="Profile.removeFromShowcase(${album.id})" title="Remove from showcase">&times;</button>
      </div>
    `).join('');
  },

  /**
   * Show modal to edit showcase note
   */
  showShowcaseNoteModal(showcaseId) {
    const album = this.showcase.find(a => a.id === showcaseId);
    if (!album) return;

    const html = `
      <div class="note-modal-content">
        <h3>Add Note</h3>
        <p class="note-album-name">${this.escapeHtml(album.album)} - ${this.escapeHtml(album.artist)}</p>
        <textarea id="showcase-note-input" maxlength="200" placeholder="Why is this special to you?">${album.notes || ''}</textarea>
        <span class="char-count"><span id="note-char-count">${(album.notes || '').length}</span>/200</span>
        <div class="note-modal-actions">
          <button class="btn-cancel" onclick="Profile.closeShowcaseNoteModal()">Cancel</button>
          <button class="btn-clear" onclick="Profile.clearShowcaseNote(${showcaseId})">Clear</button>
          <button class="btn-save" onclick="Profile.saveShowcaseNote(${showcaseId})">Save</button>
        </div>
      </div>
    `;

    let modal = document.getElementById('showcase-note-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'showcase-note-modal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = html;
    modal.classList.add('open');

    // Add character counter
    document.getElementById('showcase-note-input').addEventListener('input', (e) => {
      document.getElementById('note-char-count').textContent = e.target.value.length;
    });
  },

  /**
   * Close showcase note modal
   */
  closeShowcaseNoteModal() {
    const modal = document.getElementById('showcase-note-modal');
    if (modal) modal.classList.remove('open');
  },

  /**
   * Save showcase note
   */
  async saveShowcaseNote(showcaseId) {
    const notesInput = document.getElementById('showcase-note-input');
    const notes = notesInput ? notesInput.value.trim() : '';

    try {
      // Send empty string as null to clear notes
      const response = await Auth.apiRequest(`/api/profile/me/showcase/${showcaseId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: notes || null })
      });

      if (response.ok) {
        const album = this.showcase.find(a => a.id === showcaseId);
        if (album) album.notes = notes || null;
        this.renderShowcase();
        this.closeShowcaseNoteModal();
      } else {
        console.error('Failed to save note:', await response.text());
      }
    } catch (error) {
      console.error('Error saving showcase note:', error);
    }
  },

  /**
   * Clear showcase note
   */
  async clearShowcaseNote(showcaseId) {
    try {
      const response = await Auth.apiRequest(`/api/profile/me/showcase/${showcaseId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: "" })
      });

      if (response.ok) {
        const album = this.showcase.find(a => a.id === showcaseId);
        if (album) album.notes = null;
        this.renderShowcase();
        this.closeShowcaseNoteModal();
      } else {
        const errorText = await response.text();
        console.error('Failed to clear note:', errorText);
        alert('Failed to clear note');
      }
    } catch (error) {
      console.error('Error clearing showcase note:', error);
    }
  },

  /**
   * Open edit profile modal
   */
  openEditProfileModal() {
    document.getElementById('edit-name').value = this.profile?.name || '';
    document.getElementById('edit-pronouns').value = this.profile?.pronouns || '';
    document.getElementById('edit-bio').value = this.profile?.bio || '';
    document.getElementById('bio-char-count').textContent = (this.profile?.bio || '').length;
    document.getElementById('edit-location').value = this.profile?.location || '';

    // Load social links dynamically
    this.populateSocialLinksEditor();

    // Load privacy settings
    const privacy = this.profile?.privacy || {};
    document.getElementById('privacy-visibility').value = privacy.profile_visibility || 'public';
    document.getElementById('privacy-collection').checked = privacy.show_collection !== false;
    document.getElementById('privacy-showcase').checked = privacy.show_showcase !== false;
    document.getElementById('privacy-searchable').checked = privacy.searchable !== false;

    document.getElementById('edit-profile-modal').classList.add('open');
  },

  /**
   * Save profile changes
   */
  async saveProfile() {
    const name = document.getElementById('edit-name').value.trim();
    const pronouns = document.getElementById('edit-pronouns').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const location = document.getElementById('edit-location').value.trim();

    // Get social links from dynamic form
    const external_links = this.getSocialLinksFromForm();

    // Get privacy settings
    const privacy = {
      profile_visibility: document.getElementById('privacy-visibility').value,
      show_collection: document.getElementById('privacy-collection').checked,
      show_showcase: document.getElementById('privacy-showcase').checked,
      searchable: document.getElementById('privacy-searchable').checked
    };

    try {
      // Save profile
      const profileResponse = await Auth.apiRequest('/api/profile/me', {
        method: 'PUT',
        body: JSON.stringify({ name, pronouns, bio, location, external_links })
      });

      // Save privacy settings separately
      const privacyResponse = await Auth.apiRequest('/api/profile/me/privacy', {
        method: 'PUT',
        body: JSON.stringify(privacy)
      });

      if (profileResponse.ok) {
        this.profile = await profileResponse.json();
        // Update privacy in profile object
        if (privacyResponse.ok) {
          this.profile.privacy = await privacyResponse.json();
        }
        this.renderProfile();
        this.closeModal('edit-profile-modal');
      } else {
        const error = await profileResponse.json();
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
   * Search Discogs via server-side proxy
   */
  async searchDiscogs() {
    const query = document.getElementById('discogs-query').value.trim();
    if (!query) return;

    const resultsEl = document.getElementById('search-results');
    resultsEl.innerHTML = '<div class="loading">Searching Discogs</div>';

    try {
      // Parse query into artist/album (best effort)
      const parts = query.split(' - ');
      const artist = parts[0]?.trim() || query;
      const album = parts[1]?.trim() || query;

      // Use server-side Discogs proxy
      const response = await Auth.apiRequest(`/api/discogs/search?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`);

      if (response.ok) {
        const data = await response.json();
        // Single result from search endpoint - wrap in array for renderSearchResults
        if (data.id) {
          this.renderSearchResults([{
            id: data.id,
            title: data.title || `${artist} - ${album}`,
            year: data.year,
            cover_image: data.cover,
            thumb: data.cover
          }]);
        } else {
          resultsEl.innerHTML = '<p style="color:#888;text-align:center;">No results found.</p>';
        }
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

  // ============================================
  // WISHLIST FUNCTIONALITY
  // ============================================

  wishlist: [],

  /**
   * Load wishlist items
   */
  async loadWishlist() {
    const categoryId = this.userCategories?.find(c => c.slug === this.currentCategorySlug)?.id;
    try {
      // Include found items so user can mark them unfound if needed
      let url = categoryId ? `/api/wishlist?category_id=${categoryId}` : '/api/wishlist';
      url += (url.includes('?') ? '&' : '?') + 'include_found=true';
      const response = await Auth.apiRequest(url);
      if (response.ok) {
        this.wishlist = await response.json();
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

    // Always show section on own profile page
    section.style.display = 'block';

    if (countEl) countEl.textContent = this.wishlist.length;

    if (this.wishlist.length === 0) {
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

    grid.innerHTML = this.wishlist.map(item => `
      <div class="wishlist-card priority-${priorityClasses[item.priority] || 'low'}">
        <div class="wishlist-header">
          <span class="wishlist-priority ${priorityClasses[item.priority] || 'low'}">${priorityLabels[item.priority] || 'Low'}</span>
          ${item.is_found ? '<span class="wishlist-found">Found!</span>' : ''}
        </div>
        <h4 class="wishlist-title">${this.escapeHtml(item.title)}</h4>
        ${item.artist ? `<p class="wishlist-artist">${this.escapeHtml(item.artist)}</p>` : ''}
        ${item.year ? `<p class="wishlist-year">${item.year}</p>` : ''}
        ${item.description ? `<p class="wishlist-desc">${this.escapeHtml(item.description)}</p>` : ''}
        <div class="wishlist-meta">
          ${item.condition_wanted ? `<span class="wishlist-condition">${this.escapeHtml(item.condition_wanted)}</span>` : ''}
          ${item.max_price ? `<span class="wishlist-price">Max $${item.max_price.toFixed(2)}</span>` : ''}
        </div>
        <div class="wishlist-actions">
          ${!item.is_found
            ? `<button class="wishlist-found-btn" onclick="Profile.markWishlistFound(${item.id})">Mark Found</button>`
            : `<button class="wishlist-unfound-btn" onclick="Profile.markWishlistUnfound(${item.id})">Mark Unfound</button>`}
          <button class="wishlist-delete-btn" onclick="Profile.deleteWishlistItem(${item.id})">&times;</button>
        </div>
      </div>
    `).join('');
  },

  /**
   * Open add wishlist modal
   */
  openAddWishlistModal() {
    document.getElementById('wishlist-title').value = '';
    document.getElementById('wishlist-artist').value = '';
    document.getElementById('wishlist-year').value = '';
    document.getElementById('wishlist-description').value = '';
    document.getElementById('wishlist-condition').value = '';
    document.getElementById('wishlist-max-price').value = '';
    document.getElementById('wishlist-priority').value = '0';
    document.getElementById('add-wishlist-modal').classList.add('open');
  },

  /**
   * Add item to wishlist
   */
  async addWishlistItem() {
    const categoryId = this.userCategories?.find(c => c.slug === this.currentCategorySlug)?.id;
    if (!categoryId) {
      alert('Please select a category first');
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
        this.wishlist.unshift(newItem);
        this.renderWishlist();
        this.closeModal('add-wishlist-modal');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to add item');
      }
    } catch (error) {
      console.error('Error adding wishlist item:', error);
      alert('Failed to add item');
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
    // Update locally first for instant feedback
    const item = this.wishlist.find(i => i.id === itemId);
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
        // Revert on error
        if (item) item.is_found = false;
        this.renderWishlist();
        const error = await response.json();
        console.error('Error marking item found:', error);
        alert(error.detail || 'Failed to mark item as found');
      }
    } catch (error) {
      // Revert on error
      if (item) item.is_found = false;
      this.renderWishlist();
      console.error('Error marking item found:', error);
      alert('Failed to mark item as found');
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
    // Update locally first for instant feedback
    const item = this.wishlist.find(i => i.id === itemId);
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
        // Revert on error
        if (item) item.is_found = true;
        this.renderWishlist();
        const error = await response.json();
        console.error('Error marking item unfound:', error);
        alert(error.detail || 'Failed to mark item as unfound');
      }
    } catch (error) {
      // Revert on error
      if (item) item.is_found = true;
      this.renderWishlist();
      console.error('Error marking item unfound:', error);
      alert('Failed to mark item as unfound');
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
    // Remove locally first for instant feedback
    const itemIndex = this.wishlist.findIndex(i => i.id === itemId);
    const removedItem = itemIndex >= 0 ? this.wishlist.splice(itemIndex, 1)[0] : null;
    this.renderWishlist();

    try {
      const response = await Auth.apiRequest(`/api/wishlist/${itemId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        // Revert on error
        if (removedItem) {
          this.wishlist.splice(itemIndex, 0, removedItem);
          this.renderWishlist();
        }
        const error = await response.json();
        console.error('Error deleting wishlist item:', error);
        alert(error.detail || 'Failed to delete item');
      }
    } catch (error) {
      // Revert on error
      if (removedItem) {
        this.wishlist.splice(itemIndex, 0, removedItem);
        this.renderWishlist();
      }
      console.error('Error deleting wishlist item:', error);
      alert('Failed to delete item');
    }
  },

  // Chat methods are now in /js/modules/chat.js and mixed in via Object.assign

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
    // Use %27 for single quotes and encodeURIComponent for the initial to avoid breaking inline JS handlers
    return `data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%231a1a1a%27 width=%27100%27 height=%27100%27/%3E%3Ctext x=%2750%27 y=%2760%27 font-size=%2740%27 text-anchor=%27middle%27 fill=%27%231db954%27%3E${encodeURIComponent(initial)}%3C/text%3E%3C/svg%3E`;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Sanitize URL to prevent javascript: and other dangerous protocols
   */
  sanitizeUrl(url) {
    if (!url) return '#';
    const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];
    try {
      const parsed = new URL(url);
      if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        return this.escapeHtml(url);
      }
      return '#';
    } catch {
      // If URL parsing fails, it might be a relative URL or invalid
      // Only allow if it doesn't look like a protocol
      if (url.includes(':') && !url.startsWith('http')) {
        return '#';
      }
      return this.escapeHtml(url);
    }
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
    // Use %27 for single quotes and encodeURIComponent for the initial to avoid breaking inline JS handlers
    return `data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%231a1a1a%27 width=%27100%27 height=%27100%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2745%27 text-anchor=%27middle%27 fill=%27%231db954%27%3E${encodeURIComponent(initial)}%3C/text%3E%3C/svg%3E`;
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
   * Populate filter dropdown options based on collection data
   */
  populateFilterOptions() {
    const genres = new Set();
    const years = new Set();

    this.collection.forEach(item => {
      if (item.genre) genres.add(item.genre);
      if (item.year) years.add(item.year);
    });

    // Populate genre dropdown
    const genreSelect = document.getElementById('filter-genre');
    if (genreSelect) {
      const sortedGenres = [...genres].sort();
      genreSelect.innerHTML = '<option value="">All Genres</option>' +
        sortedGenres.map(g => `<option value="${this.escapeHtml(g)}">${this.escapeHtml(g)}</option>`).join('');
    }

    // Populate year dropdown
    const yearSelect = document.getElementById('filter-year');
    if (yearSelect) {
      const sortedYears = [...years].sort((a, b) => b - a); // Descending
      yearSelect.innerHTML = '<option value="">All Years</option>' +
        sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
    }
  },

  /**
   * Apply all collection filters (search, genre, year, sort)
   */
  applyCollectionFilters() {
    const searchQuery = (document.getElementById('collection-search-input')?.value || '').toLowerCase().trim();
    const genreFilter = document.getElementById('filter-genre')?.value || '';
    const yearFilter = document.getElementById('filter-year')?.value || '';
    const sortBy = document.getElementById('filter-sort')?.value || 'recent';
    const grid = document.getElementById('collection-grid');

    // Filter collection
    let filtered = this.collection.filter(item => {
      // Search filter
      if (searchQuery) {
        const matchesSearch =
          item.artist.toLowerCase().includes(searchQuery) ||
          item.album.toLowerCase().includes(searchQuery) ||
          (item.genre && item.genre.toLowerCase().includes(searchQuery));
        if (!matchesSearch) return false;
      }

      // Genre filter
      if (genreFilter && item.genre !== genreFilter) return false;

      // Year filter
      if (yearFilter && String(item.year) !== yearFilter) return false;

      return true;
    });

    // Sort collection
    filtered = this.sortCollection(filtered, sortBy);

    // Check if no filters active
    const noFilters = !searchQuery && !genreFilter && !yearFilter && sortBy === 'recent';
    if (noFilters && filtered.length === this.collection.length) {
      this.renderCollection();
      return;
    }

    // Render filtered results
    if (filtered.length === 0) {
      const terms = this.getTerms();
      grid.innerHTML = `
        <div class="collection-empty">
          <div class="empty-icon">🔍</div>
          <p>No ${terms.itemPlural} found with current filters</p>
          <button onclick="Profile.clearFilters()" style="margin-top: 12px; padding: 8px 16px; background: var(--accent); border: none; border-radius: 6px; cursor: pointer; color: #000;">Clear Filters</button>
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
   * Sort collection array
   */
  sortCollection(items, sortBy) {
    const sorted = [...items];
    switch (sortBy) {
      case 'artist-asc':
        return sorted.sort((a, b) => a.artist.localeCompare(b.artist));
      case 'artist-desc':
        return sorted.sort((a, b) => b.artist.localeCompare(a.artist));
      case 'album-asc':
        return sorted.sort((a, b) => a.album.localeCompare(b.album));
      case 'album-desc':
        return sorted.sort((a, b) => b.album.localeCompare(a.album));
      case 'year-asc':
        return sorted.sort((a, b) => (a.year || 0) - (b.year || 0));
      case 'year-desc':
        return sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
      case 'recent':
      default:
        return sorted; // Already in recent order from API
    }
  },

  /**
   * Clear all collection filters
   */
  clearFilters() {
    document.getElementById('collection-search-input').value = '';
    document.getElementById('filter-genre').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-sort').value = 'recent';
    this.renderCollection();
  },

  /**
   * Filter own collection (legacy, redirects to new filter)
   */
  filterCollection(query) {
    document.getElementById('collection-search-input').value = query;
    this.applyCollectionFilters();
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
           data-friend-id="${friend.id}"
           data-friend-name="${this.escapeHtml(friend.name || '')}"
           data-friend-picture="${this.escapeHtml(friend.picture || '')}">
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

    // Add click handlers
    listEl.querySelectorAll('.friend-message-item').forEach(item => {
      item.addEventListener('click', () => {
        const friendId = parseInt(item.dataset.friendId);
        const friendName = item.dataset.friendName;
        const friendPicture = item.dataset.friendPicture;
        Profile.openConversation(friendId, friendName, friendPicture);
      });
    });
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
