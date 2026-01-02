/**
 * Niche Collector Connector - Profile Page Logic
 * Main entry point that combines all profile modules
 */

// Create the Profile object by merging all modules
const Profile = Object.assign(
  {},
  // Core module provides shared state and utilities
  ProfileCore,
  {
    /**
     * Initialize the profile page
     */
    async init() {
      // Handle OAuth callback first (extracts token from URL if present)
      Auth.init();

      // Then check authentication
      if (!Auth.isAuthenticated()) {
        console.log('[Profile] Not authenticated, redirecting to login');
        window.location.href = '/';
        return;
      }

      // Setup event listeners
      this.setupEventListeners();
      ProfileModals.setupCropperListeners();

      // Load profile and user categories first (needed for category filtering)
      await Promise.all([
        ProfileUI.loadProfile(),
        ProfileUI.loadUserCategories(),
        ProfileFriends.loadFriends(),
        ProfileFriends.loadFriendRequests(),
        ProfileMessages.loadUnreadCount()
      ]);

      // Now load collection, showcase, and wishlist with category filter applied
      await Promise.all([
        ProfileCollection.loadCollection(),
        ProfileShowcase.loadShowcase(),
        ProfileUI.loadWishlist()
      ]);

      // Render user menu
      ProfileUI.renderUserMenu();

      // Render collection summary card (and fetch stats for profile completion)
      await ProfileUI.renderCollectionSummary();

      // Update profile completion now that we have all data including stats
      ProfileUI.renderProfileCompletion();

      // Start polling for updates (messages, friend requests, friends)
      ProfileMessages.startPolling();

      // Fill in missing album covers in background
      ProfileCollection.fillMissingCovers();

      // Restore saved main tab (Profile/Forums)
      if (typeof Forums !== 'undefined') {
        Forums.restoreSavedTab();
      }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
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
            sidebar.style.height = `${window.visualViewport.height}px`;
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
        // Also close messages sidebar
        ProfileMessages.closeMessagesSidebar();
      });

      // AI Chat form
      addListener('ai-input-form', 'submit', (e) => {
        e.preventDefault();
        ProfileChat.sendChatMessage();
      });

      // AI file upload for bulk album adding
      addListener('ai-upload-btn', 'click', () => {
        document.getElementById('ai-file-input')?.click();
      });

      addListener('ai-file-input', 'change', (e) => {
        if (e.target.files[0]) {
          ProfileChat.handleAlbumFileUpload(e.target.files[0]);
          e.target.value = '';
        }
      });

      // Edit Profile
      addListener('edit-profile-btn', 'click', () => {
        ProfileModals.openEditProfileModal();
      });

      addListener('edit-profile-close', 'click', () => {
        this.closeModal('edit-profile-modal');
      });

      addListener('edit-profile-cancel', 'click', () => {
        this.closeModal('edit-profile-modal');
      });

      addListener('edit-profile-form', 'submit', (e) => {
        e.preventDefault();
        ProfileModals.saveProfile();
      });

      // Share Profile Button
      addListener('share-profile-btn', 'click', (e) => {
        e.stopPropagation();
        ProfileUI.toggleShareDropdown();
      });

      // Share options click handlers
      document.querySelectorAll('.share-option').forEach(option => {
        option.addEventListener('click', (e) => {
          const shareType = e.currentTarget.dataset.share;
          ProfileUI.handleShare(shareType);
        });
      });

      // Close share dropdown when clicking outside
      document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('share-dropdown');
        const shareBtn = document.getElementById('share-profile-btn');
        if (dropdown && shareBtn && !shareBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove('active');
          shareBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Bio character count
      addListener('edit-bio', 'input', (e) => {
        const countEl = document.getElementById('bio-char-count');
        if (countEl) countEl.textContent = e.target.value.length;
      });

      // Social links add button
      addListener('add-social-btn', 'click', () => {
        ProfileModals.showSocialPicker();
      });

      // Add to Showcase button
      addListener('add-to-showcase-btn', 'click', () => {
        if (this.collection.length === 0) {
          ProfileModals.openAddRecordModal();
        } else {
          ProfileShowcase.openShowcaseModal();
        }
      });

      // Add Record button (in collection section)
      addListener('add-record-btn', 'click', () => {
        ProfileModals.openAddRecordModal();
      });

      // Add record modal events
      addListener('add-record-close', 'click', () => {
        this.closeModal('add-record-modal');
      });

      addListener('manual-add-cancel', 'click', () => {
        this.closeModal('add-record-modal');
      });

      addListener('manual-add-form', 'submit', (e) => {
        e.preventDefault();
        ProfileCollection.addRecordManually();
      });

      addListener('discogs-search-form', 'submit', (e) => {
        e.preventDefault();
        ProfileCollection.searchDiscogs();
      });

      // Showcase modal
      addListener('showcase-modal-close', 'click', () => {
        this.closeModal('showcase-modal');
      });

      // Collection filtering
      addListener('collection-search-input', 'input', () => {
        ProfileCollection.applyCollectionFilters();
      });

      addListener('filter-genre', 'change', () => {
        ProfileCollection.applyCollectionFilters();
      });

      addListener('filter-year', 'change', () => {
        ProfileCollection.applyCollectionFilters();
      });

      addListener('filter-sort', 'change', () => {
        ProfileCollection.applyCollectionFilters();
      });

      // Photo upload
      addListener('photo-upload-input', 'change', (e) => {
        if (e.target.files[0]) {
          ProfileModals.handlePhotoUpload(e.target.files[0]);
          e.target.value = '';
        }
      });

      // Background upload
      addListener('bg-upload-input', 'change', (e) => {
        if (e.target.files[0]) {
          ProfileModals.handleBackgroundUpload(e.target.files[0]);
          e.target.value = '';
        }
      });

      // Profile picture click to upload
      const profilePic = document.getElementById('profile-picture');
      if (profilePic) {
        profilePic.addEventListener('click', () => {
          document.getElementById('photo-upload-input')?.click();
        });
      }

      // Background click to upload
      const heroBg = document.getElementById('hero-background');
      if (heroBg) {
        heroBg.addEventListener('dblclick', () => {
          document.getElementById('bg-upload-input')?.click();
        });
      }

      // Messages toggle button
      addListener('messages-toggle-btn', 'click', () => {
        ProfileMessages.openMessagesSidebar();
      });

      // Messages sidebar close
      addListener('messages-close-btn', 'click', () => {
        ProfileMessages.closeMessagesSidebar();
      });

      // Conversation back button
      addListener('conversation-back-btn', 'click', () => {
        ProfileMessages.backToConversations();
      });

      // Message send
      addListener('message-form', 'submit', (e) => {
        e.preventDefault();
        ProfileMessages.sendMessage();
      });

      // Add Friend
      addListener('add-friend-btn', 'click', () => {
        ProfileFriends.openAddFriendModal();
      });

      addListener('add-friend-close', 'click', () => {
        this.closeModal('add-friend-modal');
      });

      addListener('add-friend-cancel', 'click', () => {
        this.closeModal('add-friend-modal');
      });

      addListener('friend-name-input', 'input', (e) => {
        clearTimeout(this.friendSearchTimeout);
        this.friendSearchTimeout = setTimeout(() => {
          ProfileFriends.searchFriend(e.target.value);
        }, 300);
      });

      addListener('add-friend-confirm', 'click', () => {
        ProfileFriends.confirmAddFriend();
      });

      // View profile modal close
      addListener('view-profile-close', 'click', () => {
        this.closeModal('view-profile-modal');
      });

      // Wishlist
      addListener('add-wishlist-btn', 'click', () => {
        ProfileModals.openAddWishlistModal();
      });

      addListener('add-wishlist-close', 'click', () => {
        this.closeModal('add-wishlist-modal');
      });

      addListener('add-wishlist-cancel', 'click', () => {
        this.closeModal('add-wishlist-modal');
      });

      addListener('add-wishlist-form', 'submit', (e) => {
        e.preventDefault();
        ProfileUI.addWishlistItem();
      });

      // Tab switching (manual/discogs in add record modal)
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tab = e.target.dataset.tab;
          if (!tab) return;

          const modal = e.target.closest('.modal-content');
          if (!modal) return;

          modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

          e.target.classList.add('active');
          modal.querySelector(`#tab-${tab}`)?.classList.add('active');
        });
      });
    },

    // ============================================
    // CONVENIENCE PROXIES TO MODULE METHODS
    // These maintain backward compatibility with existing code
    // ============================================

    // Collection methods
    loadCollection: () => ProfileCollection.loadCollection(),
    renderCollection: () => ProfileCollection.renderCollection(),
    addAlbumSorted: (album) => ProfileCollection.addAlbumSorted(album),
    removeFromCollection: (albumId) => ProfileCollection.removeFromCollection(albumId),
    fillMissingCovers: () => ProfileCollection.fillMissingCovers(),
    refreshCover: (albumId) => ProfileCollection.refreshCover(albumId),
    applyCollectionFilters: () => ProfileCollection.applyCollectionFilters(),
    clearFilters: () => ProfileCollection.clearFilters(),
    filterCollection: (query) => ProfileCollection.filterCollection(query),
    addRecordManually: () => ProfileCollection.addRecordManually(),
    searchDiscogs: () => ProfileCollection.searchDiscogs(),
    addFromDiscogs: (albumData) => ProfileCollection.addFromDiscogs(albumData),
    showTagModal: (albumId) => ProfileCollection.showTagModal(albumId),
    closeTagModal: () => ProfileCollection.closeTagModal(),
    saveItemTags: (albumId) => ProfileCollection.saveItemTags(albumId),
    clearItemTags: (albumId) => ProfileCollection.clearItemTags(albumId),
    showImageModal: (albumId) => ProfileCollection.showImageModal(albumId),
    hideImageModal: () => ProfileCollection.hideImageModal(),
    saveImage: () => ProfileCollection.saveImage(),

    // Showcase methods
    loadShowcase: () => ProfileShowcase.loadShowcase(),
    renderShowcase: () => ProfileShowcase.renderShowcase(),
    addToShowcase: (collectionId) => ProfileShowcase.addToShowcase(collectionId),
    removeFromShowcase: (showcaseId) => ProfileShowcase.removeFromShowcase(showcaseId),
    openShowcaseModal: () => ProfileShowcase.openShowcaseModal(),
    showShowcaseNoteModal: (showcaseId) => ProfileShowcase.showShowcaseNoteModal(showcaseId),
    closeShowcaseNoteModal: () => ProfileShowcase.closeShowcaseNoteModal(),
    saveShowcaseNote: (showcaseId) => ProfileShowcase.saveShowcaseNote(showcaseId),
    clearShowcaseNote: (showcaseId) => ProfileShowcase.clearShowcaseNote(showcaseId),

    // Friends methods
    loadFriends: () => ProfileFriends.loadFriends(),
    loadFriendRequests: () => ProfileFriends.loadFriendRequests(),
    renderFriends: () => ProfileFriends.renderFriends(),
    renderFriendRequests: () => ProfileFriends.renderFriendRequests(),
    acceptRequest: (requestId) => ProfileFriends.acceptRequest(requestId),
    rejectRequest: (requestId) => ProfileFriends.rejectRequest(requestId),
    openAddFriendModal: () => ProfileFriends.openAddFriendModal(),
    searchFriend: (name) => ProfileFriends.searchFriend(name),
    confirmAddFriend: () => ProfileFriends.confirmAddFriend(),
    viewFriendProfile: (userId) => ProfileFriends.viewFriendProfile(userId),
    renderViewProfile: (profile) => ProfileFriends.renderViewProfile(profile),
    openFriendFullProfile: (userId) => ProfileFriends.openFriendFullProfile(userId),
    switchFriendCategory: (categoryId) => ProfileFriends.switchFriendCategory(categoryId),
    closeFriendFullProfile: () => ProfileFriends.closeFriendFullProfile(),
    messageFromFriendProfile: () => ProfileFriends.messageFromFriendProfile(),
    messageFromProfile: () => ProfileFriends.messageFromProfile(),
    sendRequestFromProfile: () => ProfileFriends.sendRequestFromProfile(),
    acceptRequestFromProfile: (requestId) => ProfileFriends.acceptRequestFromProfile(requestId),
    rejectRequestFromProfile: (requestId) => ProfileFriends.rejectRequestFromProfile(requestId),
    unfollowFromProfile: () => ProfileFriends.unfollowFromProfile(),
    blockFromProfile: () => ProfileFriends.blockFromProfile(),
    loadFullProfile: () => ProfileFriends.loadFullProfile(),
    filterViewCollection: (query) => ProfileFriends.filterViewCollection(query),

    // Messages methods
    loadUnreadCount: () => ProfileMessages.loadUnreadCount(),
    updateUnreadBadge: () => ProfileMessages.updateUnreadBadge(),
    startPolling: () => ProfileMessages.startPolling(),
    openMessagesSidebar: () => ProfileMessages.openMessagesSidebar(),
    closeMessagesSidebar: () => ProfileMessages.closeMessagesSidebar(),
    renderFriendsMessageList: () => ProfileMessages.renderFriendsMessageList(),
    showFriendsList: () => ProfileMessages.showFriendsList(),
    openConversation: (userId, userName, userPicture) => ProfileMessages.openConversation(userId, userName, userPicture),
    loadConversationMessages: (userId) => ProfileMessages.loadConversationMessages(userId),
    renderMessages: () => ProfileMessages.renderMessages(),
    backToConversations: () => ProfileMessages.backToConversations(),
    sendMessage: () => ProfileMessages.sendMessage(),

    // Chat methods
    sendChatMessage: () => ProfileChat.sendChatMessage(),
    handleAlbumFileUpload: (file) => ProfileChat.handleAlbumFileUpload(file),
    addChatMessage: (content, role) => ProfileChat.addChatMessage(content, role),

    // Modal methods
    openEditProfileModal: () => ProfileModals.openEditProfileModal(),
    saveProfile: () => ProfileModals.saveProfile(),
    openAddRecordModal: () => ProfileModals.openAddRecordModal(),
    handlePhotoUpload: (file) => ProfileModals.handlePhotoUpload(file),
    handleBackgroundUpload: (file) => ProfileModals.handleBackgroundUpload(file),
    closeCropper: () => ProfileModals.closeCropper(),
    saveCroppedImage: () => ProfileModals.saveCroppedImage(),
    openAddWishlistModal: () => ProfileModals.openAddWishlistModal(),
    populateSocialLinksEditor: () => ProfileModals.populateSocialLinksEditor(),
    getSocialLinksFromForm: () => ProfileModals.getSocialLinksFromForm(),
    showSocialPicker: () => ProfileModals.showSocialPicker(),
    closeSocialPicker: () => ProfileModals.closeSocialPicker(),
    selectSocialPlatform: (platform) => ProfileModals.selectSocialPlatform(platform),
    populateFeaturedCategoryDropdown: () => ProfileModals.populateFeaturedCategoryDropdown(),
    setupCropperListeners: () => ProfileModals.setupCropperListeners(),

    // UI methods
    loadProfile: () => ProfileUI.loadProfile(),
    renderProfile: () => ProfileUI.renderProfile(),
    loadUserCategories: () => ProfileUI.loadUserCategories(),
    renderCategoryTabs: () => ProfileUI.renderCategoryTabs(),
    switchCategory: (slug) => ProfileUI.switchCategory(slug),
    applyCategoryColor: (slug) => ProfileUI.applyCategoryColor(slug),
    renderCollectionSummary: () => ProfileUI.renderCollectionSummary(),
    updateCollectorScoreInstantly: (showcaseDelta, collectionDelta) => ProfileUI.updateCollectorScoreInstantly(showcaseDelta, collectionDelta),
    renderProfileCompletion: () => ProfileUI.renderProfileCompletion(),
    renderUserMenu: () => ProfileUI.renderUserMenu(),
    toggleShareDropdown: () => ProfileUI.toggleShareDropdown(),
    handleShare: (type) => ProfileUI.handleShare(type),
    renderSocialLinks: (links) => ProfileUI.renderSocialLinks(links),

    // Wishlist methods
    loadWishlist: () => ProfileUI.loadWishlist(),
    renderWishlist: () => ProfileUI.renderWishlist(),
    addWishlistItem: () => ProfileUI.addWishlistItem(),
    markWishlistFound: (itemId) => ProfileUI.markWishlistFound(itemId),
    markWishlistUnfound: (itemId) => ProfileUI.markWishlistUnfound(itemId),
    deleteWishlistItem: (itemId) => ProfileUI.deleteWishlistItem(itemId)
  }
);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Profile.init());
} else {
  Profile.init();
}

// Expose globally
window.Profile = Profile;
