/**
 * Friends Module for Profile
 * Handles friend requests, friend list, and friend profiles
 */

const FriendsModule = {
  async loadFriends() {
    try {
      const response = await Auth.apiRequest('/api/friends/');
      if (response.ok) {
        const data = await response.json();
        this.friends = data.friends || [];
        this.renderFriends();
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  },

  async loadFriendRequests() {
    try {
      const response = await Auth.apiRequest('/api/friends/requests');
      if (response.ok) {
        const data = await response.json();
        this.friendRequests = data.requests || [];
        this.pendingRequestCount = this.friendRequests.length;
        this.renderFriendRequests();
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  },

  renderFriendRequests() {
    let container = document.getElementById('friend-requests-container');
    if (!container) {
      const friendsSection = document.querySelector('.friends-section');
      if (!friendsSection) return;
      container = document.createElement('div');
      container.id = 'friend-requests-container';
      friendsSection.insertBefore(container, friendsSection.firstChild);
    }

    if (this.friendRequests.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="friend-requests">
        <h4>Friend Requests (${this.friendRequests.length})</h4>
        ${this.friendRequests.map(req => `
          <div class="friend-request-item">
            <img src="${req.picture || ''}" alt="" class="friend-avatar" onerror="this.src='${this.getDefaultAvatar(req.name)}'">
            <span class="friend-name">${this.escapeHtml(req.name || 'User')}</span>
            <div class="request-actions">
              <button class="btn-accept" onclick="Profile.acceptRequest(${req.id})">Accept</button>
              <button class="btn-reject" onclick="Profile.rejectRequest(${req.id})">Decline</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async acceptRequest(requestId) {
    try {
      const response = await Auth.apiRequest(`/api/friends/requests/${requestId}/accept`, {
        method: 'POST'
      });
      if (response.ok) {
        await this.loadFriendRequests();
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

  async rejectRequest(requestId) {
    try {
      const response = await Auth.apiRequest(`/api/friends/requests/${requestId}/reject`, {
        method: 'POST'
      });
      if (response.ok) {
        await this.loadFriendRequests();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request');
    }
  },

  renderFriends() {
    const grid = document.getElementById('friends-grid');
    const countEl = document.getElementById('friends-count');

    if (countEl) countEl.textContent = this.friends.length;

    if (this.friends.length === 0) {
      grid.innerHTML = `
        <div class="empty-friends">
          <p>No friends yet</p>
          <p class="hint">Search for friends by their username</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.friends.map(friend => `
      <div class="friend-card" onclick="Profile.viewFriendProfile(${friend.id})">
        <img src="${friend.picture || ''}" alt="" class="friend-avatar" onerror="this.src='${this.getDefaultAvatar(friend.name)}'">
        <span class="friend-name">${this.escapeHtml(friend.name || 'User')}</span>
      </div>
    `).join('');
  },

  getDefaultAvatar(name) {
    const initial = (name || 'U').charAt(0).toUpperCase();
    // URL-encode to avoid breaking inline JS handlers with quotes
    return `data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2740%27 height=%2740%27%3E%3Crect fill=%27%23333%27 width=%2740%27 height=%2740%27/%3E%3Ctext x=%2750%25%27 y=%2750%25%27 dy=%27.35em%27 fill=%27%23fff%27 font-family=%27sans-serif%27 font-size=%2720%27 text-anchor=%27middle%27%3E${encodeURIComponent(initial)}%3C/text%3E%3C/svg%3E`;
  },

  openAddFriendModal() {
    this.searchedFriend = null;
    const input = document.getElementById('friend-name-input');
    const result = document.getElementById('friend-search-result');
    if (input) input.value = '';
    if (result) result.innerHTML = '';
    const modal = document.getElementById('add-friend-modal');
    if (modal) modal.classList.add('open');
  },

  async searchFriend(name) {
    const result = document.getElementById('friend-search-result');
    if (!name.trim()) {
      result.innerHTML = '';
      return;
    }

    try {
      const response = await Auth.apiRequest(`/api/friends/search?name=${encodeURIComponent(name)}`);
      if (response.ok) {
        const data = await response.json();
        const user = data.user;
        if (user) {
          this.searchedFriend = user;
          result.innerHTML = `
            <div class="search-result-user">
              <img src="${user.picture || ''}" alt="" class="friend-avatar" onerror="this.style.display='none'">
              <span>${this.escapeHtml(user.name)}</span>
            </div>
          `;
        } else {
          this.searchedFriend = null;
          result.innerHTML = '<p class="no-result">No user found</p>';
        }
      }
    } catch (error) {
      console.error('Error searching friend:', error);
      result.innerHTML = '<p class="no-result">Search failed</p>';
    }
  },

  async confirmAddFriend() {
    if (!this.searchedFriend) return;

    try {
      const response = await Auth.apiRequest('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ user_id: this.searchedFriend.id })
      });
      if (response.ok) {
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

  async viewFriendProfile(userId) {
    try {
      const response = await Auth.apiRequest(`/api/friends/${userId}/profile`);
      if (response.ok) {
        const profile = await response.json();
        this.viewedProfile = profile;
        this.viewedProfileCollection = null;
        this.renderViewProfile(profile);
        const modal = document.getElementById('view-profile-modal');
        if (modal) modal.classList.add('open');
      }
    } catch (error) {
      console.error('Error loading friend profile:', error);
    }
  },

  async unfollowFromProfile() {
    if (!this.viewedProfile) return;

    if (!confirm('Remove this friend?')) return;

    try {
      const response = await Auth.apiRequest(`/api/friends/${this.viewedProfile.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        this.closeModal('view-profile-modal');
        await this.loadFriends();
      }
    } catch (error) {
      console.error('Error unfollowing:', error);
    }
  }
};

if (typeof window !== 'undefined') window.FriendsModule = FriendsModule;
