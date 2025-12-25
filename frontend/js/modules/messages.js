/**
 * Messaging Module for Profile
 * Handles direct messaging between friends
 */

const MessagesModule = {
  async loadUnreadCount() {
    try {
      const response = await Auth.apiRequest('/api/messages/unread');
      if (response.ok) {
        const data = await response.json();
        this.unreadCount = data.count || 0;
        this.updateUnreadBadge();
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  },

  updateUnreadBadge() {
    const badge = document.getElementById('unread-badge');
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        badge.classList.add('show');
      } else {
        badge.classList.remove('show');
      }
    }
  },

  startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(async () => {
      await this.loadUnreadCount();
      const oldFriendsCount = this.friends.length;
      await this.loadFriends();
      await this.loadFriendRequests();

      if (this.friends.length > oldFriendsCount) {
        this.renderFriends();
      }

      if (this.currentConversation) {
        await this.loadConversationMessages(this.currentConversation.userId);
      }
    }, 30000);
  },

  async openMessagesSidebar() {
    const sidebar = document.getElementById('messages-sidebar');
    if (sidebar) {
      sidebar.classList.add('open');
      await this.loadUnreadCount();
      this.showFriendsList();
    }
  },

  closeMessagesSidebar() {
    const sidebar = document.getElementById('messages-sidebar');
    if (sidebar) sidebar.classList.remove('open');
    this.currentConversation = null;
    this.currentConversationMessages = [];
  },

  renderFriendsMessageList() {
    const list = document.getElementById('friends-message-list');
    if (this.friends.length === 0) {
      list.innerHTML = `
        <div class="no-friends-message">
          <p>Add friends to start messaging!</p>
        </div>
      `;
      return;
    }

    list.innerHTML = this.friends.map(friend => `
      <div class="friend-message-item"
           data-friend-id="${friend.id}"
           data-friend-name="${this.escapeHtml(friend.name || 'User')}"
           data-friend-picture="${this.escapeHtml(friend.picture || '')}">
        <img src="${friend.picture || ''}" alt="" class="friend-avatar" onerror="this.src='${this.getDefaultAvatar(friend.name)}'">
        <div class="friend-info">
          <span class="friend-name">${this.escapeHtml(friend.name || 'User')}</span>
        </div>
      </div>
    `).join('');

    // Add click handlers
    list.querySelectorAll('.friend-message-item').forEach(item => {
      item.addEventListener('click', () => {
        const friendId = parseInt(item.dataset.friendId);
        const friendName = item.dataset.friendName;
        const friendPicture = item.dataset.friendPicture;
        Profile.openConversation(friendId, friendName, friendPicture);
      });
    });
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    let ts = timestamp;
    if (ts && !ts.endsWith('Z') && !ts.includes('+') && !ts.includes('-', 10)) {
      ts += 'Z';
    }
    const date = new Date(ts);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  },

  showFriendsList() {
    const friendsList = document.getElementById('friends-list-view');
    const conversationView = document.getElementById('conversation-view');
    if (friendsList) friendsList.style.display = 'block';
    if (conversationView) conversationView.style.display = 'none';
    this.renderFriendsMessageList();
  },

  async openConversation(userId, userName, userPicture) {
    this.currentConversation = { userId, userName, userPicture };

    const friendsList = document.getElementById('friends-list-view');
    const conversationView = document.getElementById('conversation-view');
    const conversationName = document.getElementById('conversation-name');

    if (friendsList) friendsList.style.display = 'none';
    if (conversationView) conversationView.style.display = 'flex';
    if (conversationName) conversationName.textContent = userName;

    await this.loadConversationMessages(userId);
  },

  async loadConversationMessages(userId) {
    try {
      const response = await Auth.apiRequest(`/api/messages/conversation/${userId}`);
      if (response.ok) {
        const data = await response.json();
        this.currentConversationMessages = data.messages || [];
        this.renderMessages();
        await this.loadUnreadCount();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  },

  renderMessages() {
    const container = document.getElementById('messages-container');
    if (this.currentConversationMessages.length === 0) {
      container.innerHTML = '<div class="no-messages">No messages yet. Say hello!</div>';
      return;
    }

    container.innerHTML = this.currentConversationMessages.map(msg => `
      <div class="message ${msg.sender_id === this.profile?.id ? 'sent' : 'received'}">
        <div class="message-content">${this.escapeHtml(msg.content)}</div>
        <div class="message-time">${this.formatTime(msg.created_at)}</div>
      </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
  },

  backToConversations() {
    this.currentConversation = null;
    this.currentConversationMessages = [];
    this.showFriendsList();
  },

  async sendMessage() {
    if (!this.currentConversation) return;
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = '';

    try {
      const response = await Auth.apiRequest('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: this.currentConversation.userId,
          content
        })
      });

      if (response.ok) {
        await this.loadConversationMessages(this.currentConversation.userId);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Auth.showError('Failed to send message');
    }
  }
};

if (typeof window !== 'undefined') window.MessagesModule = MessagesModule;
