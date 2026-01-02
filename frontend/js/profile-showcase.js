/**
 * Profile Showcase Module
 * Handles showcase management, notes, and rendering
 */

const ProfileShowcase = {
  /**
   * Load showcase (filtered by current category if set)
   */
  async loadShowcase() {
    try {
      const categoryId = Profile.getCurrentCategoryId();
      const url = categoryId
        ? `/api/profile/me/showcase?category_id=${categoryId}`
        : '/api/profile/me/showcase';

      const response = await Auth.apiRequest(url);
      if (response.ok) {
        Profile.showcase = await response.json();
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
    const terms = Profile.getTerms();

    if (Profile.showcase.length === 0) {
      grid.innerHTML = `
        <div class="showcase-empty" id="showcase-empty">
          <div class="empty-icon">${terms.emptyIcon}</div>
          <p>${terms.showcaseEmpty}</p>
          <span>${terms.showcaseHint}</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = Profile.showcase.map(album => `
      <div class="album-card showcase-item" data-id="${album.id}">
        <img src="${album.cover || Profile.getPlaceholderCover(album)}"
             alt="${album.album}" loading="lazy"
             onerror="this.src='${Profile.getPlaceholderCover(album)}'">
        ${Profile.renderItemTags(album.tags)}
        ${album.notes ? `<div class="showcase-note">${Profile.escapeHtml(album.notes)}</div>` : ''}
        <div class="album-info">
          <p class="album-title">${Profile.escapeHtml(album.album)}</p>
          <p class="album-artist">${Profile.escapeHtml(album.artist)}</p>
        </div>
        <button class="note-btn" onclick="event.stopPropagation(); Profile.showShowcaseNoteModal(${album.id})" title="Add note">📝</button>
        <button class="remove-btn" onclick="Profile.removeFromShowcase(${album.id})" title="Remove from showcase">&times;</button>
      </div>
    `).join('');
  },

  /**
   * Add to showcase
   */
  async addToShowcase(collectionId) {
    const terms = Profile.getTerms();

    if (Profile.showcase.find(s => s.collection_id === collectionId)) {
      Auth.showWarning(`This ${terms.itemSingular} is already in your showcase`);
      return;
    }

    if (Profile.showcase.length >= 8) {
      Auth.showWarning(`Showcase limit reached (max 8 ${terms.itemPlural}). Remove one to add another.`);
      return;
    }

    try {
      const response = await Auth.apiRequest('/api/profile/me/showcase', {
        method: 'POST',
        body: JSON.stringify({ collection_id: collectionId })
      });

      if (response.ok) {
        const newShowcase = await response.json();
        Profile.showcase.push(newShowcase);
        this.renderShowcase();
        Profile.closeModal('showcase-modal');
        ProfileUI.updateCollectorScoreInstantly(1, 0);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to add to showcase');
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
        Profile.showcase = Profile.showcase.filter(s => s.id !== showcaseId);
        this.renderShowcase();
        ProfileUI.updateCollectorScoreInstantly(-1, 0);
      }
    } catch (error) {
      console.error('Error removing from showcase:', error);
    }
  },

  /**
   * Open showcase modal
   */
  openShowcaseModal() {
    const grid = document.getElementById('showcase-select-grid');
    const showcaseIds = new Set(Profile.showcase.map(s => s.collection_id));

    const available = Profile.collection.filter(a => !showcaseIds.has(a.id));

    if (available.length === 0) {
      if (Profile.collection.length === 0) {
        ProfileModals.openAddRecordModal();
        return;
      }
      Auth.showInfo('All your albums are already in your showcase!');
      return;
    }

    grid.innerHTML = available.map(album => `
      <div class="showcase-select-item" onclick="Profile.addToShowcase(${album.id})">
        <img src="${album.cover || Profile.getPlaceholderCover(album)}"
             alt="${album.album}"
             onerror="this.src='${Profile.getPlaceholderCover(album)}'">
        <div class="album-overlay">
          <span>${Profile.escapeHtml(album.album)}</span>
        </div>
      </div>
    `).join('');

    document.getElementById('showcase-modal').classList.add('open');
  },

  /**
   * Show modal to edit showcase note
   */
  showShowcaseNoteModal(showcaseId) {
    const album = Profile.showcase.find(a => a.id === showcaseId);
    if (!album) return;

    const html = `
      <div class="note-modal-content">
        <h3>Add Note</h3>
        <p class="note-album-name">${Profile.escapeHtml(album.album)} - ${Profile.escapeHtml(album.artist)}</p>
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
      const response = await Auth.apiRequest(`/api/profile/me/showcase/${showcaseId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: notes || null })
      });

      if (response.ok) {
        const album = Profile.showcase.find(a => a.id === showcaseId);
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
        const album = Profile.showcase.find(a => a.id === showcaseId);
        if (album) album.notes = null;
        this.renderShowcase();
        this.closeShowcaseNoteModal();
      } else {
        const errorText = await response.text();
        console.error('Failed to clear note:', errorText);
        Auth.showError('Failed to clear note');
      }
    } catch (error) {
      console.error('Error clearing showcase note:', error);
    }
  }
};

// Export for use
if (typeof window !== 'undefined') window.ProfileShowcase = ProfileShowcase;
