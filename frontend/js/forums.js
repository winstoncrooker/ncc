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
  pendingPostImages: [],      // Images to upload with new post
  pendingCommentImages: [],   // Images to upload with new comment

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
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) this.switchMainTab(tab);
      });
    });

    // Feed tabs (hot/new/top)
    document.querySelectorAll('.feed-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sort = e.currentTarget.dataset.sort;
        if (sort) this.setSort(sort);
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

    // Post image upload
    const postImageInput = document.getElementById('post-image-input');
    if (postImageInput) {
      postImageInput.addEventListener('change', (e) => this.handlePostImageSelect(e));
    }
  },

  /**
   * Switch main tabs (Profile/Forums)
   */
  switchMainTab(tab) {
    // Save to localStorage for persistence
    localStorage.setItem('ncc_active_tab', tab);

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
   * Restore saved tab on page load
   */
  restoreSavedTab() {
    const savedTab = localStorage.getItem('ncc_active_tab');
    if (savedTab && (savedTab === 'profile' || savedTab === 'forums')) {
      this.switchMainTab(savedTab);
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
      // Special handling for "saved" tab
      if (this.currentSort === 'saved') {
        const response = await fetch(`${API_BASE}/posts/saved`, {
          headers: Auth.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to load saved posts');

        const data = await response.json();
        this.posts = data.posts || [];
        this.hasMore = false;

        if (this.posts.length === 0) {
          if (feedEmpty) feedEmpty.style.display = 'flex';
          if (feedContent) {
            feedContent.innerHTML = '<div class="feed-empty-msg">No saved posts yet. Save posts to view them here!</div>';
          }
        } else {
          if (feedEmpty) feedEmpty.style.display = 'none';
          this.renderPosts(reset);
        }
        return;
      }

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
        if (feedEmpty) feedEmpty.style.display = 'flex';
        if (feedContent) {
          feedContent.innerHTML = '<div class="feed-empty-msg">No posts yet. Be the first to create one!</div>';
        }
      } else {
        if (feedEmpty) feedEmpty.style.display = 'none';
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

      // Update vote count display in feed
      const voteCount = document.getElementById(`vote-count-${postId}`);
      if (voteCount) {
        voteCount.textContent = data.upvote_count - data.downvote_count;
      }

      // Update button states in feed
      const card = document.querySelector(`[data-post-id="${postId}"]`);
      if (card) {
        const upvoteBtn = card.querySelector('.vote-btn.upvote');
        const downvoteBtn = card.querySelector('.vote-btn.downvote');

        if (upvoteBtn) upvoteBtn.classList.toggle('active', data.vote_value === 1);
        if (downvoteBtn) downvoteBtn.classList.toggle('active', data.vote_value === -1);
      }

      // Also update post detail view if open
      const postPage = document.getElementById('post-page');
      if (postPage && postPage.style.display === 'block') {
        // Use data attribute to target exact post votes container
        const postVotes = postPage.querySelector(`.post-votes[data-post-id="${postId}"]`);
        if (postVotes) {
          const detailVoteCount = postVotes.querySelector('.vote-count');
          if (detailVoteCount) {
            detailVoteCount.textContent = data.upvote_count - data.downvote_count;
          }

          const detailUpvote = postVotes.querySelector('.vote-btn.upvote');
          const detailDownvote = postVotes.querySelector('.vote-btn.downvote');
          if (detailUpvote) detailUpvote.classList.toggle('active', data.vote_value === 1);
          if (detailDownvote) detailDownvote.classList.toggle('active', data.vote_value === -1);
        }
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
   * Open post detail as full page view
   */
  async openPost(postId) {
    this.currentPostId = postId;

    // Hide forums feed, show post detail page
    const forumsContainer = document.querySelector('.forums-container');
    let postPage = document.getElementById('post-page');

    // Create post page container if it doesn't exist
    if (!postPage) {
      postPage = document.createElement('div');
      postPage.id = 'post-page';
      postPage.className = 'post-page';
      forumsContainer.parentNode.insertBefore(postPage, forumsContainer.nextSibling);
    }

    forumsContainer.style.display = 'none';
    postPage.style.display = 'block';
    postPage.innerHTML = '<div class="post-page-loading">Loading...</div>';

    try {
      // Fetch post details
      const postRes = await fetch(`${API_BASE}/posts/${postId}`, {
        headers: Auth.getAuthHeaders()
      });

      if (!postRes.ok) throw new Error('Failed to load post');

      const post = await postRes.json();

      // Fetch comments
      const commentsRes = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        headers: Auth.getAuthHeaders()
      });

      let comments = { comments: [], total_count: 0 };
      if (commentsRes.ok) {
        comments = await commentsRes.json();
      }

      postPage.innerHTML = this.renderPostPage(post, comments);

      // Clear pending comment images and bind event listener
      this.pendingCommentImages = [];
      const commentImageInput = document.getElementById('comment-image-input');
      if (commentImageInput) {
        commentImageInput.addEventListener('change', (e) => this.handleCommentImageSelect(e));
      }

    } catch (error) {
      console.error('Error loading post:', error);
      postPage.innerHTML = `
        <div class="post-page-error">
          <button class="back-btn" onclick="Forums.closePostPage()">← Back to Forums</button>
          <p>Failed to load post</p>
        </div>
      `;
    }
  },

  /**
   * Close post page and return to forums feed
   */
  closePostPage() {
    const forumsContainer = document.querySelector('.forums-container');
    const postPage = document.getElementById('post-page');

    if (postPage) postPage.style.display = 'none';
    if (forumsContainer) forumsContainer.style.display = 'block';

    this.currentPostId = null;
  },

  /**
   * Render full page post view
   */
  renderPostPage(post, comments) {
    const score = post.upvote_count - post.downvote_count;
    const timeAgo = this.formatTimeAgo(post.created_at);

    return `
      <div class="post-page-content">
        <button class="back-btn" onclick="Forums.closePostPage()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Forums
        </button>

        <article class="post-full">
          <header class="post-full-header">
            <div class="post-full-meta">
              <span class="post-category">${post.category_name}</span>
              ${post.interest_group_name ? `<span class="post-group">${post.interest_group_name}</span>` : ''}
              <span class="post-type-badge ${post.post_type}">${this.getPostTypeLabel(post.post_type)}</span>
            </div>
            <h1 class="post-full-title">${this.escapeHtml(post.title)}</h1>
            <div class="post-full-author">
              ${post.author.picture ? `<img src="${post.author.picture}" alt="">` : '<div class="author-placeholder"></div>'}
              <span class="author-name">${this.escapeHtml(post.author.name || 'Anonymous')}</span>
              <span class="dot">·</span>
              <span class="post-time">${timeAgo}</span>
            </div>
          </header>

          <div class="post-full-body">
            ${this.escapeHtml(post.body).replace(/\n/g, '<br>')}
          </div>

          ${post.images && post.images.length > 0 ? `
            <div class="post-images">
              ${post.images.map(url => `
                <a href="${url}" target="_blank" class="post-image-link">
                  <img src="${url}" alt="Post image" loading="lazy">
                </a>
              `).join('')}
            </div>
          ` : ''}

          <div class="post-full-actions">
            <div class="post-votes horizontal" data-post-id="${post.id}">
              <button class="vote-btn upvote ${post.user_vote === 1 ? 'active' : ''}" onclick="event.preventDefault(); Forums.vote(${post.id}, 1)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </button>
              <span class="vote-count">${score}</span>
              <button class="vote-btn downvote ${post.user_vote === -1 ? 'active' : ''}" onclick="event.preventDefault(); Forums.vote(${post.id}, -1)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
            <button class="action-btn ${post.is_saved ? 'active' : ''}" onclick="event.preventDefault(); Forums.toggleSave(${post.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${post.is_saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              Save
            </button>
          </div>
        </article>

        <section class="comments-section">
          <h2>Comments (${comments.total_count})</h2>

          <form class="comment-form" onsubmit="Forums.submitComment(event, ${post.id})">
            <textarea id="new-comment" placeholder="Add a comment..." rows="3"></textarea>
            <div class="comment-image-upload">
              <input type="file" id="comment-image-input" accept="image/*" multiple style="display: none;">
              <button type="button" class="btn-upload-small" onclick="document.getElementById('comment-image-input').click()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Add Image
              </button>
              <div class="image-previews" id="comment-image-previews"></div>
            </div>
            <button type="submit" class="btn-primary">Comment</button>
          </form>

          <div class="comments-list">
            ${comments.comments.length === 0
              ? '<p class="no-comments">No comments yet</p>'
              : this.renderComments(comments.comments)
            }
          </div>
        </section>
      </div>
    `;
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
  renderComments(comments, depth = 0, currentUserId = null) {
    if (!comments || comments.length === 0) {
      return depth === 0 ? '<p class="no-comments">No comments yet</p>' : '';
    }

    // Get current user ID from Auth if not passed
    if (!currentUserId && typeof Auth !== 'undefined') {
      const token = Auth.getToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          // Parse as integer to ensure proper comparison with API's numeric user_id
          const rawId = payload.sub || payload.user_id;
          currentUserId = parseInt(rawId, 10);
        } catch (e) {
          console.error('Error parsing user ID from token:', e);
        }
      }
    }

    return comments.map(comment => {
      const score = comment.upvote_count - comment.downvote_count;
      const timeAgo = this.formatTimeAgo(comment.created_at);
      // Use strict equality after ensuring both are numbers
      const isOwner = currentUserId && parseInt(comment.user_id, 10) === currentUserId;

      // Render comment images if any
      const commentImages = comment.images && comment.images.length > 0
        ? `<div class="comment-images">${comment.images.map(url => `
            <a href="${url}" target="_blank" class="comment-image-link">
              <img src="${url}" alt="Comment image" loading="lazy">
            </a>
          `).join('')}</div>`
        : '';

      return `
        <div class="comment depth-${depth}" data-comment-id="${comment.id}">
          <div class="comment-header">
            ${comment.author.picture ? `<img src="${comment.author.picture}" alt="">` : ''}
            <span class="comment-author">${this.escapeHtml(comment.author.name || 'Anonymous')}</span>
            <span class="dot">·</span>
            <span class="comment-time">${timeAgo}</span>
          </div>
          <div class="comment-body">${this.escapeHtml(comment.body)}</div>
          ${commentImages}
          <div class="comment-actions">
            <button class="vote-btn ${comment.user_vote === 1 ? 'active' : ''}" onclick="event.preventDefault(); event.stopPropagation(); Forums.voteComment(${comment.id}, 1)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <span class="vote-count" id="comment-vote-${comment.id}">${score}</span>
            <button class="vote-btn ${comment.user_vote === -1 ? 'active' : ''}" onclick="event.preventDefault(); event.stopPropagation(); Forums.voteComment(${comment.id}, -1)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            ${depth < 2 ? `<button class="reply-btn" onclick="event.stopPropagation(); Forums.showReplyForm(${comment.id})">Reply</button>` : ''}
            ${isOwner ? `<button class="delete-btn" onclick="event.stopPropagation(); Forums.deleteComment(${comment.id})">Delete</button>` : ''}
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
              ${this.renderComments(comment.replies, depth + 1, currentUserId)}
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

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Posting...';
    submitBtn.disabled = true;

    try {
      // Upload any pending images first
      const imageUrls = [];
      for (const img of this.pendingCommentImages) {
        try {
          const url = await this.uploadImage(img.dataUrl, 'comment');
          imageUrls.push(url);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
        }
      }

      const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          ...Auth.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body, images: imageUrls })
      });

      if (!response.ok) throw new Error('Failed to submit comment');

      textarea.value = '';
      this.pendingCommentImages = [];
      // Reload post to show new comment
      this.openPost(postId);

    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  },

  /**
   * Vote on comment with optimistic UI update
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

      const data = await response.json();

      // Update UI optimistically
      const voteCount = document.getElementById(`comment-vote-${commentId}`);
      if (voteCount) {
        voteCount.textContent = data.upvote_count - data.downvote_count;
      }

      // Update button states
      const comment = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (comment) {
        const upvoteBtn = comment.querySelector('.vote-btn:first-child');
        const downvoteBtn = comment.querySelectorAll('.vote-btn')[1];

        if (upvoteBtn) upvoteBtn.classList.toggle('active', data.vote_value === 1);
        if (downvoteBtn) downvoteBtn.classList.toggle('active', data.vote_value === -1);
      }

    } catch (error) {
      console.error('Error voting on comment:', error);
    }
  },

  /**
   * Delete a comment
   */
  async deleteComment(commentId) {
    try {
      const response = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: 'DELETE',
        headers: Auth.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to delete comment');

      // Remove comment from DOM
      const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (commentEl) {
        commentEl.remove();
      }

      // Update comment count in header
      const countEl = document.querySelector('.post-comments h4');
      if (countEl) {
        const match = countEl.textContent.match(/\((\d+)\)/);
        if (match) {
          const newCount = Math.max(0, parseInt(match[1]) - 1);
          countEl.textContent = `Comments (${newCount})`;
        }
      }

    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
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
    // Clear pending images
    this.pendingPostImages = [];
    const previews = document.getElementById('post-image-previews');
    if (previews) previews.innerHTML = '';
  },

  /**
   * Load groups for selected category - only show JOINED groups
   */
  async loadGroupsForCategory(categorySlug) {
    const groupSelect = document.getElementById('post-group');
    groupSelect.innerHTML = '<option value="">No specific group</option>';

    if (!categorySlug) return;

    try {
      // Fetch user's joined interests and filter to only show groups for this category
      const response = await fetch(`${API_BASE}/interests/me`, {
        headers: Auth.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        // Filter to groups in this category (where interest_group_id exists)
        const joinedGroups = data.interests.filter(i =>
          i.category_slug === categorySlug && i.interest_group_id
        );

        if (joinedGroups.length > 0) {
          groupSelect.innerHTML = '<option value="">No specific group</option>' +
            joinedGroups.map(g => `<option value="${g.interest_group_id}">${g.interest_group_name}</option>`).join('');
        }
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

    const submitBtn = document.querySelector('#create-post-form button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;

    try {
      // Upload any pending images first
      const imageUrls = [];
      for (const img of this.pendingPostImages) {
        try {
          const url = await this.uploadImage(img.dataUrl, 'post');
          imageUrls.push(url);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
        }
      }

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
          images: imageUrls
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Create post error:', response.status, errorData);
        throw new Error(errorData.detail || 'Failed to create post');
      }

      this.hideCreatePostModal();
      this.loadFeed(true);

    } catch (error) {
      console.error('Error creating post:', error);
      alert(`Failed to create post: ${error.message}`);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  },

  /**
   * Handle image selection for post
   */
  handlePostImageSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Limit to 4 images
    const remaining = 4 - this.pendingPostImages.length;
    const toAdd = files.slice(0, remaining);

    toAdd.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`Image ${file.name} is too large (max 5MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        this.pendingPostImages.push({
          file,
          dataUrl: event.target.result
        });
        this.renderPostImagePreviews();
      };
      reader.readAsDataURL(file);
    });

    // Clear input
    e.target.value = '';
  },

  /**
   * Render post image previews
   */
  renderPostImagePreviews() {
    const container = document.getElementById('post-image-previews');
    if (!container) return;

    container.innerHTML = this.pendingPostImages.map((img, idx) => `
      <div class="image-preview">
        <img src="${img.dataUrl}" alt="Preview">
        <button type="button" class="remove-image" onclick="Forums.removePostImage(${idx})">&times;</button>
      </div>
    `).join('');
  },

  /**
   * Remove a pending post image
   */
  removePostImage(index) {
    this.pendingPostImages.splice(index, 1);
    this.renderPostImagePreviews();
  },

  /**
   * Upload an image to R2 storage
   */
  async uploadImage(dataUrl, type = 'post') {
    const response = await fetch(`${API_BASE}/uploads/image`, {
      method: 'POST',
      headers: {
        ...Auth.getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: dataUrl,
        type: type
      })
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const result = await response.json();
    return result.url;
  },

  /**
   * Handle image selection for comment
   */
  handleCommentImageSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Limit to 4 images
    const remaining = 4 - this.pendingCommentImages.length;
    const toAdd = files.slice(0, remaining);

    toAdd.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`Image ${file.name} is too large (max 5MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        this.pendingCommentImages.push({
          file,
          dataUrl: event.target.result
        });
        this.renderCommentImagePreviews();
      };
      reader.readAsDataURL(file);
    });

    // Clear input
    e.target.value = '';
  },

  /**
   * Render comment image previews
   */
  renderCommentImagePreviews() {
    const container = document.getElementById('comment-image-previews');
    if (!container) return;

    container.innerHTML = this.pendingCommentImages.map((img, idx) => `
      <div class="image-preview">
        <img src="${img.dataUrl}" alt="Preview">
        <button type="button" class="remove-image" onclick="Forums.removeCommentImage(${idx})">&times;</button>
      </div>
    `).join('');
  },

  /**
   * Remove a pending comment image
   */
  removeCommentImage(index) {
    this.pendingCommentImages.splice(index, 1);
    this.renderCommentImagePreviews();
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

      // Filter to only show main categories (not sub-groups) in sidebar
      // Sub-groups still affect what posts user sees, but don't clutter the sidebar
      const mainCategories = data.interests.filter(i => !i.interest_group_id);

      if (mainCategories.length === 0) {
        container.innerHTML = '<div class="groups-empty">Join categories to see them here</div>';
        return;
      }

      // Add "All Posts" option at the top
      container.innerHTML = `
        <div class="group-item ${!this.currentCategory && !this.currentGroupId ? 'active' : ''}" onclick="Forums.filterByGroup(0, 0, null)">
          <span class="group-icon">📋</span>
          <span class="group-name">All Posts</span>
        </div>
      ` + mainCategories.map(interest => {
        const name = interest.category_name;
        const icon = interest.category_icon || '';
        const isActive = this.currentCategory === interest.category_slug;
        return `
          <div class="group-item ${isActive ? 'active' : ''}" data-interest-id="${interest.id}">
            <div class="group-main" onclick="Forums.filterByGroup(0, ${interest.category_id || 0}, '${interest.category_slug || ''}')">
              <span class="group-icon">${icon}</span>
              <span class="group-name">${this.escapeHtml(name)}</span>
            </div>
            <button class="leave-btn" onclick="event.stopPropagation(); Forums.leaveGroup(${interest.id})" title="Leave category">×</button>
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
      // Fetch categories and user's joined interests in parallel
      const [categoriesRes, interestsRes] = await Promise.all([
        fetch(`${API_BASE}/categories`, { headers: Auth.getAuthHeaders() }),
        fetch(`${API_BASE}/interests/me`, { headers: Auth.getAuthHeaders() })
      ]);

      if (!categoriesRes.ok) throw new Error(`Failed to load categories: ${categoriesRes.status}`);

      const categoriesData = await categoriesRes.json();
      const interestsData = interestsRes.ok ? await interestsRes.json() : { interests: [] };

      // Build set of joined category slugs (main category memberships)
      const joinedCategorySlugs = new Set();
      for (const interest of interestsData.interests) {
        if (interest.category_slug) {
          joinedCategorySlugs.add(interest.category_slug);
        }
      }

      // Store for later use
      this.discoverCategories = categoriesData.categories;
      this.joinedCategorySlugs = joinedCategorySlugs;

      // Also build set of joined group IDs
      const joinedGroupIds = new Set();
      for (const interest of interestsData.interests) {
        if (interest.interest_group_id) {
          joinedGroupIds.add(interest.interest_group_id);
        }
      }
      this.joinedGroupIds = joinedGroupIds;

      // Store interest IDs for leave functionality
      this.interestIdsByCategory = {};
      this.interestIdsByGroup = {};
      for (const interest of interestsData.interests) {
        if (interest.category_slug && !interest.interest_group_id) {
          this.interestIdsByCategory[interest.category_slug] = interest.id;
        }
        if (interest.interest_group_id) {
          this.interestIdsByGroup[interest.interest_group_id] = interest.id;
        }
      }

      content.innerHTML = categoriesData.categories.map(cat => {
        const isJoined = joinedCategorySlugs.has(cat.slug);
        const interestId = this.interestIdsByCategory[cat.slug];
        return `
          <div class="discover-category" data-slug="${cat.slug}">
            <div class="category-header">
              <span class="category-icon">${cat.icon}</span>
              <span class="category-name">${cat.name}</span>
              <span class="category-count">${cat.member_count} members</span>
              ${isJoined ? `
                <button class="expand-btn" onclick="Forums.toggleCategoryGroups('${cat.slug}')">
                  <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <button class="leave-category-btn" onclick="Forums.leaveCategoryFromDiscover(${interestId}, '${cat.slug}', this)">Leave</button>
              ` : `
                <button class="join-category-btn" onclick="Forums.joinCategory('${cat.slug}', ${cat.id}, this)">+ Join</button>
              `}
            </div>
            <div class="category-groups" id="category-groups-${cat.slug}" style="display:none"></div>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading categories:', error);
      content.innerHTML = '<div class="error">Failed to load categories</div>';
    }
  },

  /**
   * Join a main category
   */
  async joinCategory(categorySlug, categoryId, btn) {
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

      const data = await response.json();
      const interestId = data.interest?.id;

      // Store the interest ID for leave functionality
      if (!this.interestIdsByCategory) this.interestIdsByCategory = {};
      this.interestIdsByCategory[categorySlug] = interestId;

      // Update UI - replace + Join with expand and leave buttons
      btn.outerHTML = `
        <button class="expand-btn" onclick="Forums.toggleCategoryGroups('${categorySlug}')">
          <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <button class="leave-category-btn" onclick="Forums.leaveCategoryFromDiscover(${interestId}, '${categorySlug}', this)">Leave</button>
      `;

      // Add to joined set
      this.joinedCategorySlugs.add(categorySlug);

      // Refresh sidebar
      this.loadMyGroups();

    } catch (error) {
      console.error('Error joining category:', error);
      alert('Failed to join category');
    }
  },

  /**
   * Leave a category from discover modal
   */
  async leaveCategoryFromDiscover(interestId, categorySlug, btn) {
    try {
      const response = await fetch(`${API_BASE}/interests/leave/${interestId}`, {
        method: 'POST',
        headers: Auth.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to leave category');

      // Find the category to get its ID
      const category = this.discoverCategories.find(c => c.slug === categorySlug);

      // Update UI - replace expand and leave buttons with + Join
      const header = btn.closest('.category-header');
      const expandBtn = header.querySelector('.expand-btn');
      if (expandBtn) expandBtn.remove();
      btn.outerHTML = `
        <button class="join-category-btn" onclick="Forums.joinCategory('${categorySlug}', ${category?.id || 0}, this)">+ Join</button>
      `;

      // Hide sub-groups if visible
      const groupsContainer = document.getElementById(`category-groups-${categorySlug}`);
      if (groupsContainer) {
        groupsContainer.style.display = 'none';
        groupsContainer.innerHTML = '';
      }

      // Remove from joined set
      this.joinedCategorySlugs.delete(categorySlug);
      delete this.interestIdsByCategory[categorySlug];

      // Refresh sidebar
      this.loadMyGroups();

      // Also refresh Profile's userCategories
      if (typeof Profile !== 'undefined') {
        await Profile.loadUserCategories();
      }

    } catch (error) {
      console.error('Error leaving category:', error);
      alert('Failed to leave category');
    }
  },

  /**
   * Toggle category groups visibility
   */
  async toggleCategoryGroups(categorySlug) {
    const container = document.getElementById(`category-groups-${categorySlug}`);

    if (container.style.display === 'none') {
      container.style.display = 'block';

      // Always refresh to show current join status
      container.innerHTML = '<div class="loading">Loading...</div>';

      try {
        const response = await fetch(`${API_BASE}/categories/${categorySlug}`, {
          headers: Auth.getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to load groups');

        const data = await response.json();

        const groups = data.interest_groups.filter(g => g.level === 1);
        container.innerHTML = groups.map(g => {
          const isJoined = this.joinedGroupIds && this.joinedGroupIds.has(g.id);
          const interestId = this.interestIdsByGroup ? this.interestIdsByGroup[g.id] : null;
          return `
            <div class="group-item" data-group-id="${g.id}">
              <div class="group-info">
                <span class="group-name">${g.name}</span>
                <span class="group-count">${g.member_count} members</span>
              </div>
              ${isJoined
                ? `<button class="leave-btn joined" onclick="Forums.leaveGroupFromDiscover(${interestId}, ${g.id}, this)">Leave</button>`
                : `<button class="join-btn" onclick="Forums.joinGroup(${g.id}, this)">Join</button>`
              }
            </div>
          `;
        }).join('');

      } catch (error) {
        container.innerHTML = '<div class="error">Failed to load</div>';
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

      const data = await response.json();
      const interestId = data.interest?.id;

      // Store the interest ID for leave functionality
      if (!this.interestIdsByGroup) this.interestIdsByGroup = {};
      this.interestIdsByGroup[groupId] = interestId;
      if (!this.joinedGroupIds) this.joinedGroupIds = new Set();
      this.joinedGroupIds.add(groupId);

      // Update UI - change to Leave button
      btn.outerHTML = `<button class="leave-btn joined" onclick="Forums.leaveGroupFromDiscover(${interestId}, ${groupId}, this)">Leave</button>`;

      // Refresh sidebar
      this.loadMyGroups();

    } catch (error) {
      console.error('Error joining group:', error);
    }
  },

  /**
   * Leave a group from discover modal
   */
  async leaveGroupFromDiscover(interestId, groupId, btn) {
    try {
      const response = await fetch(`${API_BASE}/interests/leave/${interestId}`, {
        method: 'POST',
        headers: Auth.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to leave group');

      // Update UI - change to Join button
      btn.outerHTML = `<button class="join-btn" onclick="Forums.joinGroup(${groupId}, this)">Join</button>`;

      // Remove from joined set
      if (this.joinedGroupIds) this.joinedGroupIds.delete(groupId);
      if (this.interestIdsByGroup) delete this.interestIdsByGroup[groupId];

      // Refresh sidebar
      this.loadMyGroups();

    } catch (error) {
      console.error('Error leaving group:', error);
      alert('Failed to leave group');
    }
  },

  /**
   * Leave a group/category
   */
  async leaveGroup(interestId) {
    try {
      const response = await fetch(`${API_BASE}/interests/leave/${interestId}`, {
        method: 'POST',
        headers: Auth.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to leave group');

      // Remove from DOM
      const item = document.querySelector(`[data-interest-id="${interestId}"]`);
      if (item) item.remove();

      // Refresh sidebar and reset filter if we left the currently filtered group
      this.loadMyGroups();

      // Also refresh Profile's userCategories
      if (typeof Profile !== 'undefined') {
        await Profile.loadUserCategories();
      }

    } catch (error) {
      console.error('Error leaving group:', error);
      alert('Failed to leave group');
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
    if (!dateString) return 'just now';

    // Handle SQLite datetime format (YYYY-MM-DD HH:MM:SS) by converting to ISO
    let normalizedDate = dateString;
    if (dateString.includes(' ') && !dateString.includes('T')) {
      normalizedDate = dateString.replace(' ', 'T') + 'Z';
    }

    const date = new Date(normalizedDate);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    // Handle invalid dates or future dates
    if (isNaN(seconds) || seconds < 0) return 'just now';

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

// Initialize on DOMContentLoaded (or immediately if already loaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    Forums.init();
  });
} else {
  // DOM already loaded, init immediately
  Forums.init();
}
