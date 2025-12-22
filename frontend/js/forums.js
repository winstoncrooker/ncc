/**
 * Forums namespace - Handles forum functionality
 * Note: API_BASE is defined in interests.js which loads before this file
 */
const Forums = {
  // State
  posts: [],
  currentSort: 'hot',
  currentFilter: 'all',
  currentCategory: null,      // Category slug for filtering
  currentGroupId: null,       // Interest group ID for filtering
  cursor: null,
  hasMore: false,
  loading: false,
  currentPostId: null,

  /**
   * Initialize forums
   */
  async init() {
    this.bindEvents();
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Main tab switching
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchMainTab(e.target.dataset.tab));
    });

    // Feed tabs (hot/new/top)
    document.querySelectorAll('.feed-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sort = e.target.dataset.sort;
        this.setSort(sort);
      });
    });

    // Feed filter
    const feedFilter = document.getElementById('feed-filter');
    if (feedFilter) {
      feedFilter.addEventListener('change', (e) => {
        this.currentFilter = e.target.value === 'all' ? null : e.target.value;
        this.loadFeed(true);
      });
    }

    // Create post button
    const createPostBtn = document.getElementById('create-post-btn');
    if (createPostBtn) {
      createPostBtn.addEventListener('click', () => this.showCreatePostModal());
    }

    // Create post form
    const createPostForm = document.getElementById('create-post-form');
    if (createPostForm) {
      createPostForm.addEventListener('submit', (e) => this.handleCreatePost(e));
    }

    // Create post modal close
    const closeBtn = document.getElementById('create-post-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideCreatePostModal());
    }

    const cancelBtn = document.getElementById('create-post-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideCreatePostModal());
    }

    // Post detail modal
    const postDetailClose = document.getElementById('post-detail-close');
    if (postDetailClose) {
      postDetailClose.addEventListener('click', () => this.hidePostDetailModal());
    }

    // Category select change (populate groups)
    const postCategory = document.getElementById('post-category');
    if (postCategory) {
      postCategory.addEventListener('change', (e) => this.loadGroupsForCategory(e.target.value));
    }

    // Discover groups button
    const discoverBtn = document.getElementById('discover-groups-btn');
    if (discoverBtn) {
      discoverBtn.addEventListener('click', () => this.showDiscoverModal());
    }

    // Discover modal close
    const discoverClose = document.getElementById('discover-close');
    if (discoverClose) {
      discoverClose.addEventListener('click', () => this.hideDiscoverModal());
    }

    // Infinite scroll
    const feedContent = document.getElementById('feed-content');
    if (feedContent) {
      feedContent.addEventListener('scroll', () => this.handleScroll());
    }
  },

  /**
   * Switch main tabs (Profile/Forums)
   */
  switchMainTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update views
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `${tab}-view`);
    });

    // Load forums data if switching to forums
    if (tab === 'forums') {
      this.loadFeed(true);
      this.loadMyGroups();
    }
  },

  /**
   * Set sort order
   */
  setSort(sort) {
    this.currentSort = sort;

    // Update UI
    document.querySelectorAll('.feed-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === sort);
    });

    this.loadFeed(true);
  },

  /**
   * Load feed posts
   */
  async loadFeed(reset = false) {
    if (this.loading) return;
    this.loading = true;

    if (reset) {
      this.posts = [];
      this.cursor = null;
      this.hasMore = false;
    }

    const feedContent = document.getElementById('feed-content');
    const feedEmpty = document.getElementById('feed-empty');

    try {
      const params = new URLSearchParams({
        sort: this.currentSort,
        limit: '20'
      });

      if (this.currentFilter && this.currentFilter !== 'all') {
        params.append('post_type', this.currentFilter);
      }

      if (this.currentCategory) {
        params.append('category', this.currentCategory);
      }

      if (this.currentGroupId) {
        params.append('interest_group_id', this.currentGroupId);
      }

      if (this.cursor) {
        params.append('cursor', this.cursor);
      }

      const response = await fetch(`${API_BASE}/posts/feed?${params}`, {
        headers: Auth.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to load feed');

      const data = await response.json();

      this.posts = reset ? data.posts : [...this.posts, ...data.posts];
      this.cursor = data.cursor;
      this.hasMore = data.has_more;

      if (this.posts.length === 0) {
        feedEmpty.style.display = 'flex';
        feedContent.innerHTML = '';
        feedContent.appendChild(feedEmpty);
      } else {
        feedEmpty.style.display = 'none';
        this.renderPosts(reset);
      }

    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      this.loading = false;
    }
  },

  /**
   * Render posts to feed
   */
  renderPosts(reset = false) {
    const feedContent = document.getElementById('feed-content');

    if (reset) {
      feedContent.innerHTML = '';
    }

    const html = this.posts.map(post => this.renderPostCard(post)).join('');
    feedContent.innerHTML = html;
  },

  /**
   * Render a single post card
   */
  renderPostCard(post) {
    const score = post.upvote_count - post.downvote_count;
    const timeAgo = this.formatTimeAgo(post.created_at);
    const preview = this.truncateText(post.body, 200);

    const upvoteClass = post.user_vote === 1 ? 'active' : '';
    const downvoteClass = post.user_vote === -1 ? 'active' : '';
    const saveClass = post.is_saved ? 'active' : '';

    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-votes">
          <button class="vote-btn upvote ${upvoteClass}" onclick="Forums.vote(${post.id}, 1)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
          <span class="vote-count" id="vote-count-${post.id}">${score}</span>
          <button class="vote-btn downvote ${downvoteClass}" onclick="Forums.vote(${post.id}, -1)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        <div class="post-content" onclick="Forums.openPost(${post.id})">
          <div class="post-meta-top">
            <span class="post-category">${post.category_name || 'General'}</span>
            ${post.interest_group_name ? `<span class="post-group">${post.interest_group_name}</span>` : ''}
            <span class="post-type-badge ${post.post_type}">${this.getPostTypeLabel(post.post_type)}</span>
          </div>
          <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
          <p class="post-preview">${this.escapeHtml(preview)}</p>
          <div class="post-meta-bottom">
            <span class="post-author">
              ${post.author.picture ? `<img src="${post.author.picture}" alt="">` : ''}
              ${this.escapeHtml(post.author.name || 'Anonymous')}
            </span>
            <span class="post-time">${timeAgo}</span>
            <button class="post-action" onclick="event.stopPropagation(); Forums.openPost(${post.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              ${post.comment_count}
            </button>
            <button class="post-action ${saveClass}" onclick="event.stopPropagation(); Forums.toggleSave(${post.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${post.is_saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </article>
    `;
  },

  /**
   * Vote on a post
   */
  async vote(postId, value) {
    try {
      const response = await fetch(`${API_BASE}/votes`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ post_id: postId, value })
      });

      if (!response.ok) throw new Error('Vote failed');

      const data = await response.json();

      // Update UI optimistically
      const post = this.posts.find(p => p.id === postId);
      if (post) {
        post.upvote_count = data.upvote_count;
        post.downvote_count = data.downvote_count;
        post.user_vote = data.vote_value;
      }

      // Update vote count display
      const voteCount = document.getElementById(`vote-count-${postId}`);
      if (voteCount) {
        voteCount.textContent = data.upvote_count - data.downvote_count;
      }

      // Update button states
      const card = document.querySelector(`[data-post-id="${postId}"]`);
      if (card) {
        const upvoteBtn = card.querySelector('.vote-btn.upvote');
        const downvoteBtn = card.querySelector('.vote-btn.downvote');

        upvoteBtn.classList.toggle('active', data.vote_value === 1);
        downvoteBtn.classList.toggle('active', data.vote_value === -1);
      }

    } catch (error) {
      console.error('Error voting:', error);
    }
  },

  /**
   * Toggle save/unsave post
   */
  async toggleSave(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    const wasSaved = post.is_saved;

    try {
      const response = await fetch(`${API_BASE}/posts/${postId}/save`, {
        method: wasSaved ? 'DELETE' : 'POST',
        headers: Auth.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Save toggle failed');

      post.is_saved = !wasSaved;

      // Update UI
      const card = document.querySelector(`[data-post-id="${postId}"]`);
      if (card) {
        const saveBtn = card.querySelector('.post-action:last-child');
        saveBtn.classList.toggle('active', post.is_saved);
        const svg = saveBtn.querySelector('svg');
        svg.setAttribute('fill', post.is_saved ? 'currentColor' : 'none');
      }

    } catch (error) {
      console.error('Error toggling save:', error);
    }
  },

  /**
   * Open post detail
   */
  async openPost(postId) {
    this.currentPostId = postId;
    const modal = document.getElementById('post-detail-modal');
    const content = document.getElementById('post-detail-content');
    const title = document.getElementById('post-detail-title');

    modal.classList.add('open');
    content.innerHTML = '<div class="loading">Loading...</div>';

    try {
      // Fetch post details
      const postRes = await fetch(`${API_BASE}/posts/${postId}`, {
        headers: Auth.getAuthHeaders()
      });

      if (!postRes.ok) throw new Error('Failed to load post');

      const post = await postRes.json();
      title.textContent = post.title;

      // Fetch comments
      const commentsRes = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        headers: Auth.getAuthHeaders()
      });

      let comments = { comments: [], total_count: 0 };
      if (commentsRes.ok) {
        comments = await commentsRes.json();
      }

      content.innerHTML = this.renderPostDetail(post, comments);

    } catch (error) {
      console.error('Error loading post:', error);
      content.innerHTML = '<div class="error">Failed to load post</div>';
    }
  },

  /**
   * Render post detail view
   */
  renderPostDetail(post, comments) {
    const score = post.upvote_count - post.downvote_count;
    const timeAgo = this.formatTimeAgo(post.created_at);

    return `
      <div class="post-detail">
        <div class="post-detail-header">
          <div class="post-detail-meta">
            <span class="post-category">${post.category_name}</span>
            ${post.interest_group_name ? `<span class="post-group">${post.interest_group_name}</span>` : ''}
            <span class="post-type-badge ${post.post_type}">${this.getPostTypeLabel(post.post_type)}</span>
          </div>
          <div class="post-detail-author">
            ${post.author.picture ? `<img src="${post.author.picture}" alt="">` : ''}
            <span>${this.escapeHtml(post.author.name || 'Anonymous')}</span>
            <span class="dot">·</span>
            <span>${timeAgo}</span>
          </div>
        </div>

        <div class="post-detail-body">
          ${this.escapeHtml(post.body).replace(/\n/g, '<br>')}
        </div>

        <div class="post-detail-actions">
          <div class="post-votes horizontal">
            <button class="vote-btn upvote ${post.user_vote === 1 ? 'active' : ''}" onclick="Forums.vote(${post.id}, 1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <span class="vote-count">${score}</span>
            <button class="vote-btn downvote ${post.user_vote === -1 ? 'active' : ''}" onclick="Forums.vote(${post.id}, -1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
          <button class="action-btn ${post.is_saved ? 'active' : ''}" onclick="Forums.toggleSave(${post.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${post.is_saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Save
          </button>
        </div>

        <div class="post-comments">
          <h4>Comments (${comments.total_count})</h4>

          <form class="comment-form" onsubmit="Forums.submitComment(event, ${post.id})">
            <textarea id="new-comment" placeholder="Add a comment..." rows="3"></textarea>
            <button type="submit" class="btn-save">Comment</button>
          </form>

          <div class="comments-list">
            ${this.renderComments(comments.comments)}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render comments recursively
   */
  renderComments(comments, depth = 0) {
    if (!comments || comments.length === 0) {
      return depth === 0 ? '<p class="no-comments">No comments yet</p>' : '';
    }

    return comments.map(comment => {
      const score = comment.upvote_count - comment.downvote_count;
      const timeAgo = this.formatTimeAgo(comment.created_at);

      return `
        <div class="comment depth-${depth}" data-comment-id="${comment.id}">
          <div class="comment-header">
            ${comment.author.picture ? `<img src="${comment.author.picture}" alt="">` : ''}
            <span class="comment-author">${this.escapeHtml(comment.author.name || 'Anonymous')}</span>
            <span class="dot">·</span>
            <span class="comment-time">${timeAgo}</span>
          </div>
          <div class="comment-body">${this.escapeHtml(comment.body)}</div>
          <div class="comment-actions">
            <button class="vote-btn ${comment.user_vote === 1 ? 'active' : ''}" onclick="Forums.voteComment(${comment.id}, 1)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <span class="vote-count">${score}</span>
            <button class="vote-btn ${comment.user_vote === -1 ? 'active' : ''}" onclick="Forums.voteComment(${comment.id}, -1)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            ${depth < 2 ? `<button class="reply-btn" onclick="Forums.showReplyForm(${comment.id})">Reply</button>` : ''}
          </div>
          <div class="reply-form" id="reply-form-${comment.id}" style="display:none">
            <textarea placeholder="Reply..." rows="2"></textarea>
            <div class="reply-actions">
              <button class="btn-cancel" onclick="Forums.hideReplyForm(${comment.id})">Cancel</button>
              <button class="btn-save" onclick="Forums.submitReply(${comment.id})">Reply</button>
            </div>
          </div>
          ${comment.replies && comment.replies.length > 0 ? `
            <div class="comment-replies">
              ${this.renderComments(comment.replies, depth + 1)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  /**
   * Submit a comment
   */
  async submitComment(e, postId) {
    e.preventDefault();
    const textarea = document.getElementById('new-comment');
    const body = textarea.value.trim();

    if (!body) return;

    try {
      const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      });

      if (!response.ok) throw new Error('Failed to submit comment');

      textarea.value = '';
      // Reload post to show new comment
      this.openPost(postId);

    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  },

  /**
   * Vote on comment
   */
  async voteComment(commentId, value) {
    try {
      const response = await fetch(`${API_BASE}/votes`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment_id: commentId, value })
      });

      if (!response.ok) throw new Error('Vote failed');

      // Reload post to update UI
      if (this.currentPostId) {
        this.openPost(this.currentPostId);
      }

    } catch (error) {
      console.error('Error voting on comment:', error);
    }
  },

  /**
   * Show reply form
   */
  showReplyForm(commentId) {
    document.getElementById(`reply-form-${commentId}`).style.display = 'block';
  },

  /**
   * Hide reply form
   */
  hideReplyForm(commentId) {
    const form = document.getElementById(`reply-form-${commentId}`);
    form.style.display = 'none';
    form.querySelector('textarea').value = '';
  },

  /**
   * Submit reply
   */
  async submitReply(parentCommentId) {
    const form = document.getElementById(`reply-form-${parentCommentId}`);
    const textarea = form.querySelector('textarea');
    const body = textarea.value.trim();

    if (!body || !this.currentPostId) return;

    try {
      const response = await fetch(`${API_BASE}/posts/${this.currentPostId}/comments`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body, parent_comment_id: parentCommentId })
      });

      if (!response.ok) throw new Error('Failed to submit reply');

      this.openPost(this.currentPostId);

    } catch (error) {
      console.error('Error submitting reply:', error);
    }
  },

  /**
   * Hide post detail modal
   */
  hidePostDetailModal() {
    document.getElementById('post-detail-modal').classList.remove('open');
    this.currentPostId = null;
  },

  /**
   * Show create post modal
   */
  async showCreatePostModal() {
    const modal = document.getElementById('create-post-modal');
    const categorySelect = document.getElementById('post-category');

    // Load user's joined categories only
    try {
      const response = await fetch(`${API_BASE}/interests/me`, {
        headers: Auth.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        // Get unique categories from user's interests
        const categoryMap = new Map();
        for (const interest of data.interests) {
          if (interest.category_id && !categoryMap.has(interest.category_id)) {
            categoryMap.set(interest.category_id, {
              id: interest.category_id,
              slug: interest.category_slug,
              name: interest.category_name,
              icon: interest.category_icon || ''
            });
          }
        }
        const categories = Array.from(categoryMap.values());

        if (categories.length === 0) {
          categorySelect.innerHTML = '<option value="">Join a category first...</option>';
        } else {
          categorySelect.innerHTML = '<option value="">Select category...</option>' +
            categories.map(c => `<option value="${c.slug}" data-id="${c.id}">${c.icon} ${c.name}</option>`).join('');
        }
      }
    } catch (error) {
      console.error('Error loading user categories:', error);
    }

    modal.classList.add('open');
  },

  /**
   * Hide create post modal
   */
  hideCreatePostModal() {
    document.getElementById('create-post-modal').classList.remove('open');
    document.getElementById('create-post-form').reset();
    document.getElementById('post-group').innerHTML = '<option value="">No specific group</option>';
  },

  /**
   * Load groups for selected category
   */
  async loadGroupsForCategory(categoryId) {
    const groupSelect = document.getElementById('post-group');
    groupSelect.innerHTML = '<option value="">No specific group</option>';

    if (!categoryId) return;

    try {
      const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
        headers: Auth.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        const groups = data.interest_groups.filter(g => g.level === 1);
        groupSelect.innerHTML = '<option value="">No specific group</option>' +
          groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  },

  /**
   * Handle create post form submission
   */
  async handleCreatePost(e) {
    e.preventDefault();

    const categorySelect = document.getElementById('post-category');
    const categorySlug = categorySelect.value;
    const selectedOption = categorySelect.options[categorySelect.selectedIndex];
    const categoryId = selectedOption?.dataset?.id;
    const groupId = document.getElementById('post-group').value;
    const postType = document.getElementById('post-type').value;
    const title = document.getElementById('post-title').value.trim();
    const body = document.getElementById('post-body').value.trim();

    if (!categorySlug || !categoryId || !title || !body) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category_id: parseInt(categoryId),
          interest_group_id: groupId ? parseInt(groupId) : null,
          post_type: postType,
          title,
          body,
          images: []
        })
      });

      if (!response.ok) throw new Error('Failed to create post');

      this.hideCreatePostModal();
      this.loadFeed(true);

    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    }
  },

  /**
   * Load user's groups for sidebar
   */
  async loadMyGroups() {
    const container = document.getElementById('my-groups-list');

    try {
      const response = await fetch(`${API_BASE}/interests/me`, {
        headers: Auth.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to load groups');

      const data = await response.json();

      if (data.interests.length === 0) {
        container.innerHTML = '<div class="groups-empty">Join groups to see them here</div>';
        return;
      }

      // Add "All Posts" option at the top
      container.innerHTML = `
        <div class="group-item ${!this.currentCategory && !this.currentGroupId ? 'active' : ''}" onclick="Forums.filterByGroup(0, 0, null)">
          <span class="group-icon">📋</span>
          <span class="group-name">All Posts</span>
        </div>
      ` + data.interests.map(interest => {
        const name = interest.interest_group_name || interest.category_name;
        const icon = interest.category_icon || '';
        const isActive = (interest.interest_group_id && this.currentGroupId === interest.interest_group_id) ||
                         (!interest.interest_group_id && this.currentCategory === interest.category_slug);
        return `
          <div class="group-item ${isActive ? 'active' : ''}" onclick="Forums.filterByGroup(${interest.interest_group_id || 0}, ${interest.category_id || 0}, '${interest.category_slug || ''}')">
            <span class="group-icon">${icon}</span>
            <span class="group-name">${this.escapeHtml(name)}</span>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading groups:', error);
    }
  },

  /**
   * Filter feed by group or category
   */
  filterByGroup(groupId, categoryId, categorySlug) {
    // Reset filters
    if (groupId === 0 && categoryId === 0) {
      this.currentCategory = null;
      this.currentGroupId = null;
    } else if (groupId) {
      this.currentGroupId = groupId;
      this.currentCategory = null;
    } else if (categorySlug) {
      this.currentCategory = categorySlug;
      this.currentGroupId = null;
    }

    // Reload feed with new filter
    this.loadFeed(true);

    // Update active state in sidebar
    this.loadMyGroups();
  },

  /**
   * Show discover groups modal
   */
  async showDiscoverModal() {
    const modal = document.getElementById('discover-modal');
    const content = document.getElementById('discover-categories');

    modal.classList.add('open');
    content.innerHTML = '<div class="loading">Loading...</div>';

    try {
      console.log('[Forums] Fetching categories from:', `${API_BASE}/categories`);
      const response = await fetch(`${API_BASE}/categories`, {
        headers: Auth.getAuthHeaders()
      });

      console.log('[Forums] Categories response:', response.status, response.statusText);
      if (!response.ok) throw new Error(`Failed to load categories: ${response.status}`);

      const data = await response.json();
      console.log('[Forums] Categories data:', data);

      // Store categories for later use
      this.discoverCategories = data.categories;

      content.innerHTML = data.categories.map(cat => `
        <div class="discover-category">
          <div class="category-header" onclick="Forums.toggleCategoryGroups('${cat.slug}')">
            <span class="category-icon">${cat.icon}</span>
            <span class="category-name">${cat.name}</span>
            <span class="category-count">${cat.member_count} members</span>
            <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="category-groups" id="category-groups-${cat.slug}" style="display:none"></div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading categories:', error);
      content.innerHTML = '<div class="error">Failed to load categories</div>';
    }
  },

  /**
   * Toggle category groups visibility
   */
  async toggleCategoryGroups(categoryId) {
    const container = document.getElementById(`category-groups-${categoryId}`);

    if (container.style.display === 'none') {
      container.style.display = 'block';

      if (!container.innerHTML) {
        container.innerHTML = '<div class="loading">Loading...</div>';

        try {
          const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
            headers: Auth.getAuthHeaders()
          });

          if (!response.ok) throw new Error('Failed to load groups');

          const data = await response.json();

          const groups = data.interest_groups.filter(g => g.level === 1);
          container.innerHTML = groups.map(g => `
            <div class="group-item">
              <div class="group-info">
                <span class="group-name">${g.name}</span>
                <span class="group-count">${g.member_count} members</span>
              </div>
              <button class="join-btn" onclick="Forums.joinGroup(${g.id}, this)">Join</button>
            </div>
          `).join('');

        } catch (error) {
          container.innerHTML = '<div class="error">Failed to load</div>';
        }
      }
    } else {
      container.style.display = 'none';
    }
  },

  /**
   * Join a group
   */
  async joinGroup(groupId, btn) {
    try {
      const response = await fetch(`${API_BASE}/interests/join`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ interest_group_id: groupId })
      });

      if (!response.ok) throw new Error('Failed to join');

      btn.textContent = 'Joined';
      btn.disabled = true;
      btn.classList.add('joined');

      // Refresh sidebar
      this.loadMyGroups();

    } catch (error) {
      console.error('Error joining group:', error);
    }
  },

  /**
   * Hide discover modal
   */
  hideDiscoverModal() {
    document.getElementById('discover-modal').classList.remove('open');
  },

  /**
   * Handle infinite scroll
   */
  handleScroll() {
    const feedContent = document.getElementById('feed-content');
    const { scrollTop, scrollHeight, clientHeight } = feedContent;

    if (scrollTop + clientHeight >= scrollHeight - 100 && this.hasMore && !this.loading) {
      this.loadFeed(false);
    }
  },

  // Utility functions

  getPostTypeLabel(type) {
    const labels = {
      discussion: 'Discussion',
      showcase: 'Showcase',
      wtt_wts: 'Trading',
      question: 'Question',
      poll: 'Poll',
      event: 'Event'
    };
    return labels[type] || type;
  },

  formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
  },

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  Forums.init();
});
