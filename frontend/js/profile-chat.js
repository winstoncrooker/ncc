/**
 * Profile Chat Module
 * Handles AI assistant sidebar and chat functionality
 */

const ProfileChat = {
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

    Profile.chatHistory.push({ role: 'user', content: message });

    try {
      const response = await Auth.apiRequest('/api/chat/', {
        method: 'POST',
        body: JSON.stringify({
          message,
          collection: Profile.collection.map(a => ({ artist: a.artist, album: a.album })),
          history: Profile.chatHistory.slice(-10),
          category_slug: Profile.currentCategorySlug || 'vinyl'
        })
      });

      this.hideTypingIndicator();

      if (response.ok) {
        const data = await response.json();

        const cleanResponse = typeof DOMPurify !== 'undefined'
          ? DOMPurify.sanitize(data.response)
          : data.response;
        this.addChatMessage(cleanResponse, 'assistant');

        Profile.chatHistory.push({ role: 'assistant', content: data.response });

        const actions = [];

        if (data.albums_to_add?.length > 0) {
          console.log('[Chat] Albums to add:', data.albums_to_add);
          for (const album of data.albums_to_add) {
            const success = await this.addAlbumFromChat(album);
            if (success) {
              actions.push(`Added: ${album.artist} - ${album.album}`);
            }
          }
        }

        if (data.albums_to_remove?.length > 0) {
          console.log('[Chat] Albums to remove:', data.albums_to_remove);
          for (const album of data.albums_to_remove) {
            const success = await this.removeAlbumFromChat(album);
            if (success) {
              actions.push(`Removed: ${album.artist} - ${album.album}`);
            }
          }
        }

        if (data.albums_to_showcase?.length > 0) {
          console.log('[Chat] Albums to showcase:', data.albums_to_showcase);
          for (const album of data.albums_to_showcase) {
            const success = await this.showcaseAlbumFromChat(album);
            if (success) {
              actions.push(`Showcased: ${album.artist} - ${album.album}`);
            }
          }
        }

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
    let toast = document.getElementById('action-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'action-toast';
      toast.className = 'action-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = actions.map(a => `<div class="action-item">${Profile.escapeHtml(a)}</div>`).join('');
    toast.classList.add('show');

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

        if (!parsed) {
          invalidLines.push(line);
        }
      }

      if (albums.length === 0) {
        this.addChatMessage('No valid albums found. Please use "Artist - Album" format, one per line.', 'assistant');
        return;
      }

      this.addChatMessage(`Uploading ${albums.length} album(s) from file...`, 'user');

      let added = 0;
      let skipped = 0;
      let failed = 0;
      const failedAlbums = [];

      for (let i = 0; i < albums.length; i++) {
        const album = albums[i];

        this.updateLastChatMessage(`Adding albums... ${i + 1}/${albums.length} (${album.artist} - ${album.album})`);

        const exists = Profile.collection.some(a =>
          a.artist.toLowerCase() === album.artist.toLowerCase() &&
          a.album.toLowerCase() === album.album.toLowerCase()
        );

        if (exists) {
          skipped++;
          continue;
        }

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
            if (cover && cover.startsWith('/api/')) {
              cover = CONFIG.API_BASE + cover;
            }
            year = discogsData.year || null;
            discogs_id = discogsData.id || null;
          }
        } catch (err) {
          console.log(`Discogs lookup failed for: ${album.artist} - ${album.album}`);
        }

        try {
          const categoryId = Profile.getCurrentCategoryId();
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
            Profile.collection.push(newAlbum);
            added++;
          } else {
            failed++;
            failedAlbums.push(`${album.artist} - ${album.album}`);
            console.error(`Failed to add (${response.status}): ${album.artist} - ${album.album}`);
          }
        } catch (err) {
          failed++;
          failedAlbums.push(`${album.artist} - ${album.album}`);
          console.error(`Failed to add: ${album.artist} - ${album.album}`, err);
        }

        if (i < albums.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      Profile.collection.sort((a, b) => {
        const aKey = `${a.artist.toLowerCase()} ${a.album.toLowerCase()}`;
        const bKey = `${b.artist.toLowerCase()} ${b.album.toLowerCase()}`;
        return aKey.localeCompare(bKey);
      });
      ProfileCollection.renderCollection();

      let message = `Added ${added} album(s) to your collection.`;
      if (skipped > 0) message += ` ${skipped} already in collection.`;
      if (failed > 0) message += ` ${failed} failed to add.`;
      if (invalidLines.length > 0) message += ` ${invalidLines.length} line(s) couldn't be parsed.`;

      this.addChatMessage(message, 'assistant');

      if (failedAlbums.length > 0 && failedAlbums.length <= 5) {
        this.addChatMessage(`Failed albums: ${failedAlbums.join(', ')}`, 'assistant');
      } else if (failedAlbums.length > 5) {
        this.addChatMessage(`Failed albums (showing first 5): ${failedAlbums.slice(0, 5).join(', ')}...`, 'assistant');
      }

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
   * Add album from chat
   */
  async addAlbumFromChat(album) {
    try {
      const exists = Profile.collection.some(a =>
        a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
        a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
      );

      if (exists) {
        console.log('[Chat] Album already in collection:', album.artist, '-', album.album);
        return false;
      }

      const categoryId = Profile.getCurrentCategoryId();
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
        ProfileCollection.addAlbumSorted(newAlbum);
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
   */
  async removeAlbumFromChat(album) {
    const found = Profile.collection.find(a =>
      a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
      a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
    );

    if (!found) {
      const partialMatch = Profile.collection.find(a =>
        a.artist.toLowerCase().includes(album.artist.toLowerCase()) ||
        a.album.toLowerCase().includes(album.album.toLowerCase())
      );

      if (partialMatch) {
        console.log('[Chat] Partial match found, removing:', partialMatch.artist, '-', partialMatch.album);
        await ProfileCollection.removeFromCollection(partialMatch.id);
        return true;
      }

      console.log('[Chat] Album not found in collection:', album.artist, '-', album.album);
      return false;
    }

    try {
      await ProfileCollection.removeFromCollection(found.id);
      console.log('[Chat] Removed album:', album.artist, '-', album.album);
      return true;
    } catch (error) {
      console.error('Error removing album from chat:', error);
      return false;
    }
  },

  /**
   * Showcase album from chat
   */
  async showcaseAlbumFromChat(album) {
    let found = Profile.collection.find(a =>
      a.artist.toLowerCase().trim() === album.artist.toLowerCase().trim() &&
      a.album.toLowerCase().trim() === album.album.toLowerCase().trim()
    );

    if (!found) {
      found = Profile.collection.find(a =>
        a.album.toLowerCase().includes(album.album.toLowerCase()) ||
        (a.artist.toLowerCase().includes(album.artist.toLowerCase()) &&
         a.album.toLowerCase().includes(album.album.toLowerCase().split(' ')[0]))
      );
    }

    if (!found) {
      console.log('[Chat] Album not in collection, cannot showcase:', album.artist, '-', album.album);
      return false;
    }

    if (Profile.showcase.find(s => s.collection_id === found.id)) {
      console.log('[Chat] Album already in showcase:', album.album);
      return false;
    }

    if (Profile.showcase.length >= 8) {
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
        Profile.showcase.push(newShowcase);
        ProfileShowcase.renderShowcase();
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
  }
};

// Export for use
if (typeof window !== 'undefined') window.ProfileChat = ProfileChat;
