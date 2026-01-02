/**
 * Profile Friends Module
 * Handles friends list, friend requests, and friend profile viewing
 */

const ProfileFriends = {
  /**
   * Load friends list
   */
  async loadFriends() {
    try {
      const response = await Auth.apiRequest('/api/friends/');
      if (response.ok) {
        Profile.friends = await response.json();
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
        Profile.friendRequests = await response.json();
        Profile.pendingRequestCount = Profile.friendRequests.length;
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

    if (!container) {
      const friendsSection = document.querySelector('.friends-section');
      if (!friendsSection) return;

      container = document.createElement('div');
      container.id = 'friend-requests-container';
      container.className = 'friend-requests-container';
      friendsSection.insertBefore(container, document.getElementById('friends-grid'));
    }

    if (Profile.friendRequests.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <h3 class="requests-title">Friend Requests <span class="request-badge">${Profile.friendRequests.length}</span></h3>
      <div class="requests-list">
        ${Profile.friendRequests.map(req => `
          <div class="request-card" data-id="${req.id}">
            <img src="${req.sender_picture || Profile.getDefaultAvatar(req.sender_name)}"
                 alt="${req.sender_name}"
                 class="request-avatar"
                 onerror="this.src='${Profile.getDefaultAvatar(req.sender_name)}'">
            <div class="request-info">
              <div class="request-name">${Profile.escapeHtml(req.sender_name || 'Anonymous')}</div>
              <div class="request-time">${Profile.formatTime(req.created_at)}</div>
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
        Profile.friendRequests = Profile.friendRequests.filter(r => r.id !== requestId);
        Profile.pendingRequestCount = Profile.friendRequests.length;
        this.renderFriendRequests();
        await this.loadFriends();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Auth.showError('Failed to accept request');
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
        Profile.friendRequests = Profile.friendRequests.filter(r => r.id !== requestId);
        Profile.pendingRequestCount = Profile.friendRequests.length;
        this.renderFriendRequests();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      Auth.showError('Failed to reject request');
    }
  },

  /**
   * Render friends grid
   */
  renderFriends() {
    const grid = document.getElementById('friends-grid');
    const countEl = document.getElementById('friends-count');

    if (countEl) countEl.textContent = Profile.friends.length;

    if (Profile.friends.length === 0) {
      grid.innerHTML = `
        <div class="friends-empty" id="friends-empty">
          <div class="empty-icon">👥</div>
          <p>No friends yet</p>
          <span>Add friends to connect with other collectors!</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = Profile.friends.map(friend => `
      <div class="friend-card" data-id="${friend.id}" onclick="Profile.viewFriendProfile(${friend.id})">
        <img src="${friend.picture || Profile.getDefaultAvatar(friend.name)}"
             alt="${friend.name || 'Friend'}"
             class="friend-avatar"
             onerror="this.src='${Profile.getDefaultAvatar(friend.name)}'">
        <div class="friend-name">${Profile.escapeHtml(friend.name || 'Anonymous')}</div>
        ${friend.pronouns ? `<div class="friend-pronouns">${Profile.escapeHtml(friend.pronouns)}</div>` : ''}
      </div>
    `).join('');
  },

  /**
   * Open add friend modal
   */
  openAddFriendModal() {
    document.getElementById('friend-name-input').value = '';
    document.getElementById('friend-search-result').innerHTML = '';
    document.getElementById('add-friend-confirm').disabled = true;
    Profile.searchedFriend = null;
    Profile.openModal('add-friend-modal');
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
          const alreadyFollowing = Profile.friends.some(f => f.id === user.id);
          const isMe = user.id === Profile.profile?.id;

          Profile.searchedFriend = isMe || alreadyFollowing ? null : user;

          resultEl.innerHTML = `
            <div class="friend-preview">
              <img src="${user.picture || Profile.getDefaultAvatar(user.name)}"
                   alt="${user.name}"
                   onerror="this.src='${Profile.getDefaultAvatar(user.name)}'">
              <div class="friend-preview-info">
                <h4>${Profile.escapeHtml(user.name || 'Anonymous')}</h4>
                <p>${user.bio ? Profile.escapeHtml(user.bio.substring(0, 60)) + '...' : 'No bio'}</p>
                ${alreadyFollowing ? '<span class="already-following">Already following</span>' : ''}
                ${isMe ? '<span class="already-following">This is you!</span>' : ''}
              </div>
            </div>
          `;

          confirmBtn.disabled = alreadyFollowing || isMe;
        } else {
          resultEl.innerHTML = '<div class="not-found">No user found with that name</div>';
          confirmBtn.disabled = true;
          Profile.searchedFriend = null;
        }
      } else {
        resultEl.innerHTML = '<div class="not-found">Search failed</div>';
        confirmBtn.disabled = true;
        Profile.searchedFriend = null;
      }
    } catch (error) {
      console.error('Error searching friend:', error);
    }
  },

  /**
   * Confirm sending friend request
   */
  async confirmAddFriend() {
    if (!Profile.searchedFriend) return;

    try {
      const response = await Auth.apiRequest('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ name: Profile.searchedFriend.name })
      });

      if (response.ok) {
        Profile.closeModal('add-friend-modal');
        Auth.showSuccess('Friend request sent!');
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to send request');
      }
    } catch (error) {
      console.error('Error sending request:', error);
      Auth.showError('Failed to send request');
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
        Profile.openModal('view-profile-modal');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  },

  /**
   * Render view profile modal
   */
  renderViewProfile(profile) {
    Profile.viewedProfile = profile;

    const bgEl = document.getElementById('view-profile-bg');
    if (profile.background_image) {
      bgEl.style.backgroundImage = `url(${profile.background_image})`;
    } else {
      bgEl.style.backgroundImage = '';
    }

    document.getElementById('view-profile-picture').src = profile.picture || Profile.getDefaultAvatar(profile.name);
    document.getElementById('view-profile-name').textContent = profile.name || 'Anonymous';

    const pronounsEl = document.getElementById('view-profile-pronouns');
    if (profile.pronouns) {
      pronounsEl.textContent = profile.pronouns;
      pronounsEl.style.display = 'inline-block';
    } else {
      pronounsEl.style.display = 'none';
    }

    document.getElementById('view-profile-bio').textContent = profile.bio || '';

    const terms = profile.featured_category_slug
      ? (Profile.categoryTerms[profile.featured_category_slug] || Profile.categoryTerms['vinyl'])
      : Profile.getTerms();
    const collectionCount = profile.collection_count || 0;
    const itemLabel = collectionCount === 1 ? terms.itemSingular : terms.itemPlural;
    document.getElementById('view-profile-collection-count').textContent = `${collectionCount} ${itemLabel}`;

    const actionsEl = document.getElementById('view-profile-actions');
    actionsEl.style.display = 'flex';

    // Determine block/unblock button based on current block status
    const blockButton = profile.is_blocked
      ? `<button class="btn-unblock" id="view-profile-unblock">Unblock</button>`
      : `<button class="btn-block" id="view-profile-block">Block</button>`;

    if (profile.is_friend) {
      actionsEl.innerHTML = `
        <button class="btn-message" id="view-profile-message">Message</button>
        <button class="btn-view-full" id="view-full-btn">View Full Profile</button>
        <button class="btn-unfriend" id="view-profile-unfollow">Unfriend</button>
        ${blockButton}
      `;
      document.getElementById('view-profile-message').onclick = () => ProfileFriends.messageFromProfile();
      document.getElementById('view-full-btn').onclick = () => {
        Profile.closeModal('view-profile-modal');
        ProfileFriends.openFriendFullProfile(profile.id);
      };
      document.getElementById('view-profile-unfollow').onclick = () => ProfileFriends.unfollowFromProfile();
    } else if (profile.request_sent) {
      actionsEl.innerHTML = `
        <button class="btn-pending" disabled>Request Sent</button>
        ${blockButton}
      `;
    } else if (profile.request_received) {
      actionsEl.innerHTML = `
        <button class="btn-accept" onclick="Profile.acceptRequestFromProfile(${profile.request_id})">Accept Request</button>
        <button class="btn-reject" onclick="Profile.rejectRequestFromProfile(${profile.request_id})">Reject</button>
        ${blockButton}
      `;
    } else {
      actionsEl.innerHTML = `
        <button class="btn-add-friend" onclick="Profile.sendRequestFromProfile()">Send Request</button>
        ${blockButton}
      `;
    }

    // Attach block/unblock handler
    if (profile.is_blocked) {
      document.getElementById('view-profile-unblock').onclick = () => ProfileFriends.unblockFromProfile();
    } else {
      document.getElementById('view-profile-block').onclick = () => ProfileFriends.blockFromProfile();
    }

    const showcaseTitle = document.getElementById('view-showcase-title');
    if (profile.featured_category_name) {
      showcaseTitle.textContent = `${profile.featured_category_name} Showcase`;
    } else {
      showcaseTitle.textContent = 'Showcase';
    }

    const showcaseGrid = document.getElementById('view-showcase-grid');
    if (profile.showcase && profile.showcase.length > 0) {
      showcaseGrid.innerHTML = profile.showcase.map(album => `
        <div class="showcase-item">
          <img src="${album.cover || Profile.getPlaceholderCover(album)}"
               alt="${album.album}"
               onerror="this.src='${Profile.getPlaceholderCover(album)}'">
        </div>
      `).join('');
    } else {
      const showcaseTerms = Profile.getTerms();
      showcaseGrid.innerHTML = `<div class="showcase-empty-msg">No ${showcaseTerms.itemPlural} in showcase</div>`;
    }

    Profile.viewedProfileCollection = null;
  },

  /**
   * Open full page friend profile view
   */
  async openFriendFullProfile(userId) {
    const profileView = document.getElementById('profile-view');
    const forumsView = document.getElementById('forums-view');
    let friendPage = document.getElementById('friend-profile-page');

    if (!friendPage) {
      friendPage = document.createElement('div');
      friendPage.id = 'friend-profile-page';
      friendPage.className = 'friend-profile-page';
      profileView.parentNode.insertBefore(friendPage, profileView.nextSibling);
    }

    profileView.style.display = 'none';
    if (forumsView) forumsView.style.display = 'none';
    friendPage.style.display = 'block';
    friendPage.innerHTML = '<div class="friend-profile-loading">Loading profile...</div>';

    try {
      const [profileRes, categoriesRes] = await Promise.all([
        Auth.apiRequest(`/api/friends/user/${userId}`),
        Auth.apiRequest(`/api/friends/user/${userId}/categories`)
      ]);

      if (!profileRes.ok) throw new Error('Failed to load profile');

      const profile = await profileRes.json();
      const categories = categoriesRes.ok ? await categoriesRes.json() : [];

      let initialCategoryId = null;
      let initialCategorySlug = null;

      if (profile.featured_category_id && categories.some(c => c.id === profile.featured_category_id)) {
        initialCategoryId = profile.featured_category_id;
        const featuredCat = categories.find(c => c.id === profile.featured_category_id);
        initialCategorySlug = featuredCat?.slug;
      } else if (categories.length > 0) {
        initialCategoryId = categories[0].id;
        initialCategorySlug = categories[0].slug;
      }

      Profile.friendProfileState = {
        userId,
        profile,
        categories,
        currentCategoryId: initialCategoryId,
        showcase: [],
        collection: [],
        wishlist: []
      };

      if (initialCategorySlug) {
        ProfileUI.applyCategoryColor(initialCategorySlug);
      }

      if (Profile.friendProfileState.currentCategoryId) {
        await this.loadFriendCategoryData(userId, Profile.friendProfileState.currentCategoryId);
      } else {
        const [showcaseRes, collectionRes, wishlistRes] = await Promise.all([
          Auth.apiRequest(`/api/friends/user/${userId}/showcase`),
          Auth.apiRequest(`/api/friends/user/${userId}/collection`),
          Auth.apiRequest(`/api/friends/user/${userId}/wishlist`)
        ]);
        Profile.friendProfileState.showcase = showcaseRes.ok ? await showcaseRes.json() : [];
        Profile.friendProfileState.collection = collectionRes.ok ? await collectionRes.json() : [];
        Profile.friendProfileState.wishlist = wishlistRes.ok ? await wishlistRes.json() : [];
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
      const [showcaseRes, collectionRes, wishlistRes] = await Promise.all([
        Auth.apiRequest(`/api/friends/user/${userId}/showcase?category_id=${categoryId}`),
        Auth.apiRequest(`/api/friends/user/${userId}/collection?category_id=${categoryId}`),
        Auth.apiRequest(`/api/friends/user/${userId}/wishlist?category_id=${categoryId}`)
      ]);

      Profile.friendProfileState.showcase = showcaseRes.ok ? await showcaseRes.json() : [];
      Profile.friendProfileState.collection = collectionRes.ok ? await collectionRes.json() : [];
      Profile.friendProfileState.wishlist = wishlistRes.ok ? await wishlistRes.json() : [];
    } catch (error) {
      console.error('Error loading friend category data:', error);
    }
  },

  /**
   * Switch friend profile category
   */
  async switchFriendCategory(categoryId) {
    if (!Profile.friendProfileState.userId) return;

    Profile.friendProfileState.currentCategoryId = categoryId;

    const friendCategory = Profile.friendProfileState.categories.find(c => c.id === categoryId);
    if (friendCategory && friendCategory.slug) {
      ProfileUI.applyCategoryColor(friendCategory.slug);
    }

    await this.loadFriendCategoryData(Profile.friendProfileState.userId, categoryId);
    this.renderFriendFullProfile();
  },

  /**
   * Render full page friend profile
   */
  renderFriendFullProfile() {
    const { profile, categories, currentCategoryId, showcase, collection, wishlist } = Profile.friendProfileState;
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
          <img src="${profile.picture || Profile.getDefaultAvatar(profile.name)}"
               alt="${profile.name}"
               class="friend-profile-picture"
               onerror="this.src='${Profile.getDefaultAvatar(profile.name)}'">
          <div class="friend-profile-info">
            <h1 class="friend-profile-name">${Profile.escapeHtml(profile.name || 'Anonymous')}</h1>
            ${profile.pronouns ? `<span class="friend-profile-pronouns">${Profile.escapeHtml(profile.pronouns)}</span>` : ''}
            ${profile.bio ? `<p class="friend-profile-bio">${Profile.escapeHtml(profile.bio)}</p>` : ''}
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
                <img src="${album.cover || Profile.getPlaceholderCover(album)}"
                     alt="${album.album}"
                     onerror="this.src='${Profile.getPlaceholderCover(album)}'">
                <div class="showcase-info">
                  <span class="showcase-album">${Profile.escapeHtml(album.album)}</span>
                  <span class="showcase-artist">${Profile.escapeHtml(album.artist)}</span>
                  ${Profile.renderItemTags(album.tags)}
                  ${album.notes ? `<div class="showcase-note">${Profile.escapeHtml(album.notes)}</div>` : ''}
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
                <img src="${album.cover || Profile.getPlaceholderCover(album)}"
                     alt="${album.album}"
                     onerror="this.src='${Profile.getPlaceholderCover(album)}'">
                <div class="collection-info">
                  <span class="collection-album">${Profile.escapeHtml(album.album)}</span>
                  <span class="collection-artist">${Profile.escapeHtml(album.artist)}</span>
                  ${Profile.renderItemTags(album.tags)}
                </div>
              </div>
            `).join('') : '<p class="empty-msg">No items in collection</p>'}
          </div>
        </div>

        ${wishlist && wishlist.length > 0 ? `
        <div class="friend-profile-section">
          <h2 class="section-title">🔍 Currently Seeking
            <span class="collection-count">(${wishlist.length})</span>
          </h2>
          <div class="friend-wishlist-grid">
            ${wishlist.map(item => `
              <div class="wishlist-item priority-${item.priority}">
                <div class="wishlist-info">
                  <span class="wishlist-title">${Profile.escapeHtml(item.title)}</span>
                  ${item.artist ? `<span class="wishlist-artist">${Profile.escapeHtml(item.artist)}</span>` : ''}
                  ${item.description ? `<p class="wishlist-description">${Profile.escapeHtml(item.description)}</p>` : ''}
                  ${item.condition_wanted ? `<span class="wishlist-condition">Wanted: ${Profile.escapeHtml(item.condition_wanted)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
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

    if (Profile.currentCategorySlug) {
      ProfileUI.applyCategoryColor(Profile.currentCategorySlug);
    }

    const activeTab = localStorage.getItem('ncc_active_tab') || 'profile';
    if (activeTab === 'forums' && forumsView) {
      if (profileView) profileView.style.display = 'none';
      forumsView.style.display = 'block';
    } else {
      if (profileView) profileView.style.display = 'block';
      if (forumsView) forumsView.style.display = 'none';
    }

    Profile.friendProfileState = {
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
    if (!Profile.friendProfileState.profile) return;
    const { profile } = Profile.friendProfileState;
    this.closeFriendFullProfile();
    ProfileMessages.openConversation(profile.id, profile.name || '', profile.picture || '');
  },

  /**
   * Message from profile view
   */
  messageFromProfile() {
    if (!Profile.viewedProfile) return;
    Profile.closeModal('view-profile-modal');
    ProfileMessages.openConversation(
      Profile.viewedProfile.id,
      Profile.viewedProfile.name || 'Anonymous',
      Profile.viewedProfile.picture || ''
    );
  },

  /**
   * Send friend request from profile view
   */
  async sendRequestFromProfile() {
    if (!Profile.viewedProfile) return;

    try {
      const response = await Auth.apiRequest('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ name: Profile.viewedProfile.name })
      });

      if (response.ok) {
        Profile.viewedProfile.request_sent = true;
        this.renderViewProfile(Profile.viewedProfile);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to send request');
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
        await this.loadFriends();
        await this.loadFriendRequests();

        Profile.viewedProfile.is_friend = true;
        Profile.viewedProfile.request_received = false;
        Profile.viewedProfile.request_id = null;
        this.renderViewProfile(Profile.viewedProfile);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to accept request');
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
        Profile.closeModal('view-profile-modal');
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  },

  /**
   * Unfriend from profile view (no confirmation popup)
   */
  async unfollowFromProfile() {
    if (!Profile.viewedProfile) return;

    try {
      const response = await Auth.apiRequest(`/api/friends/${Profile.viewedProfile.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        Profile.friends = Profile.friends.filter(f => f.id !== Profile.viewedProfile.id);
        ProfileFriends.renderFriends();
        Profile.closeModal('view-profile-modal');
        Auth.showSuccess('Friend removed');
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to remove friend');
      }
    } catch (error) {
      console.error('Error unfriending:', error);
      Auth.showError('Failed to remove friend');
    }
  },

  /**
   * Block user from profile view (no confirmation popup)
   */
  async blockFromProfile() {
    if (!Profile.viewedProfile) return;

    try {
      const response = await Auth.apiRequest(`/api/users/${Profile.viewedProfile.id}/block`, {
        method: 'POST'
      });

      if (response.ok) {
        // Remove from friends list if they were a friend
        Profile.friends = Profile.friends.filter(f => f.id !== Profile.viewedProfile.id);
        ProfileFriends.renderFriends();
        Profile.closeModal('view-profile-modal');
        Auth.showSuccess('User blocked');
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking:', error);
      Auth.showError('Failed to block user');
    }
  },

  /**
   * Unblock user from profile view
   */
  async unblockFromProfile() {
    if (!Profile.viewedProfile) return;

    try {
      const response = await Auth.apiRequest(`/api/users/${Profile.viewedProfile.id}/block`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Update the viewed profile's blocked status
        Profile.viewedProfile.is_blocked = false;
        // Re-render the profile modal with updated block status
        this.renderViewProfile(Profile.viewedProfile);
        Auth.showSuccess('User unblocked');
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Error unblocking:', error);
      Auth.showError('Failed to unblock user');
    }
  },

  /**
   * Load and display full profile with collection
   */
  async loadFullProfile() {
    if (!Profile.viewedProfile) return;

    const btn = document.getElementById('view-full-profile-btn');
    const collectionSection = document.getElementById('view-profile-collection');

    if (collectionSection.style.display !== 'none') {
      collectionSection.style.display = 'none';
      btn.textContent = 'View Full Profile';
      return;
    }

    btn.textContent = 'Loading...';

    try {
      const response = await Auth.apiRequest(`/api/friends/user/${Profile.viewedProfile.id}/collection`);

      if (response.ok) {
        const collection = await response.json();
        Profile.viewedProfileCollection = collection;

        document.getElementById('view-collection-count').textContent = `(${collection.length})`;
        this.renderViewCollection(collection);
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
      const collTerms = Profile.getTerms();
      grid.innerHTML = `<div class="showcase-empty-msg">No ${collTerms.itemPlural} in collection</div>`;
      return;
    }

    grid.innerHTML = collection.map(album => `
      <div class="album-card">
        <img src="${album.cover || Profile.getPlaceholderCover(album)}"
             alt="${album.album}"
             onerror="this.src='${Profile.getPlaceholderCover(album)}'">
        <div class="album-info">
          <p class="album-title">${Profile.escapeHtml(album.album)}</p>
          <p class="album-artist">${Profile.escapeHtml(album.artist)}</p>
        </div>
      </div>
    `).join('');
  },

  /**
   * Filter viewed profile's collection
   */
  filterViewCollection(query) {
    if (!Profile.viewedProfileCollection) return;

    const q = query.toLowerCase().trim();

    if (!q) {
      this.renderViewCollection(Profile.viewedProfileCollection);
      return;
    }

    const filtered = Profile.viewedProfileCollection.filter(a =>
      a.artist.toLowerCase().includes(q) ||
      a.album.toLowerCase().includes(q)
    );

    this.renderViewCollection(filtered);
  }
};

// Export for use
if (typeof window !== 'undefined') window.ProfileFriends = ProfileFriends;
