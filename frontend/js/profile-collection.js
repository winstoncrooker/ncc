/**
 * Profile Collection Module
 * Handles collection CRUD operations, filtering, display, and cover management
 */

const ProfileCollection = {
  /**
   * Load user collection (filtered by current category if set)
   */
  async loadCollection() {
    try {
      const categoryId = Profile.getCurrentCategoryId();
      const url = categoryId
        ? `/api/collection/?category_id=${categoryId}`
        : '/api/collection/';

      const response = await Auth.apiRequest(url);
      if (response.ok) {
        Profile.collection = await response.json();
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
    const terms = Profile.getTerms();

    if (countEl) countEl.textContent = Profile.collection.length;
    if (!grid) return;

    if (Profile.collection.length === 0) {
      grid.innerHTML = `
        <div class="collection-empty" id="collection-empty">
          <div class="empty-icon">${terms.emptyIcon}</div>
          <p>${terms.collectionEmpty}</p>
          <span>${terms.collectionHint}</span>
        </div>
      `;
      return;
    }

    const isVinyl = Profile.currentCategorySlug === 'vinyl';
    grid.innerHTML = Profile.collection.map(album => `
      <div class="album-card" data-id="${album.id}">
        <img src="${album.cover || Profile.getPlaceholderCover(album)}"
             alt="${album.album}" loading="lazy"
             onerror="this.src='${Profile.getPlaceholderCover(album)}'">
        ${Profile.renderItemTags(album.tags)}
        <div class="album-info">
          <p class="album-title">${Profile.escapeHtml(album.album)}</p>
          <p class="album-artist">${Profile.escapeHtml(album.artist)}</p>
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
        if (!e.target.closest('.remove-btn') && !e.target.closest('.refresh-btn') && !e.target.closest('.image-btn') && !e.target.closest('.tag-btn')) {
          const id = parseInt(card.dataset.id);
          ProfileShowcase.addToShowcase(id);
        }
      });
    });
  },

  /**
   * Add album to collection in alphabetical order and re-render
   */
  addAlbumSorted(album) {
    const key = `${album.artist.toLowerCase()} ${album.album.toLowerCase()}`;
    let insertIndex = Profile.collection.findIndex(a => {
      const aKey = `${a.artist.toLowerCase()} ${a.album.toLowerCase()}`;
      return aKey > key;
    });

    if (insertIndex === -1) {
      Profile.collection.push(album);
    } else {
      Profile.collection.splice(insertIndex, 0, album);
    }

    this.renderCollection();
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
        const wasInShowcase = Profile.showcase.some(s => s.collection_id === albumId);
        Profile.collection = Profile.collection.filter(a => a.id !== albumId);
        Profile.showcase = Profile.showcase.filter(s => s.collection_id !== albumId);
        this.renderCollection();
        ProfileShowcase.renderShowcase();
        ProfileUI.updateCollectorScoreInstantly(wasInShowcase ? -1 : 0, -1);
      }
    } catch (error) {
      console.error('Error removing album:', error);
    }
  },

  /**
   * Fill in missing album covers in background (rate limited)
   */
  async fillMissingCovers() {
    const missingCovers = Profile.collection.filter(a => !a.cover);

    if (missingCovers.length === 0) return;

    const total = missingCovers.length;
    const delayMs = 1200;
    let completed = 0;
    let successCount = 0;

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

      if (progressEl) {
        progressText.textContent = `Fetching: ${album.artist} - ${album.album}`;
        progressCount.textContent = `${completed} / ${total}`;
        const remainingSeconds = (total - completed) * (delayMs / 1000);
        progressEta.textContent = formatEta(remainingSeconds);
        progressFill.style.width = `${(completed / total) * 100}%`;
      }

      try {
        const discogsResponse = await Auth.apiRequest(
          `/api/discogs/search?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.album)}`
        );

        if (discogsResponse.ok) {
          const data = await discogsResponse.json();

          if (data.cover) {
            let coverUrl = data.cover;
            if (coverUrl.startsWith('/api/')) {
              coverUrl = CONFIG.API_BASE + coverUrl;
            }

            album.cover = coverUrl;
            if (data.year && !album.year) album.year = data.year;
            if (data.id && !album.discogs_id) album.discogs_id = data.id;

            await Auth.apiRequest(`/api/collection/${album.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                cover: coverUrl,
                year: data.year || album.year,
                discogs_id: data.id || album.discogs_id
              })
            });

            this.renderCollection();
            successCount++;
            console.log(`[Covers] Updated: ${album.artist} - ${album.album}`);
          }
        }
      } catch (err) {
        console.log(`[Covers] Failed: ${album.artist} - ${album.album}`, err);
      }

      completed++;

      if (i < missingCovers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (progressEl) {
      progressText.textContent = `Done! Updated ${successCount} of ${total} covers`;
      progressCount.textContent = `${total} / ${total}`;
      progressEta.textContent = '';
      progressFill.style.width = '100%';

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
    const album = Profile.collection.find(a => a.id === albumId);
    if (!album) return;

    const btn = document.querySelector(`.album-card[data-id="${albumId}"] .refresh-btn`);
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
    }

    try {
      const discogsResponse = await Auth.apiRequest(
        `/api/discogs/search?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.album)}&refresh=true`
      );

      if (discogsResponse.ok) {
        const data = await discogsResponse.json();

        if (data.cover) {
          let coverUrl = data.cover;
          if (coverUrl.startsWith('/api/')) {
            coverUrl = CONFIG.API_BASE + coverUrl;
          }

          album.cover = coverUrl;
          if (data.year && !album.year) album.year = data.year;
          if (data.id && !album.discogs_id) album.discogs_id = data.id;

          await Auth.apiRequest(`/api/collection/${album.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              cover: coverUrl,
              year: data.year || album.year,
              discogs_id: data.id || album.discogs_id
            })
          });

          this.renderCollection();
          console.log(`[Cover] Refreshed: ${album.artist} - ${album.album}`);
        } else {
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
   * Populate filter dropdown options based on collection data
   */
  populateFilterOptions() {
    const genres = new Set();
    const years = new Set();

    Profile.collection.forEach(item => {
      if (item.genre) genres.add(item.genre);
      if (item.year) years.add(item.year);
    });

    const genreSelect = document.getElementById('filter-genre');
    if (genreSelect) {
      const sortedGenres = [...genres].sort();
      genreSelect.innerHTML = '<option value="">All Genres</option>' +
        sortedGenres.map(g => `<option value="${Profile.escapeHtml(g)}">${Profile.escapeHtml(g)}</option>`).join('');
    }

    const yearSelect = document.getElementById('filter-year');
    if (yearSelect) {
      const sortedYears = [...years].sort((a, b) => b - a);
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

    let filtered = Profile.collection.filter(item => {
      if (searchQuery) {
        const matchesSearch =
          item.artist.toLowerCase().includes(searchQuery) ||
          item.album.toLowerCase().includes(searchQuery) ||
          (item.genre && item.genre.toLowerCase().includes(searchQuery));
        if (!matchesSearch) return false;
      }

      if (genreFilter && item.genre !== genreFilter) return false;
      if (yearFilter && String(item.year) !== yearFilter) return false;

      return true;
    });

    filtered = this.sortCollection(filtered, sortBy);

    const noFilters = !searchQuery && !genreFilter && !yearFilter && sortBy === 'recent';
    if (noFilters && filtered.length === Profile.collection.length) {
      this.renderCollection();
      return;
    }

    if (filtered.length === 0) {
      const terms = Profile.getTerms();
      grid.innerHTML = `
        <div class="collection-empty">
          <div class="empty-icon">🔍</div>
          <p>No ${terms.itemPlural} found with current filters</p>
          <button onclick="Profile.clearFilters()" style="margin-top: 12px; padding: 8px 16px; background: var(--accent); border: none; border-radius: 6px; cursor: pointer; color: #000;">Clear Filters</button>
        </div>
      `;
      return;
    }

    const isVinyl = Profile.currentCategorySlug === 'vinyl';
    grid.innerHTML = filtered.map(album => `
      <div class="album-card" data-id="${album.id}">
        <img src="${album.cover || Profile.getPlaceholderCover(album)}"
             alt="${album.album}" loading="lazy"
             onerror="this.src='${Profile.getPlaceholderCover(album)}'">
        <div class="album-info">
          <p class="album-title">${Profile.escapeHtml(album.album)}</p>
          <p class="album-artist">${Profile.escapeHtml(album.artist)}</p>
        </div>
        ${isVinyl ? `<button class="refresh-btn" onclick="Profile.refreshCover(${album.id})" title="Find cover">↻</button>` : ''}
        <button class="remove-btn" onclick="Profile.removeFromCollection(${album.id})" title="Remove">&times;</button>
      </div>
    `).join('');

    grid.querySelectorAll('.album-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-btn') && !e.target.closest('.refresh-btn')) {
          const id = parseInt(card.dataset.id);
          ProfileShowcase.addToShowcase(id);
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
        return sorted;
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
   * Add record manually
   */
  async addRecordManually() {
    const artist = document.getElementById('manual-artist').value.trim();
    const album = document.getElementById('manual-album').value.trim();
    const year = document.getElementById('manual-year').value;
    const cover = document.getElementById('manual-cover').value.trim();

    if (!artist || !album) {
      Auth.showWarning('Artist and album are required');
      return;
    }

    try {
      const categoryId = Profile.getCurrentCategoryId();
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
        Profile.closeModal('add-record-modal');
        ProfileUI.updateCollectorScoreInstantly(0, 1);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to add album');
      }
    } catch (error) {
      console.error('Error adding album:', error);
      Auth.showError('Failed to add album');
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
      const parts = query.split(' - ');
      const artist = parts[0]?.trim() || query;
      const album = parts[1]?.trim() || query;

      const response = await Auth.apiRequest(`/api/discogs/search?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`);

      if (response.ok) {
        const data = await response.json();
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
            <p class="search-result-title">${Profile.escapeHtml(album)}</p>
            <p class="search-result-artist">${Profile.escapeHtml(artist)}${result.year ? ` (${result.year})` : ''}</p>
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
      const categoryId = Profile.getCurrentCategoryId();
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
        Profile.closeModal('add-record-modal');
        ProfileUI.updateCollectorScoreInstantly(0, 1);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to add album');
      }
    } catch (error) {
      console.error('Error adding album:', error);
      Auth.showError('Failed to add album');
    }
  },

  /**
   * Show tag editing modal
   */
  showTagModal(albumId) {
    const album = Profile.collection.find(a => a.id === albumId);
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
        <p class="tag-album-name">${Profile.escapeHtml(album.album)} - ${Profile.escapeHtml(album.artist)}</p>
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
        const album = Profile.collection.find(a => a.id === albumId);
        if (album) album.tags = tags || null;
        this.renderCollection();
        this.closeTagModal();
      } else {
        const errorText = await response.text();
        console.error('Error saving tags:', errorText);
        Auth.showError('Failed to save tags');
      }
    } catch (error) {
      console.error('Error saving tags:', error);
      Auth.showError('Failed to save tags');
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
        const album = Profile.collection.find(a => a.id === albumId);
        if (album) album.tags = null;
        this.renderCollection();
        this.closeTagModal();
      } else {
        const errorText = await response.text();
        console.error('Error clearing tags:', errorText);
        Auth.showError('Failed to clear tags');
      }
    } catch (error) {
      console.error('Error clearing tags:', error);
      Auth.showError('Failed to clear tags');
    }
  },

  /**
   * Show image modal for adding/changing album cover
   */
  showImageModal(albumId) {
    const album = Profile.collection.find(a => a.id === albumId);
    if (!album) return;

    Profile.editingImageAlbumId = albumId;

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
    Profile.editingImageAlbumId = null;
  },

  /**
   * Save image to collection item
   */
  async saveImage() {
    if (!Profile.editingImageAlbumId) return;

    const album = Profile.collection.find(a => a.id === Profile.editingImageAlbumId);
    if (!album) return;

    const urlInput = document.getElementById('image-url-input');
    const fileInput = document.getElementById('image-file-input');
    const btn = document.getElementById('save-image-btn');

    let imageUrl = urlInput.value.trim();

    if (fileInput.files[0]) {
      btn.textContent = 'Uploading...';
      btn.disabled = true;

      try {
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
        Auth.showError('Failed to upload image. Try using an image URL instead.');
        btn.textContent = 'Save';
        btn.disabled = false;
        return;
      }
    }

    if (!imageUrl) {
      Auth.showWarning('Please enter an image URL or upload a file');
      return;
    }

    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      const response = await Auth.apiRequest(`/api/collection/${album.id}`, {
        method: 'PUT',
        body: JSON.stringify({ cover: imageUrl })
      });

      if (response.ok) {
        album.cover = imageUrl;
        this.renderCollection();
        ProfileShowcase.renderShowcase();
        this.hideImageModal();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error('Save image error:', err);
      Auth.showError('Failed to save image');
    }

    btn.textContent = 'Save';
    btn.disabled = false;
  }
};

// Export for use
if (typeof window !== 'undefined') window.ProfileCollection = ProfileCollection;
