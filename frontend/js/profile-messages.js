/**
 * Profile Messages Module
 * Handles direct messaging between friends
 */

const ProfileMessages = {
  // Configuration
  POLLING_INTERVAL_MS: 5000,

  /**
   * Flag to prevent overlapping polling requests
   */
  isPolling: false,

  /**
   * Load unread message count
   */
  async loadUnreadCount() {
    try {
      const response = await Auth.apiRequest('/api/messages/unread-count');
      if (response.ok) {
        const data = await response.json();
        Profile.unreadCount = data.count;
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
      if (Profile.unreadCount > 0) {
        badge.textContent = Profile.unreadCount > 99 ? '99+' : Profile.unreadCount;
      } else {
        badge.textContent = '';
      }
    }
  },

  /**
   * Start polling for updates (messages, friend requests, friends)
   * Uses guard flag to prevent overlapping requests if API calls take longer than 5 seconds
   */
  startPolling() {
    if (Profile.pollingInterval) {
      clearInterval(Profile.pollingInterval);
      Profile.pollingInterval = null;
    }

    const pollCallback = async () => {
      // Guard against overlapping requests
      if (ProfileMessages.isPolling) return;
      ProfileMessages.isPolling = true;

      try {
        const oldRequestCount = Profile.pendingRequestCount;
        await ProfileFriends.loadFriendRequests();

        const oldFriendsCount = Profile.friends.length;
        await ProfileFriends.loadFriends();

        if (Profile.friends.length > oldFriendsCount) {
          ProfileFriends.renderFriends();
        }

        await ProfileMessages.loadUnreadCount();

        if (Profile.currentConversation) {
          await ProfileMessages.loadConversationMessages(Profile.currentConversation.id);
        }
      } catch (error) {
        console.error('[ProfileMessages] Polling error:', error);
      } finally {
        ProfileMessages.isPolling = false;
      }
    };

    Profile.pollingInterval = setInterval(pollCallback, ProfileMessages.POLLING_INTERVAL_MS);
  },

  /**
   * Open messages sidebar
   */
  async openMessagesSidebar() {
    document.getElementById('messages-sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');

    this.renderFriendsMessageList();
    this.showFriendsList();
  },

  /**
   * Close messages sidebar
   */
  closeMessagesSidebar() {
    document.getElementById('messages-sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
    Profile.currentConversation = null;
  },

  /**
   * Render friends list in messages sidebar
   */
  renderFriendsMessageList() {
    const listEl = document.getElementById('friends-message-list');

    if (Profile.friends.length === 0) {
      listEl.innerHTML = `
        <div class="friends-list-empty">
          <div class="empty-icon">👥</div>
          <p>No friends yet</p>
          <span>Add friends to start messaging!</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = Profile.friends.map(friend => `
      <div class="friend-message-item"
           data-friend-id="${friend.id}"
           data-friend-name="${Profile.escapeHtml(friend.name || '')}"
           data-friend-picture="${Profile.escapeHtml(friend.picture || '')}">
        <img src="${friend.picture || Profile.getDefaultAvatar(friend.name)}"
             alt="${friend.name}"
             class="avatar"
             onerror="this.src='${Profile.getDefaultAvatar(friend.name)}'">
        <div class="friend-message-info">
          <div class="friend-message-name">${Profile.escapeHtml(friend.name || 'Anonymous')}</div>
          ${friend.pronouns ? `<div class="friend-message-pronouns">${Profile.escapeHtml(friend.pronouns)}</div>` : ''}
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.friend-message-item').forEach(item => {
      item.addEventListener('click', () => {
        const friendId = parseInt(item.dataset.friendId);
        const friendName = item.dataset.friendName;
        const friendPicture = item.dataset.friendPicture;
        ProfileMessages.openConversation(friendId, friendName, friendPicture);
      });
    });
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
    Profile.currentConversation = { id: userId, name: userName, picture: userPicture };

    document.getElementById('conversation-avatar').src = userPicture || Profile.getDefaultAvatar(userName);
    document.getElementById('conversation-with').textContent = userName || 'Anonymous';

    document.getElementById('friends-list-view').style.display = 'none';
    document.getElementById('conversation-view').style.display = 'flex';

    document.getElementById('messages-sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');

    await this.loadConversationMessages(userId);
  },

  /**
   * Load messages for a conversation
   */
  async loadConversationMessages(userId) {
    try {
      const response = await Auth.apiRequest(`/api/messages/conversation/${userId}`);
      if (response.ok) {
        Profile.currentConversationMessages = await response.json();
        this.renderMessages();
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

    if (Profile.currentConversationMessages.length === 0) {
      listEl.innerHTML = '<div class="messages-empty" style="text-align:center;color:#666;padding:40px;">No messages yet. Say hi!</div>';
      return;
    }

    listEl.innerHTML = Profile.currentConversationMessages.map(msg => `
      <div class="message-bubble ${msg.is_mine ? 'mine' : 'theirs'}">
        ${Profile.escapeHtml(msg.content)}
        <div class="message-time">${Profile.formatTime(msg.created_at)}</div>
      </div>
    `).join('');

    listEl.scrollTop = listEl.scrollHeight;
  },

  /**
   * Go back to friends list
   */
  backToConversations() {
    Profile.currentConversation = null;
    this.renderFriendsMessageList();
    this.showFriendsList();
  },

  /**
   * Send a message
   */
  async sendMessage() {
    if (!Profile.currentConversation) return;

    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = '';

    try {
      const response = await Auth.apiRequest('/api/messages/', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: Profile.currentConversation.id,
          content
        })
      });

      if (response.ok) {
        const newMessage = await response.json();
        Profile.currentConversationMessages.push(newMessage);
        this.renderMessages();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to send message');
        input.value = content;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Auth.showError('Failed to send message');
      input.value = content;
    }
  }
};

// Export for use
if (typeof window !== 'undefined') window.ProfileMessages = ProfileMessages;
