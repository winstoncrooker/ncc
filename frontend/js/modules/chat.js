/**
 * AI Chat Module for Profile
 * Handles chat functionality, file uploads, and AI-driven collection actions
 */

const ChatModule = {
  /**
   * Send chat message to AI
   */
  async sendChatMessage() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.querySelector('#ai-input-form button[type="submit"]');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    this.addChatMessage(message, 'user');
    this.showTypingIndicator();
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

      this.hideTypingIndicator();

      if (response.ok) {
        const data = await response.json();
        const cleanResponse = typeof DOMPurify !== 'undefined'
          ? DOMPurify.sanitize(data.response)
          : data.response;
        this.addChatMessage(cleanResponse, 'assistant');
        this.chatHistory.push({ role: 'assistant', content: data.response });

        const actions = [];

        if (data.albums_to_add?.length > 0) {
          for (const album of data.albums_to_add) {
            const success = await this.addAlbumFromChat(album);
            if (success) actions.push(`Added: ${album.artist} - ${album.album}`);
          }
        }

        if (data.albums_to_remove?.length > 0) {
          for (const album of data.albums_to_remove) {
            const success = await this.removeAlbumFromChat(album);
            if (success) actions.push(`Removed: ${album.artist} - ${album.album}`);
          }
        }

        if (data.albums_to_showcase?.length > 0) {
          for (const album of data.albums_to_showcase) {
            const success = await this.showcaseAlbumFromChat(album);
            if (success) actions.push(`Showcased: ${album.artist} - ${album.album}`);
          }
        }

        if (actions.length > 0) this.showActionFeedback(actions);
      } else {
        const errorData = await response.json().catch(() => ({}));
        this.addChatMessage(errorData.detail || 'Sorry, I had trouble processing that. Please try again.', 'assistant');
      }
    } catch (error) {
      console.error('Chat error:', error);
      this.hideTypingIndicator();
      this.addChatMessage('Sorry, something went wrong. Please try again.', 'assistant');
    } finally {
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  },

  showTypingIndicator() {
    const container = document.getElementById('ai-chat-container');
    if (container.querySelector('.typing-indicator')) return;
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  },

  hideTypingIndicator() {
    const container = document.getElementById('ai-chat-container');
    const indicator = container.querySelector('.typing-indicator');
    if (indicator) indicator.remove();
  },

  showActionFeedback(actions) {
    let toast = document.getElementById('action-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'action-toast';
      toast.className = 'action-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = actions.map(a => `<div class="action-item">${this.escapeHtml(a)}</div>`).join('');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  },

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

  async handleAlbumFileUpload(file) {
    if (!file.name.endsWith('.txt')) {
      this.addChatMessage('Please upload a .txt file with albums in "Artist - Album" format, one per line.', 'assistant');
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

      if (lines.length === 0) {
        this.addChatMessage('The file appears to be empty.', 'assistant');
        return;
      }

      const albums = [];
      const invalidLines = [];

      for (const line of lines) {
        if (line.startsWith('#') || line.startsWith('//')) continue;
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
        if (!parsed) invalidLines.push(line);
      }

      if (albums.length === 0) {
        this.addChatMessage('No valid albums found. Use "Artist - Album" format.', 'assistant');
        return;
      }

      this.addChatMessage(`Uploading ${albums.length} album(s)...`, 'user');
      let added = 0, skipped = 0;

      for (let i = 0; i < albums.length; i++) {
        const album = albums[i];
        this.updateLastChatMessage(`Adding ${i + 1}/${albums.length}: ${album.artist} - ${album.album}`);

        const exists = this.collection.some(a =>
          a.artist.toLowerCase() === album.artist.toLowerCase() &&
          a.album.toLowerCase() === album.album.toLowerCase()
        );

        if (exists) { skipped++; continue; }

        let cover = null, year = null, discogs_id = null;
        try {
          const discogsResponse = await Auth.apiRequest(
            `/api/discogs/search?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.album)}`
          );
          if (discogsResponse.ok) {
            const data = await discogsResponse.json();
            cover = data.cover; year = data.year; discogs_id = data.id;
          }
        } catch (err) { /* continue without cover */ }

        try {
          const response = await Auth.apiRequest('/api/collection/', {
            method: 'POST',
            body: JSON.stringify({
              artist: album.artist, album: album.album, cover, year, discogs_id,
              category_id: this.getCurrentCategoryId()
            })
          });
          if (response.ok) {
            this.collection.push(await response.json());
            added++;
          }
        } catch (err) { console.error('Failed to add:', album); }

        if (i < albums.length - 1) await new Promise(r => setTimeout(r, 1200));
      }

      this.collection.sort((a, b) =>
        `${a.artist} ${a.album}`.toLowerCase().localeCompare(`${b.artist} ${b.album}`.toLowerCase())
      );
      this.renderCollection();

      let msg = `Added ${added} album(s).`;
      if (skipped) msg += ` ${skipped} already existed.`;
      if (invalidLines.length) msg += ` ${invalidLines.length} couldn't be parsed.`;
      this.addChatMessage(msg, 'assistant');
    } catch (error) {
      this.addChatMessage('Error reading file.', 'assistant');
    }
  },

  updateLastChatMessage(content) {
    const messages = document.querySelectorAll('#ai-chat-container .ai-message.user');
    if (messages.length > 0) messages[messages.length - 1].textContent = content;
  },

  async addAlbumFromChat(album) {
    const exists = this.collection.some(a =>
      a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
      a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
    );
    if (exists) return false;

    try {
      const response = await Auth.apiRequest('/api/collection/', {
        method: 'POST',
        body: JSON.stringify({
          artist: album.artist, album: album.album,
          cover: album.cover, year: album.year, discogs_id: album.discogs_id,
          category_id: this.getCurrentCategoryId()
        })
      });
      if (response.ok) {
        this.addAlbumSorted(await response.json());
        return true;
      }
    } catch (error) { console.error('addAlbumFromChat error:', error); }
    return false;
  },

  async removeAlbumFromChat(album) {
    let found = this.collection.find(a =>
      a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
      a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
    );

    if (!found) {
      found = this.collection.find(a =>
        a.artist.toLowerCase().includes(album.artist.toLowerCase()) ||
        a.album.toLowerCase().includes(album.album.toLowerCase())
      );
    }

    if (!found) return false;

    try {
      const response = await Auth.apiRequest(`/api/collection/${found.id}`, { method: 'DELETE' });
      if (response.ok) {
        this.collection = this.collection.filter(a => a.id !== found.id);
        this.showcase = this.showcase.filter(s => s.collection_id !== found.id);
        this.renderCollection();
        this.renderShowcase();
        return true;
      }
    } catch (error) { console.error('removeAlbumFromChat error:', error); }
    return false;
  },

  async showcaseAlbumFromChat(album) {
    let found = this.collection.find(a =>
      a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
      a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
    );

    if (!found) {
      found = this.collection.find(a =>
        a.artist.toLowerCase().includes(album.artist.toLowerCase()) &&
        a.album.toLowerCase().includes(album.album.toLowerCase())
      );
    }

    if (!found) return false;
    if (this.showcase.find(s => s.collection_id === found.id)) return false;
    if (this.showcase.length >= 8) return false;

    try {
      const response = await Auth.apiRequest('/api/profile/me/showcase', {
        method: 'POST',
        body: JSON.stringify({ collection_id: found.id })
      });
      if (response.ok) {
        this.showcase.push(await response.json());
        this.renderShowcase();
        return true;
      }
    } catch (error) { console.error('showcaseAlbumFromChat error:', error); }
    return false;
  }
};

// Export for use
if (typeof window !== 'undefined') window.ChatModule = ChatModule;
