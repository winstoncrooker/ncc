/**
 * Interests namespace - Handles interest selection and onboarding
 */
const Interests = {
  // State
  categories: [],
  selectedCategories: [],
  selectedGroups: [],
  step: 1,
  hasInterests: false,

  /**
   * Initialize and check if onboarding is needed
   */
  async init() {
    this.bindEvents();

    // Check if user has any interests
    try {
      const response = await fetch(`${API_BASE}/interests/me`, {
        headers: Auth.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        this.hasInterests = data.has_interests;

        if (!this.hasInterests) {
          this.showOnboarding();
        }
      }
    } catch (error) {
      console.error('Error checking interests:', error);
    }
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Back button
    const backBtn = document.getElementById('onboarding-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.goBack());
    }

    // Continue button
    const continueBtn = document.getElementById('onboarding-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => this.goNext());
    }
  },

  /**
   * Show onboarding modal
   */
  async showOnboarding() {
    const modal = document.getElementById('onboarding-modal');
    const categoriesGrid = document.getElementById('categories-grid');

    // Load categories
    try {
      const response = await fetch(`${API_BASE}/categories`);
      if (!response.ok) throw new Error('Failed to load categories');

      const data = await response.json();
      this.categories = data.categories;

      categoriesGrid.innerHTML = this.categories.map(cat => `
        <div class="category-card" data-id="${cat.id}" onclick="Interests.toggleCategory(${cat.id})">
          <div class="category-icon">${cat.icon}</div>
          <div class="category-name">${cat.name}</div>
          <div class="category-description">${cat.description || ''}</div>
          <div class="category-check">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      `).join('');

      modal.classList.add('active');

    } catch (error) {
      console.error('Error loading categories:', error);
    }
  },

  /**
   * Toggle category selection
   */
  toggleCategory(categoryId) {
    const card = document.querySelector(`.category-card[data-id="${categoryId}"]`);
    const index = this.selectedCategories.indexOf(categoryId);

    if (index === -1) {
      this.selectedCategories.push(categoryId);
      card.classList.add('selected');
    } else {
      this.selectedCategories.splice(index, 1);
      card.classList.remove('selected');
    }

    // Update continue button state
    document.getElementById('onboarding-continue').disabled = this.selectedCategories.length === 0;
  },

  /**
   * Go to next step
   */
  async goNext() {
    if (this.step === 1) {
      // Move to step 2 - select sub-groups
      this.step = 2;
      await this.showSubgroups();
    } else if (this.step === 2) {
      // Save selections and close
      await this.saveSelections();
    }
  },

  /**
   * Go back to previous step
   */
  goBack() {
    if (this.step === 2) {
      this.step = 1;
      document.getElementById('categories-grid').style.display = 'grid';
      document.getElementById('onboarding-subgroups').style.display = 'none';
      document.getElementById('onboarding-back').style.display = 'none';
      document.getElementById('onboarding-title').textContent = 'Welcome to NCC!';
      document.querySelector('.onboarding-subtitle').textContent = 'What do you collect?';
    }
  },

  /**
   * Show sub-groups for selected categories
   */
  async showSubgroups() {
    const categoriesGrid = document.getElementById('categories-grid');
    const subgroupsContainer = document.getElementById('onboarding-subgroups');
    const subgroupsGrid = document.getElementById('subgroups-grid');
    const title = document.getElementById('onboarding-title');
    const subtitle = document.querySelector('.onboarding-subtitle');
    const backBtn = document.getElementById('onboarding-back');

    categoriesGrid.style.display = 'none';
    subgroupsContainer.style.display = 'block';
    backBtn.style.display = 'inline-block';
    title.textContent = 'Almost there!';
    subtitle.textContent = 'Select the groups you want to follow';

    subgroupsGrid.innerHTML = '<div class="loading">Loading groups...</div>';

    try {
      // Load sub-groups for all selected categories
      const allGroups = [];

      for (const categoryId of this.selectedCategories) {
        const cat = this.categories.find(c => c.id === categoryId);
        const response = await fetch(`${API_BASE}/categories/${cat.slug}`, {
          headers: Auth.getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          const groups = data.interest_groups.filter(g => g.level === 1);
          allGroups.push({
            category: cat,
            groups
          });
        }
      }

      subgroupsGrid.innerHTML = allGroups.map(({ category, groups }) => `
        <div class="category-subgroups">
          <h4>
            <span class="cat-icon">${category.icon}</span>
            ${category.name}
          </h4>
          <div class="subgroups-list">
            ${groups.map(g => `
              <div class="subgroup-card" data-id="${g.id}" onclick="Interests.toggleGroup(${g.id})">
                <span class="subgroup-name">${g.name}</span>
                <span class="subgroup-count">${g.member_count} members</span>
                <div class="subgroup-check">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');

      // Enable continue button (sub-groups are optional)
      document.getElementById('onboarding-continue').disabled = false;
      document.getElementById('onboarding-continue').textContent = 'Finish';

    } catch (error) {
      console.error('Error loading sub-groups:', error);
      subgroupsGrid.innerHTML = '<div class="error">Failed to load groups</div>';
    }
  },

  /**
   * Toggle group selection
   */
  toggleGroup(groupId) {
    const card = document.querySelector(`.subgroup-card[data-id="${groupId}"]`);
    const index = this.selectedGroups.indexOf(groupId);

    if (index === -1) {
      this.selectedGroups.push(groupId);
      card.classList.add('selected');
    } else {
      this.selectedGroups.splice(index, 1);
      card.classList.remove('selected');
    }
  },

  /**
   * Save all selections
   */
  async saveSelections() {
    const continueBtn = document.getElementById('onboarding-continue');
    continueBtn.disabled = true;
    continueBtn.textContent = 'Saving...';

    try {
      // Prepare batch join request
      const joins = [];

      // Add category memberships
      for (const categoryId of this.selectedCategories) {
        joins.push({ category_id: categoryId });
      }

      // Add group memberships
      for (const groupId of this.selectedGroups) {
        joins.push({ interest_group_id: groupId });
      }

      // Batch join
      const response = await fetch(`${API_BASE}/interests/batch-join`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(joins)
      });

      if (!response.ok) throw new Error('Failed to save interests');

      // Close modal and refresh
      this.hideOnboarding();
      this.hasInterests = true;

      // Switch to forums tab to show content
      Forums.switchMainTab('forums');

    } catch (error) {
      console.error('Error saving interests:', error);
      continueBtn.disabled = false;
      continueBtn.textContent = 'Finish';
      alert('Failed to save your interests. Please try again.');
    }
  },

  /**
   * Hide onboarding modal
   */
  hideOnboarding() {
    document.getElementById('onboarding-modal').classList.remove('active');

    // Reset state
    this.step = 1;
    this.selectedCategories = [];
    this.selectedGroups = [];
  },

  /**
   * Join a category (from elsewhere in the app)
   */
  async joinCategory(categoryId) {
    try {
      const response = await fetch(`${API_BASE}/interests/join`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category_id: categoryId })
      });

      if (!response.ok) throw new Error('Failed to join category');

      return await response.json();

    } catch (error) {
      console.error('Error joining category:', error);
      throw error;
    }
  },

  /**
   * Leave an interest
   */
  async leaveInterest(interestId) {
    try {
      const response = await fetch(`${API_BASE}/interests/leave/${interestId}`, {
        method: 'POST',
        headers: Auth.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to leave interest');

      return await response.json();

    } catch (error) {
      console.error('Error leaving interest:', error);
      throw error;
    }
  }
};

// Initialize after auth is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for Auth to initialize
  setTimeout(() => {
    if (Auth.isAuthenticated()) {
      Interests.init();
    }
  }, 500);
});
