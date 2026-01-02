/**
 * Profile Modals Module
 * Handles all modal operations (edit profile, add record, cropper, etc.)
 */

const ProfileModals = {
  /**
   * Open edit profile modal
   */
  openEditProfileModal() {
    document.getElementById('edit-name').value = Profile.profile?.name || '';
    document.getElementById('edit-pronouns').value = Profile.profile?.pronouns || '';
    document.getElementById('edit-bio').value = Profile.profile?.bio || '';
    document.getElementById('bio-char-count').textContent = (Profile.profile?.bio || '').length;
    document.getElementById('edit-location').value = Profile.profile?.location || '';

    this.populateSocialLinksEditor();
    this.populateFeaturedCategoryDropdown();
    this.loadBlockedUsers();

    const privacy = Profile.profile?.privacy || {};
    document.getElementById('privacy-visibility').value = privacy.profile_visibility || 'public';
    document.getElementById('privacy-collection').checked = privacy.show_collection !== false;
    document.getElementById('privacy-showcase').checked = privacy.show_showcase !== false;
    document.getElementById('privacy-searchable').checked = privacy.searchable !== false;

    Profile.openModal('edit-profile-modal');
  },

  /**
   * Load and display blocked users
   */
  async loadBlockedUsers() {
    const container = document.getElementById('blocked-users-list');
    if (!container) return;

    container.innerHTML = '<p class="loading-text">Loading blocked users...</p>';

    try {
      const response = await Auth.apiRequest('/api/users/blocked');
      if (response.ok) {
        const blocked = await response.json();
        this.renderBlockedUsers(blocked);
      } else {
        container.innerHTML = '<p class="empty-text">Could not load blocked users</p>';
      }
    } catch (error) {
      console.error('Error loading blocked users:', error);
      container.innerHTML = '<p class="empty-text">Could not load blocked users</p>';
    }
  },

  /**
   * Render blocked users list
   */
  renderBlockedUsers(blocked) {
    const container = document.getElementById('blocked-users-list');
    if (!container) return;

    if (!blocked || blocked.length === 0) {
      container.innerHTML = '<p class="empty-text">No blocked users</p>';
      return;
    }

    container.innerHTML = blocked.map(user => `
      <div class="blocked-user-item">
        <img src="${Profile.escapeHtml(user.picture || '/images/default-avatar.png')}" alt="" class="blocked-user-avatar">
        <span class="blocked-user-name">${Profile.escapeHtml(user.name || 'Unknown User')}</span>
        <button class="btn-unblock" onclick="ProfileModals.unblockUser(${user.user_id})">Unblock</button>
      </div>
    `).join('');
  },

  /**
   * Unblock a user from the blocked list
   */
  async unblockUser(userId) {
    try {
      const response = await Auth.apiRequest(`/api/users/${userId}/block`, {
        method: 'DELETE'
      });
      if (response.ok) {
        Auth.showSuccess('User unblocked');
        this.loadBlockedUsers();
      } else {
        Auth.showError('Failed to unblock user');
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      Auth.showError('Failed to unblock user');
    }
  },

  /**
   * Populate featured category dropdown with user's categories
   */
  populateFeaturedCategoryDropdown() {
    const select = document.getElementById('featured-category');
    if (!select) return;

    select.innerHTML = '<option value="0">All Categories</option>';

    if (Profile.userCategories && Profile.userCategories.length > 0) {
      Profile.userCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
      });
    }

    const currentValue = Profile.profile?.featured_category_id || 0;
    select.value = currentValue;
  },

  /**
   * Populate social links editor dynamically
   */
  populateSocialLinksEditor() {
    const container = document.getElementById('social-links-list');
    if (!container) return;

    const rawLinks = Profile.profile?.external_links;
    container.innerHTML = '';

    // Handle both array format [{platform, url}] and object format {platform: url}
    let linksArray = [];
    if (Array.isArray(rawLinks)) {
      linksArray = rawLinks;
    } else if (rawLinks && typeof rawLinks === 'object') {
      // Convert object format to array format
      linksArray = Object.entries(rawLinks)
        .filter(([platform, url]) => url) // Only include links with URLs
        .map(([platform, url]) => ({ platform, url }));
    }

    linksArray.forEach((link, index) => {
      this.addSocialLinkField(link.platform, link.url, index);
    });
  },

  /**
   * Add a social link field to the editor
   */
  addSocialLinkField(platform, url, index) {
    const container = document.getElementById('social-links-list');
    const config = Profile.socialPlatforms[platform];
    if (!config) return;

    const field = document.createElement('div');
    field.className = 'social-link-field';
    field.dataset.index = index;
    const inputType = config.isUsername ? 'text' : 'url';
    field.innerHTML = `
      <div class="social-link-icon">${config.icon}</div>
      <input type="${inputType}" class="social-link-url" placeholder="${config.placeholder}" value="${Profile.escapeHtml(url || '')}">
      <input type="hidden" class="social-link-platform" value="${platform}">
      <button type="button" class="social-link-remove" onclick="ProfileModals.removeSocialLink(${index})">×</button>
    `;
    container.appendChild(field);
  },

  /**
   * Remove a social link field
   */
  removeSocialLink(index) {
    const field = document.querySelector(`.social-link-field[data-index="${index}"]`);
    if (field) field.remove();
  },

  /**
   * Show social platform picker
   */
  showSocialPicker() {
    let picker = document.getElementById('social-picker-modal');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'social-picker-modal';
      picker.className = 'modal';
      picker.innerHTML = `
        <div class="modal-content social-picker-content">
          <button class="modal-close" onclick="ProfileModals.closeSocialPicker()">×</button>
          <h3>Add Social Link</h3>
          <div class="social-picker-grid">
            ${Object.entries(Profile.socialPlatforms).map(([key, config]) => `
              <button class="social-picker-btn" onclick="ProfileModals.selectSocialPlatform('${key}')">
                ${config.icon}
                <span>${config.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      document.body.appendChild(picker);
    }
    picker.classList.add('open');
  },

  /**
   * Close social platform picker
   */
  closeSocialPicker() {
    const picker = document.getElementById('social-picker-modal');
    if (picker) picker.classList.remove('open');
  },

  /**
   * Select a social platform and add field
   */
  selectSocialPlatform(platform) {
    const container = document.getElementById('social-links-list');
    const existingFields = container.querySelectorAll('.social-link-field');
    const newIndex = existingFields.length;

    this.addSocialLinkField(platform, '', newIndex);
    this.closeSocialPicker();
  },

  /**
   * Get social links from form - returns dict format {platform: url}
   */
  getSocialLinksFromForm() {
    const container = document.getElementById('social-links-list');
    const fields = container.querySelectorAll('.social-link-field');
    const links = {};

    fields.forEach(field => {
      const platform = field.querySelector('.social-link-platform').value;
      const url = field.querySelector('.social-link-url').value.trim();
      if (platform && url) {
        links[platform] = url;
      }
    });

    return links;
  },

  /**
   * Save profile changes
   */
  async saveProfile() {
    const name = document.getElementById('edit-name').value.trim();
    const pronouns = document.getElementById('edit-pronouns').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const location = document.getElementById('edit-location').value.trim();

    const external_links = this.getSocialLinksFromForm();
    const featured_category_id = parseInt(document.getElementById('featured-category').value) || 0;

    const privacy = {
      profile_visibility: document.getElementById('privacy-visibility').value,
      show_collection: document.getElementById('privacy-collection').checked,
      show_showcase: document.getElementById('privacy-showcase').checked,
      searchable: document.getElementById('privacy-searchable').checked
    };

    try {
      const profileResponse = await Auth.apiRequest('/api/profile/me', {
        method: 'PUT',
        body: JSON.stringify({ name, pronouns, bio, location, external_links, featured_category_id })
      });

      const privacyResponse = await Auth.apiRequest('/api/profile/me/privacy', {
        method: 'PUT',
        body: JSON.stringify(privacy)
      });

      if (profileResponse.ok) {
        Profile.profile = await profileResponse.json();
        if (privacyResponse.ok) {
          Profile.profile.privacy = await privacyResponse.json();
        }
        ProfileUI.renderProfile();
        ProfileUI.renderProfileCompletion();
        Profile.closeModal('edit-profile-modal');
      } else {
        const error = await profileResponse.json();
        Auth.showError(error.detail || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Auth.showError('Failed to save profile');
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

    const config = Profile.categoryFormConfig[Profile.currentCategorySlug] || Profile.categoryFormConfig['vinyl'];

    const artistLabel = document.getElementById('manual-artist-label');
    const albumLabel = document.getElementById('manual-album-label');
    const yearLabel = document.getElementById('manual-year-label');
    const artistInput = document.getElementById('manual-artist');
    const albumInput = document.getElementById('manual-album');
    const yearInput = document.getElementById('manual-year');

    if (artistLabel) artistLabel.textContent = config.field1Label;
    if (albumLabel) albumLabel.textContent = config.field2Label;
    if (yearLabel) yearLabel.textContent = config.field3Label;
    if (artistInput) artistInput.placeholder = config.field1Placeholder;
    if (albumInput) albumInput.placeholder = config.field2Placeholder;
    if (yearInput) yearInput.placeholder = config.field3Placeholder;

    const isVinyl = Profile.currentCategorySlug === 'vinyl';
    const discogsTab = document.querySelector('#add-record-modal .tab-btn[data-tab="search"]');
    const discogsContent = document.getElementById('tab-search');

    if (discogsTab) {
      discogsTab.style.display = isVinyl ? '' : 'none';
    }

    if (!isVinyl) {
      const manualTab = document.querySelector('#add-record-modal .tab-btn[data-tab="manual"]');
      const manualContent = document.getElementById('tab-manual');

      document.querySelectorAll('#add-record-modal .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#add-record-modal .tab-content').forEach(c => c.classList.remove('active'));

      if (manualTab) manualTab.classList.add('active');
      if (manualContent) manualContent.classList.add('active');
    }

    Profile.openModal('add-record-modal');
  },

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
      Profile.cropperType = type;

      document.getElementById('cropper-title').textContent =
        type === 'profile' ? 'Adjust Profile Picture' : 'Adjust Background Image';

      const cropperImage = document.getElementById('cropper-image');

      if (Profile.cropper) {
        Profile.cropper.destroy();
        Profile.cropper = null;
      }

      const modal = document.getElementById('cropper-modal');
      modal.classList.add('open');
      if (type === 'background') {
        modal.classList.add('background-mode');
      } else {
        modal.classList.remove('background-mode');
      }

      const initCropper = () => {
        setTimeout(() => {
          Profile.cropper = new Cropper(cropperImage, {
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

      cropperImage.onload = initCropper;
      cropperImage.src = '';
      cropperImage.src = e.target.result;

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
      if (Profile.cropper) Profile.cropper.rotate(-90);
    });

    addListener('crop-rotate-right', 'click', () => {
      if (Profile.cropper) Profile.cropper.rotate(90);
    });

    addListener('crop-zoom-in', 'click', () => {
      if (Profile.cropper) Profile.cropper.zoom(0.1);
    });

    addListener('crop-zoom-out', 'click', () => {
      if (Profile.cropper) Profile.cropper.zoom(-0.1);
    });

    addListener('crop-reset', 'click', () => {
      if (Profile.cropper) Profile.cropper.reset();
    });

    addListener('cropper-save', 'click', () => this.saveCroppedImage());
  },

  /**
   * Close cropper modal
   */
  closeCropper() {
    document.getElementById('cropper-modal').classList.remove('open');
    document.getElementById('cropper-modal').classList.remove('background-mode');
    if (Profile.cropper) {
      Profile.cropper.destroy();
      Profile.cropper = null;
    }
    Profile.cropperType = null;
  },

  /**
   * Save cropped image - upload to R2
   */
  async saveCroppedImage() {
    if (!Profile.cropper) return;

    const saveBtn = document.getElementById('cropper-save');
    const btnText = saveBtn.querySelector('.btn-text');
    const btnLoading = saveBtn.querySelector('.btn-loading');

    try {
      btnText.style.display = 'none';
      btnLoading.style.display = 'inline-flex';
      saveBtn.disabled = true;

      const canvas = Profile.cropper.getCroppedCanvas({
        width: Profile.cropperType === 'profile' ? 400 : 1200,
        height: Profile.cropperType === 'profile' ? 400 : 675,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      const base64 = canvas.toDataURL('image/jpeg', 0.9);

      const response = await Auth.apiRequest('/api/uploads/image', {
        method: 'POST',
        body: JSON.stringify({
          image: base64,
          type: Profile.cropperType
        })
      });

      if (response.ok) {
        const data = await response.json();

        if (Profile.cropperType === 'profile') {
          document.getElementById('profile-picture').src = data.url;
          if (Profile.profile) Profile.profile.picture = data.url;
          ProfileUI.renderProfileCompletion();
        } else {
          document.getElementById('hero-background').style.backgroundImage = `url(${data.url})`;
          if (Profile.profile) Profile.profile.background_image = data.url;
        }

        this.closeCropper();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Auth.showError('Failed to upload image');
    } finally {
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      saveBtn.disabled = false;
    }
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
    Profile.openModal('add-wishlist-modal');
  }
};

// Export for use
if (typeof window !== 'undefined') window.ProfileModals = ProfileModals;
