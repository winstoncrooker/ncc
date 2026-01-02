/**
 * Marketplace Module for Niche Collector Connector
 * Handles listings, offers, and transactions
 */

const MarketplaceModule = {
  // State
  listings: [],
  myListings: [],
  receivedOffers: [],
  sentOffers: [],
  currentListing: null,
  currentOffer: null,
  selectedTradeItems: [],
  listingPhotos: [],
  selectedCollectionItem: null,
  editingListingId: null,  // Track if we're editing vs creating
  userWishlist: [],  // Cached user wishlist for matching
  // Messaging state
  conversations: [],
  currentConversation: null,
  chatMessages: [],
  chatPollingInterval: null,
  unreadMessageCount: 0,
  currentChatOffer: null, // Current offer status in chat
  filters: {
    search: '',
    category: '',
    condition: '',
    type: '',
    priceMin: null,
    priceMax: null,
    location: '',
    sort: 'newest'
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0
  },
  myListingsStatus: 'active',
  myOffersType: 'received',

  /**
   * Initialize marketplace module
   */
  init() {
    this.setupEventListeners();
    // Load unread count for badge (if we have auth)
    if (typeof Auth !== 'undefined' && Auth.getToken()) {
      this.loadUnreadCount();
    }
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const addListener = (id, event, handler, silent = false) => {
      const element = document.getElementById(id);
      if (element) element.addEventListener(event, handler);
      else if (!silent) console.warn(`[Marketplace] Element #${id} not found`);
    };

    // Main tab switching for marketplace
    document.querySelectorAll('.marketplace-tab').forEach(tab => {
      tab.addEventListener('click', (event) => {
        const section = event.target.dataset.section;
        this.switchSection(section);
      });
    });

    // Create listing button
    addListener('create-listing-btn', 'click', () => this.openCreateListingModal());
    addListener('create-listing-close', 'click', () => this.closeModal('create-listing-modal'));
    addListener('create-listing-cancel', 'click', () => this.closeModal('create-listing-modal'));

    // Create listing form
    addListener('create-listing-form', 'submit', (event) => {
      event.preventDefault();
      this.createListing();
    });

    // Listing photos upload
    addListener('listing-photos-input', 'change', (event) => {
      this.handlePhotosUpload(event.target.files);
    });

    // Tab switching in create listing modal
    document.querySelectorAll('#create-listing-modal .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('#create-listing-modal .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#create-listing-modal .tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`)?.classList.add('active');

        if (tab === 'listing-collection') {
          this.loadCollectionForListing();
        }
      });
    });

    // Listing detail modal
    addListener('listing-detail-close', 'click', () => this.closeModal('listing-detail-modal'));
    addListener('btn-make-offer', 'click', () => this.openMakeOfferModal());
    addListener('btn-message-seller', 'click', () => this.messageSeller());

    // Make offer modal
    addListener('make-offer-close', 'click', () => this.closeModal('make-offer-modal'));
    addListener('make-offer-cancel', 'click', () => this.closeModal('make-offer-modal'));
    addListener('make-offer-form', 'submit', (event) => {
      event.preventDefault();
      this.submitOffer();
    });

    // Offer type selector
    document.querySelectorAll('input[name="offer-type"]').forEach(radio => {
      radio.addEventListener('change', (event) => {
        this.handleOfferTypeChange(event.target.value);
      });
    });

    // Add trade item button
    addListener('btn-add-trade-item', 'click', () => this.openSelectTradeItemsModal());

    // Select trade items modal
    addListener('select-trade-items-close', 'click', () => this.closeModal('select-trade-items-modal'));
    addListener('select-trade-items-cancel', 'click', () => this.closeModal('select-trade-items-modal'));
    addListener('select-trade-items-confirm', 'click', () => this.confirmTradeItems());

    // Offer detail modal
    addListener('offer-detail-close', 'click', () => this.closeModal('offer-detail-modal'));
    addListener('btn-accept-offer', 'click', () => this.acceptOffer());
    addListener('btn-counter-offer', 'click', () => this.openCounterOfferModal());
    addListener('btn-reject-offer', 'click', () => this.rejectOffer());

    // Counter offer modal
    addListener('counter-offer-close', 'click', () => this.closeModal('counter-offer-modal'));
    addListener('counter-offer-cancel', 'click', () => this.closeModal('counter-offer-modal'));
    addListener('counter-offer-form', 'submit', (event) => {
      event.preventDefault();
      this.submitCounterOffer();
    });

    // Complete transaction modal
    addListener('complete-transaction-close', 'click', () => this.closeModal('complete-transaction-modal'));
    addListener('complete-transaction-cancel', 'click', () => this.closeModal('complete-transaction-modal'));
    addListener('complete-transaction-form', 'submit', (event) => {
      event.preventDefault();
      this.completeTransaction();
    });

    // Star rating
    document.querySelectorAll('.star-rating .star').forEach(star => {
      star.addEventListener('click', (event) => {
        const rating = parseInt(event.target.dataset.rating);
        this.setRating(rating);
      });
    });

    // My listings tabs
    document.querySelectorAll('.my-listings-tab').forEach(tab => {
      tab.addEventListener('click', (event) => {
        document.querySelectorAll('.my-listings-tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        this.myListingsStatus = event.target.dataset.status;
        this.loadMyListings();
      });
    });

    // My offers tabs
    document.querySelectorAll('.my-offers-tab').forEach(tab => {
      tab.addEventListener('click', (event) => {
        document.querySelectorAll('.my-offers-tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        this.myOffersType = event.target.dataset.type;
        this.loadMyOffers();
      });
    });

    // Apply filters button
    addListener('apply-marketplace-filters', 'click', () => this.applyFilters());

    // Filter inputs - apply on enter
    ['marketplace-search-input', 'filter-location'].forEach(id => {
      addListener(id, 'keypress', (event) => {
        if (event.key === 'Enter') this.applyFilters();
      }, true);
    });

    // Marketplace messaging
    addListener('chat-back-btn', 'click', () => this.backToConversations(), true);
    addListener('chat-send-btn', 'click', () => this.sendChatMessage(), true);
    addListener('chat-message-input', 'keypress', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendChatMessage();
      }
    }, true);
  },

  /**
   * Switch between marketplace sections
   */
  switchSection(section) {
    // Update tabs
    document.querySelectorAll('.marketplace-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === section);
    });

    // Update sections
    document.querySelectorAll('.marketplace-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const sectionElement = document.getElementById(`marketplace-${section}`);
    if (sectionElement) {
      sectionElement.classList.add('active');
    }

    // Load data for section
    switch (section) {
      case 'browse':
        this.loadListings();
        break;
      case 'my-listings':
        this.loadMyListings();
        break;
      case 'my-offers':
        this.loadMyOffers();
        break;
      case 'messages':
        this.loadConversations();
        break;
    }
  },

  /**
   * Load marketplace when tab is activated
   */
  onTabActivated() {
    this.loadListings();
    this.loadUnreadCount();
  },

  /**
   * Apply filters and reload listings
   */
  applyFilters() {
    this.filters.search = document.getElementById('marketplace-search-input')?.value || '';
    this.filters.category = document.getElementById('filter-category')?.value || '';
    this.filters.condition = document.getElementById('filter-condition')?.value || '';
    this.filters.type = document.getElementById('filter-type')?.value || '';
    this.filters.priceMin = document.getElementById('filter-price-min')?.value || null;
    this.filters.priceMax = document.getElementById('filter-price-max')?.value || null;
    this.filters.location = document.getElementById('filter-location')?.value || '';
    this.filters.sort = document.getElementById('filter-sort-listings')?.value || 'newest';

    this.pagination.page = 1;
    this.loadListings();
  },

  /**
   * Load user's wishlist for matching against listings
   */
  async loadUserWishlist() {
    // First check if Profile already has wishlist loaded
    if (window.Profile?.wishlist && window.Profile.wishlist.length > 0) {
      this.userWishlist = window.Profile.wishlist;
      return;
    }

    // Otherwise load it from API
    try {
      const response = await Auth.apiRequest('/api/wishlist?include_found=false');
      if (response.ok) {
        this.userWishlist = await response.json();
      }
    } catch (error) {
      console.error('[Marketplace] Error loading wishlist:', error);
      this.userWishlist = [];
    }
  },

  /**
   * Check if a listing matches any wishlist item
   * Returns the matching wishlist item or null
   */
  findWishlistMatch(listing) {
    if (!this.userWishlist || this.userWishlist.length === 0) {
      return null;
    }

    const listingTitle = (listing.title || '').toLowerCase().trim();

    for (const wishlistItem of this.userWishlist) {
      // Skip already found items
      if (wishlistItem.is_found) continue;

      const wishlistTitle = (wishlistItem.title || '').toLowerCase().trim();
      const wishlistArtist = (wishlistItem.artist || '').toLowerCase().trim();

      // Check for matches
      // 1. Title contains wishlist title (e.g., "Pink Floyd - The Wall" contains "The Wall")
      if (wishlistTitle && listingTitle.includes(wishlistTitle)) {
        return wishlistItem;
      }

      // 2. Title contains wishlist artist (e.g., "Pink Floyd - Dark Side" contains "Pink Floyd")
      if (wishlistArtist && listingTitle.includes(wishlistArtist)) {
        return wishlistItem;
      }

      // 3. Wishlist title contains the listing title
      if (wishlistTitle && wishlistTitle.includes(listingTitle) && listingTitle.length > 3) {
        return wishlistItem;
      }

      // 4. Check if combined artist - album appears in listing
      if (wishlistArtist && wishlistTitle) {
        const combined = `${wishlistArtist} - ${wishlistTitle}`;
        if (listingTitle.includes(combined) || combined.includes(listingTitle)) {
          return wishlistItem;
        }
      }
    }

    return null;
  },

  /**
   * Load listings from API
   */
  async loadListings() {
    const grid = document.getElementById('listings-grid');
    if (!grid) return;

    // Show loading state
    grid.innerHTML = '<div class="listings-loading">Loading listings...</div>';

    try {
      // Load wishlist in parallel with listings for matching
      const wishlistPromise = this.loadUserWishlist();

      // Build query params
      const params = new URLSearchParams();
      params.append('page', this.pagination.page);
      params.append('limit', this.pagination.limit);

      if (this.filters.search) params.append('search', this.filters.search);
      // Category filter not yet supported on backend
      if (this.filters.condition) params.append('condition', this.filters.condition);
      if (this.filters.type) params.append('listing_type', this.filters.type);
      if (this.filters.priceMin) params.append('min_price', this.filters.priceMin);
      if (this.filters.priceMax) params.append('max_price', this.filters.priceMax);
      if (this.filters.location) params.append('location_state', this.filters.location);
      if (this.filters.sort) params.append('sort', this.filters.sort);

      const response = await Auth.apiRequest(`/api/marketplace/listings?${params.toString()}`);

      // Wait for wishlist to finish loading
      await wishlistPromise;

      if (response.ok) {
        const data = await response.json();
        this.listings = data.listings || [];
        this.pagination.total = data.total || 0;
        this.renderListings();
        this.renderPagination();
      } else {
        // API endpoint may not exist yet - show empty state
        this.listings = [];
        this.renderListings();
      }
    } catch (error) {
      console.error('[Marketplace] Error loading listings:', error);
      this.listings = [];
      this.renderListings();
    }
  },

  /**
   * Render listings grid
   */
  renderListings() {
    const grid = document.getElementById('listings-grid');
    if (!grid) return;

    if (this.listings.length === 0) {
      grid.innerHTML = `
        <div class="listings-empty" id="listings-empty">
          <div class="empty-icon">🏪</div>
          <p>No listings found</p>
          <span>Be the first to create a listing!</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.listings.map(listing => this.renderListingCard(listing)).join('');

    // Add click handlers
    grid.querySelectorAll('.listing-card').forEach(card => {
      card.addEventListener('click', () => {
        const listingId = parseInt(card.dataset.id);
        this.openListingDetail(listingId);
      });
    });
  },

  /**
   * Render a single listing card
   */
  renderListingCard(listing) {
    const price = listing.price ? `$${parseFloat(listing.price).toFixed(2)}` : 'Trade Only';
    const priceClass = listing.price ? '' : 'trade-only';
    const conditionLabel = this.formatCondition(listing.condition);
    const typeLabel = listing.type === 'trade' ? 'Trade Only' : (listing.type === 'both' ? 'Sale/Trade' : '');

    // Get seller info from nested object or flat fields (backwards compat)
    const sellerName = listing.seller?.name || listing.seller_name || 'Seller';
    const sellerPicture = listing.seller?.picture || listing.seller_picture;
    const sellerRating = listing.seller?.rating_average || listing.seller_rating;
    const sellerAvatar = sellerPicture || Utils.getDefaultAvatar(sellerName);
    const rating = sellerRating ? `${'★'.repeat(Math.round(sellerRating))}` : '';

    const placeholder = Utils.getDefaultItemPlaceholder();
    const coverImage = listing.images && listing.images.length > 0
      ? Utils.sanitizeImageUrl(listing.images[0].image_url, placeholder)
      : Utils.sanitizeImageUrl(listing.collection_item?.cover || listing.cover, placeholder);

    // Check if this listing matches any wishlist item
    const wishlistMatch = this.findWishlistMatch(listing);
    const wishlistBadge = wishlistMatch
      ? `<span class="listing-badge badge-wishlist" title="Matches: ${this.escapeHtml(wishlistMatch.title)}">On Your Wishlist!</span>`
      : '';
    const wishlistClass = wishlistMatch ? 'wishlist-match' : '';

    return `
      <div class="listing-card ${wishlistClass}" data-id="${listing.id}">
        <div class="listing-card-image">
          <img src="${coverImage}" alt="${this.escapeHtml(listing.title)}" onerror="this.src='${placeholder}'">
          <div class="listing-card-badges">
            ${wishlistBadge}
            <span class="listing-badge badge-condition">${this.escapeHtml(conditionLabel)}</span>
            ${typeLabel ? `<span class="listing-badge badge-trade-only">${this.escapeHtml(typeLabel)}</span>` : ''}
          </div>
        </div>
        <div class="listing-card-info">
          <h3 class="listing-card-title">${this.escapeHtml(listing.title)}</h3>
          <p class="listing-card-price ${priceClass}">${this.escapeHtml(price)}</p>
          <div class="listing-card-meta">
            ${listing.city ? `<span class="listing-card-location">${this.escapeHtml(listing.city)}${listing.state ? ', ' + this.escapeHtml(listing.state) : ''}</span>` : ''}
          </div>
          <div class="listing-card-seller">
            <img src="${sellerAvatar}" alt="" class="listing-seller-avatar" onerror="this.style.opacity='0.3'">
            <span class="listing-seller-name">${this.escapeHtml(sellerName)}</span>
            ${rating ? `<span class="listing-seller-rating">${rating}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render pagination controls
   */
  renderPagination() {
    const container = document.getElementById('listings-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.pagination.total / this.pagination.limit);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    // Previous button
    if (this.pagination.page > 1) {
      html += `<button onclick="MarketplaceModule.goToPage(${this.pagination.page - 1})">&lt;</button>`;
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
        html += `<button class="${i === this.pagination.page ? 'active' : ''}" onclick="MarketplaceModule.goToPage(${i})">${i}</button>`;
      } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
        html += `<span style="padding: 0 8px;">...</span>`;
      }
    }

    // Next button
    if (this.pagination.page < totalPages) {
      html += `<button onclick="MarketplaceModule.goToPage(${this.pagination.page + 1})">&gt;</button>`;
    }

    container.innerHTML = html;
  },

  /**
   * Go to a specific page
   */
  goToPage(page) {
    this.pagination.page = page;
    this.loadListings();
    // Scroll to top of listings
    document.getElementById('marketplace-browse')?.scrollIntoView({ behavior: 'smooth' });
  },

  /**
   * Load my listings
   */
  async loadMyListings() {
    const grid = document.getElementById('my-listings-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="listings-loading">Loading your listings...</div>';

    try {
      const response = await Auth.apiRequest(`/api/marketplace/listings/my?status=${this.myListingsStatus}`);

      if (response.ok) {
        const data = await response.json();
        this.myListings = data.listings || [];
        this.renderMyListings();
      } else {
        this.myListings = [];
        this.renderMyListings();
      }
    } catch (error) {
      console.error('[Marketplace] Error loading my listings:', error);
      this.myListings = [];
      this.renderMyListings();
    }
  },

  /**
   * Render my listings
   */
  renderMyListings() {
    const grid = document.getElementById('my-listings-grid');
    if (!grid) return;

    if (this.myListings.length === 0) {
      const statusText = this.myListingsStatus === 'active' ? 'active listings' :
                         this.myListingsStatus === 'sold' ? 'sold items' : 'expired listings';
      grid.innerHTML = `
        <div class="listings-empty" id="my-listings-empty">
          <div class="empty-icon">📦</div>
          <p>No ${statusText}</p>
          <span>${this.myListingsStatus === 'active' ? 'Create your first listing to start selling!' : ''}</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.myListings.map(listing => this.renderMyListingCard(listing)).join('');

    // Add click handlers
    grid.querySelectorAll('.listing-card').forEach(card => {
      card.addEventListener('click', (event) => {
        // Don't open detail if clicking action buttons
        if (event.target.closest('.my-listing-actions')) return;
        const listingId = parseInt(card.dataset.id);
        this.openListingDetail(listingId);
      });
    });
  },

  /**
   * Render my listing card with actions
   */
  renderMyListingCard(listing) {
    const baseCard = this.renderListingCard(listing);
    const statusBadge = `<span class="listing-status-badge ${listing.status}">${listing.status}</span>`;
    const actions = listing.status === 'active' ? `
      <div class="my-listing-actions">
        <button class="btn-edit-listing" onclick="MarketplaceModule.editListing(${listing.id})" title="Edit listing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-delete-listing" onclick="MarketplaceModule.deleteListing(${listing.id})" title="Delete listing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    ` : '';

    // Insert status badge and actions into the card
    return baseCard.replace('class="listing-card"', `class="listing-card my-listing-card"`)
                   .replace('</div>\n        <div class="listing-card-info">', `${statusBadge}</div>\n        ${actions}\n        <div class="listing-card-info">`);
  },

  /**
   * Load my offers
   */
  async loadMyOffers() {
    const list = document.getElementById('offers-list');
    if (!list) return;

    list.innerHTML = '<div class="listings-loading">Loading offers...</div>';

    try {
      const endpoint = this.myOffersType === 'received' ? '/api/marketplace/offers/received' : '/api/marketplace/offers/sent';
      const response = await Auth.apiRequest(endpoint);

      if (response.ok) {
        const data = await response.json();
        if (this.myOffersType === 'received') {
          this.receivedOffers = data.offers || [];
        } else {
          this.sentOffers = data.offers || [];
        }
        this.renderMyOffers();
      } else {
        if (this.myOffersType === 'received') {
          this.receivedOffers = [];
        } else {
          this.sentOffers = [];
        }
        this.renderMyOffers();
      }
    } catch (error) {
      console.error('[Marketplace] Error loading offers:', error);
      if (this.myOffersType === 'received') {
        this.receivedOffers = [];
      } else {
        this.sentOffers = [];
      }
      this.renderMyOffers();
    }
  },

  /**
   * Render my offers list
   */
  renderMyOffers() {
    const list = document.getElementById('offers-list');
    if (!list) return;

    const offers = this.myOffersType === 'received' ? this.receivedOffers : this.sentOffers;

    if (offers.length === 0) {
      const typeText = this.myOffersType === 'received' ? 'received' : 'sent';
      list.innerHTML = `
        <div class="offers-empty" id="offers-empty">
          <div class="empty-icon">📨</div>
          <p>No ${typeText} offers</p>
          <span>Offers you ${typeText === 'received' ? 'receive' : 'send'} will appear here</span>
        </div>
      `;
      return;
    }

    list.innerHTML = offers.map(offer => this.renderOfferCard(offer)).join('');

    // Add click handlers
    list.querySelectorAll('.offer-card').forEach(card => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('.offer-actions-quick')) return;
        const offerId = parseInt(card.dataset.id);
        this.openOfferDetail(offerId);
      });
    });
  },

  /**
   * Render an offer card
   */
  renderOfferCard(offer) {
    const coverImage = offer.listing_cover || Utils.getDefaultItemPlaceholder();
    const amount = offer.offer_amount ? `$${parseFloat(offer.offer_amount).toFixed(2)}` : 'Trade Only';
    const timeAgo = Utils.formatTime(offer.created_at);
    // Get buyer/seller from nested object or flat fields
    const buyerName = offer.buyer?.name || offer.buyer_name || 'Unknown';
    const sellerName = offer.seller?.name || offer.seller_name || 'Unknown';
    const userLabel = this.myOffersType === 'received' ? `From: ${buyerName}` : `To: ${sellerName}`;

    const quickActions = this.myOffersType === 'received' && offer.status === 'pending' ? `
      <div class="offer-actions-quick">
        <button class="btn-quick-accept" onclick="MarketplaceModule.quickAcceptOffer(${offer.id})">Accept</button>
        <button class="btn-quick-decline" onclick="MarketplaceModule.quickRejectOffer(${offer.id})">Decline</button>
      </div>
    ` : '';

    return `
      <div class="offer-card ${offer.status}" data-id="${offer.id}">
        <img src="${this.escapeHtml(coverImage)}" alt="" class="offer-item-image" onerror="this.style.opacity='0.3'">
        <div class="offer-info">
          <h4 class="offer-item-title">${this.escapeHtml(offer.listing_title)}</h4>
          <p class="offer-user">${this.escapeHtml(userLabel)}</p>
          <p class="offer-amount">${this.escapeHtml(amount)}</p>
          <span class="offer-status ${offer.status}">${offer.status}</span>
          <span class="offer-time">${timeAgo}</span>
        </div>
        ${quickActions}
      </div>
    `;
  },

  /**
   * Open create listing modal
   */
  openCreateListingModal() {
    this.listingPhotos = [];
    this.selectedCollectionItem = null;
    this.editingListingId = null;  // Reset edit mode

    // Reset form
    document.getElementById('create-listing-form')?.reset();
    document.getElementById('listing-photos-preview').innerHTML = '';

    // Update modal title for create mode
    const modalTitle = document.querySelector('#create-listing-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'Create Listing';

    // Load collection for selection
    this.loadCollectionForListing();

    this.openModal('create-listing-modal');
  },

  /**
   * Load user's collection for listing selection
   */
  async loadCollectionForListing() {
    const grid = document.getElementById('listing-collection-grid');
    if (!grid) return;

    // Use Profile's collection if available
    const collection = window.Profile?.collection || [];

    if (collection.length === 0) {
      grid.innerHTML = `
        <div class="listings-empty">
          <div class="empty-icon">📦</div>
          <p>No items in your collection</p>
          <span>Add items to your collection first, or use manual entry</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = collection.map(item => `
      <div class="listing-collection-item" data-id="${item.id}">
        <img src="${this.escapeHtml(Utils.sanitizeImageUrl(item.cover, Utils.getDefaultItemPlaceholder()))}" alt="${this.escapeHtml(item.album)}" onerror="this.style.opacity='0.3'">
        <span>${this.escapeHtml(item.album || item.artist)}</span>
      </div>
    `).join('');

    // Add click handlers
    grid.querySelectorAll('.listing-collection-item').forEach(item => {
      item.addEventListener('click', () => {
        grid.querySelectorAll('.listing-collection-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');

        const itemId = parseInt(item.dataset.id);
        const collectionItem = collection.find(c => c.id === itemId);
        this.selectCollectionItemForListing(collectionItem);
      });
    });
  },

  /**
   * Select a collection item for listing
   */
  selectCollectionItemForListing(item) {
    this.selectedCollectionItem = item;

    // Pre-fill the manual form with collection item data
    document.getElementById('listing-title').value = `${item.artist} - ${item.album}`;
    document.getElementById('listing-category').value = item.category || Profile?.currentCategorySlug || 'vinyl';

    // Switch to manual tab to let user complete the listing
    document.querySelectorAll('#create-listing-modal .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#create-listing-modal .tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('#create-listing-modal .tab-btn[data-tab="listing-manual"]')?.classList.add('active');
    document.getElementById('tab-listing-manual')?.classList.add('active');
  },

  /**
   * Handle photos upload
   */
  handlePhotosUpload(files) {
    const preview = document.getElementById('listing-photos-preview');
    if (!preview) return;

    const maxPhotos = 6;
    const remainingSlots = maxPhotos - this.listingPhotos.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);

    filesToAdd.forEach((file, index) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const photoIndex = this.listingPhotos.length;
        this.listingPhotos.push(event.target.result);

        const photoDiv = document.createElement('div');
        photoDiv.className = 'listing-photo-preview';
        photoDiv.innerHTML = `
          <img src="${event.target.result}" alt="Photo ${photoIndex + 1}">
          <button type="button" class="remove-photo" onclick="MarketplaceModule.removePhoto(${photoIndex})">&times;</button>
        `;
        preview.appendChild(photoDiv);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    document.getElementById('listing-photos-input').value = '';
  },

  /**
   * Remove a photo from listing
   */
  removePhoto(index) {
    this.listingPhotos.splice(index, 1);
    this.refreshPhotosPreview();
  },

  /**
   * Refresh photos preview after removal
   */
  refreshPhotosPreview() {
    const preview = document.getElementById('listing-photos-preview');
    if (!preview) return;

    preview.innerHTML = this.listingPhotos.map((photo, index) => `
      <div class="listing-photo-preview">
        <img src="${photo}" alt="Photo ${index + 1}">
        <button type="button" class="remove-photo" onclick="MarketplaceModule.removePhoto(${index})">&times;</button>
      </div>
    `).join('');
  },

  /**
   * Create or update a listing
   */
  async createListing() {
    const form = document.getElementById('create-listing-form');
    if (!form) return;

    const listingData = {
      title: document.getElementById('listing-title').value,
      description: document.getElementById('listing-description').value,
      condition: document.getElementById('listing-condition').value,
      listing_type: document.getElementById('listing-type').value,
      price: document.getElementById('listing-price').value || null,
      shipping_available: document.getElementById('listing-shipping').value === 'yes',
      location_city: document.getElementById('listing-city').value,
      location_state: document.getElementById('listing-state').value,
      images: this.listingPhotos
    };

    // Only include collection_id for new listings
    if (!this.editingListingId) {
      listingData.collection_id = this.selectedCollectionItem?.id || null;
    }

    try {
      const isEditing = !!this.editingListingId;
      const url = isEditing
        ? `/api/marketplace/listings/${this.editingListingId}`
        : '/api/marketplace/listings';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await Auth.apiRequest(url, {
        method,
        body: JSON.stringify(listingData)
      });

      if (response.ok) {
        Auth.showSuccess(isEditing ? 'Listing updated!' : 'Listing created!');
        this.closeModal('create-listing-modal');
        this.editingListingId = null;
        this.loadListings();
        this.loadMyListings();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || `Failed to ${isEditing ? 'update' : 'create'} listing`);
      }
    } catch (error) {
      console.error('[Marketplace] Error saving listing:', error);
      Auth.showError('Failed to save listing');
    }
  },

  /**
   * Open listing detail modal
   */
  async openListingDetail(listingId) {
    // Find listing in current data or fetch it
    let listing = this.listings.find(l => l.id === listingId) ||
                  this.myListings.find(l => l.id === listingId);

    if (!listing) {
      try {
        const response = await Auth.apiRequest(`/api/marketplace/listings/${listingId}`);
        if (response.ok) {
          listing = await response.json();
        } else {
          Auth.showError('Listing not found');
          return;
        }
      } catch (error) {
        console.error('[Marketplace] Error loading listing:', error);
        Auth.showError('Failed to load listing');
        return;
      }
    }

    // Normalize seller info for easier access
    listing.seller_id = listing.seller?.id || listing.user_id;
    listing.seller_name = listing.seller?.name || 'Seller';
    listing.seller_picture = listing.seller?.picture || '';

    this.currentListing = listing;
    this.renderListingDetail(listing);
    this.openModal('listing-detail-modal');
  },

  /**
   * Render listing detail content
   */
  renderListingDetail(listing) {
    const gallery = document.getElementById('listing-detail-gallery');
    // Get photos from images array or fall back to collection item cover
    const photos = listing.images && listing.images.length > 0
      ? listing.images.map(img => Utils.sanitizeImageUrl(img.image_url, Utils.getDefaultItemPlaceholder()))
      : [Utils.sanitizeImageUrl(listing.collection_item?.cover || listing.cover, Utils.getDefaultItemPlaceholder())];

    // Check for wishlist match and show banner
    const wishlistMatch = this.findWishlistMatch(listing);
    const wishlistBanner = wishlistMatch
      ? `<div class="listing-detail-wishlist-banner">
           <span class="wishlist-banner-icon">&#128276;</span>
           <span class="wishlist-banner-text">This item is on your wishlist: "${this.escapeHtml(wishlistMatch.title)}"</span>
         </div>`
      : '';

    gallery.innerHTML = `
      ${wishlistBanner}
      <img src="${photos[0]}" alt="${this.escapeHtml(listing.title)}" class="listing-detail-main-image" onerror="this.style.opacity='0.3'">
      ${photos.length > 1 ? `
        <div class="listing-detail-thumbnails">
          ${photos.map((photo, i) => `
            <img src="${photo}" alt="" class="listing-detail-thumbnail ${i === 0 ? 'active' : ''}" onclick="MarketplaceModule.selectMainImage(this, '${photo.replace(/'/g, "\\'")}')" onerror="this.style.display='none'">
          `).join('')}
        </div>
      ` : ''}
    `;

    document.getElementById('listing-detail-name').textContent = listing.title;
    document.getElementById('listing-detail-price').textContent = listing.price ? `$${parseFloat(listing.price).toFixed(2)}` : 'Trade Only';
    document.getElementById('listing-detail-condition').textContent = this.formatCondition(listing.condition);

    const typeEl = document.getElementById('listing-detail-type');
    typeEl.textContent = listing.type === 'trade' ? 'Trade Only' : (listing.type === 'both' ? 'Sale or Trade' : 'For Sale');
    typeEl.className = `listing-type-badge ${listing.type}`;

    document.getElementById('listing-detail-description').textContent = listing.description || '';

    const location = listing.city || listing.state ?
      `${listing.city || ''}${listing.city && listing.state ? ', ' : ''}${listing.state || ''}` : '';
    const locationEl = document.getElementById('listing-detail-location');
    locationEl.textContent = location;
    locationEl.style.display = location ? 'flex' : 'none';

    // Get seller info from nested object or flat fields
    const sellerId = listing.seller?.id || listing.user_id || listing.seller_id;
    const sellerName = listing.seller?.name || listing.seller_name || 'Seller';
    const sellerPicture = listing.seller?.picture || listing.seller_picture;
    const sellerRating = listing.seller?.rating_average;

    const sellerAvatar = sellerPicture || Utils.getDefaultAvatar(sellerName);
    document.getElementById('seller-avatar').src = sellerAvatar;
    document.getElementById('seller-name').textContent = sellerName;
    document.getElementById('seller-rating').textContent = sellerRating ?
      `${'★'.repeat(Math.round(sellerRating))} (${sellerRating.toFixed(1)})` : '';

    // Show/hide actions based on ownership
    const actionsEl = document.getElementById('listing-detail-actions');
    const currentUserId = window.Profile?.profile?.id;
    if (sellerId === currentUserId) {
      actionsEl.innerHTML = `
        <button class="btn-make-offer" onclick="MarketplaceModule.editListing(${listing.id})">Edit Listing</button>
        <button class="btn-message-seller" onclick="MarketplaceModule.deleteListing(${listing.id})">Delete</button>
      `;
    } else {
      actionsEl.innerHTML = `
        <button class="btn-make-offer" id="btn-make-offer">Make Offer</button>
        <button class="btn-message-seller" id="btn-message-seller">Message Seller</button>
      `;
      // Re-attach event listeners
      document.getElementById('btn-make-offer')?.addEventListener('click', () => this.openMakeOfferModal());
      document.getElementById('btn-message-seller')?.addEventListener('click', () => this.messageSeller());
    }
  },

  /**
   * Select main image in gallery
   */
  selectMainImage(thumbnail, imageUrl) {
    document.querySelector('.listing-detail-main-image').src = imageUrl;
    document.querySelectorAll('.listing-detail-thumbnail').forEach(t => t.classList.remove('active'));
    thumbnail.classList.add('active');
  },

  /**
   * Open make offer modal
   */
  openMakeOfferModal() {
    if (!this.currentListing) return;

    // Reset form
    document.getElementById('make-offer-form')?.reset();
    this.selectedTradeItems = [];
    document.getElementById('offer-trade-items').innerHTML =
      '<button type="button" class="btn-add-trade-item" id="btn-add-trade-item">+ Add from Collection</button>';
    document.getElementById('btn-add-trade-item')?.addEventListener('click', () => this.openSelectTradeItemsModal());

    // Show listing preview
    const preview = document.getElementById('offer-listing-preview');
    const photo = this.currentListing.images?.[0]?.image_url || this.currentListing.collection_item?.cover || Utils.getDefaultItemPlaceholder();
    preview.innerHTML = `
      <img src="${this.escapeHtml(photo)}" alt="" onerror="this.style.opacity='0.3'">
      <div class="preview-info">
        <span class="preview-title">${this.escapeHtml(this.currentListing.title)}</span>
        <span class="preview-price">${this.currentListing.price ? '$' + parseFloat(this.currentListing.price).toFixed(2) : 'Trade Only'}</span>
      </div>
    `;

    // Set default offer type based on listing type
    const defaultType = this.currentListing.type === 'trade' ? 'trade' : 'cash';
    document.querySelector(`input[name="offer-type"][value="${defaultType}"]`).checked = true;
    this.handleOfferTypeChange(defaultType);

    this.closeModal('listing-detail-modal');
    this.openModal('make-offer-modal');
  },

  /**
   * Handle offer type change
   */
  handleOfferTypeChange(type) {
    const cashSection = document.querySelector('.offer-cash-section');
    const tradeSection = document.querySelector('.offer-trade-section');

    if (type === 'cash') {
      cashSection.style.display = 'block';
      tradeSection.style.display = 'none';
    } else if (type === 'trade') {
      cashSection.style.display = 'none';
      tradeSection.style.display = 'block';
    } else {
      cashSection.style.display = 'block';
      tradeSection.style.display = 'block';
    }
  },

  /**
   * Open select trade items modal
   */
  openSelectTradeItemsModal() {
    const grid = document.getElementById('trade-items-grid');
    if (!grid) return;

    const collection = window.Profile?.collection || [];

    if (collection.length === 0) {
      grid.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">No items in your collection</p>';
    } else {
      grid.innerHTML = collection.map(item => {
        const isSelected = this.selectedTradeItems.some(t => t.id === item.id);
        return `
          <div class="trade-item-option ${isSelected ? 'selected' : ''}" data-id="${item.id}">
            <img src="${this.escapeHtml(Utils.sanitizeImageUrl(item.cover, Utils.getDefaultItemPlaceholder()))}" alt="${this.escapeHtml(item.album)}" onerror="this.style.opacity='0.3'">
            <span class="check-mark">✓</span>
            <span>${this.escapeHtml(item.album || item.artist)}</span>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.trade-item-option').forEach(option => {
        option.addEventListener('click', () => {
          option.classList.toggle('selected');
        });
      });
    }

    this.openModal('select-trade-items-modal');
  },

  /**
   * Confirm selected trade items
   */
  confirmTradeItems() {
    const collection = window.Profile?.collection || [];
    const selectedIds = Array.from(document.querySelectorAll('.trade-item-option.selected')).map(el => parseInt(el.dataset.id));

    this.selectedTradeItems = collection.filter(item => selectedIds.includes(item.id));
    this.renderSelectedTradeItems();
    this.closeModal('select-trade-items-modal');
  },

  /**
   * Render selected trade items in offer form
   */
  renderSelectedTradeItems() {
    const container = document.getElementById('offer-trade-items');
    if (!container) return;

    let html = this.selectedTradeItems.map(item => `
      <div class="trade-item-selected">
        <img src="${this.escapeHtml(Utils.sanitizeImageUrl(item.cover, Utils.getDefaultItemPlaceholder()))}" alt="" onerror="this.style.opacity='0.3'">
        <span class="item-name">${this.escapeHtml(item.album || item.artist)}</span>
        <button type="button" class="remove-trade-item" onclick="MarketplaceModule.removeTradeItem(${item.id})">&times;</button>
      </div>
    `).join('');

    html += '<button type="button" class="btn-add-trade-item" id="btn-add-trade-item">+ Add from Collection</button>';
    container.innerHTML = html;

    document.getElementById('btn-add-trade-item')?.addEventListener('click', () => this.openSelectTradeItemsModal());
  },

  /**
   * Remove a trade item
   */
  removeTradeItem(itemId) {
    this.selectedTradeItems = this.selectedTradeItems.filter(item => item.id !== itemId);
    this.renderSelectedTradeItems();
  },

  /**
   * Submit an offer
   */
  async submitOffer() {
    if (!this.currentListing) return;

    const offerType = document.querySelector('input[name="offer-type"]:checked').value;

    try {
      const response = await Auth.apiRequest(`/api/marketplace/listings/${this.currentListing.id}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          offer_type: offerType === 'cash' ? 'buy' : offerType,
          offer_amount: offerType !== 'trade' ? parseFloat(document.getElementById('offer-amount').value) : null,
          trade_items: offerType !== 'cash' ? this.selectedTradeItems.map(i => i.id) : [],
          message: document.getElementById('offer-message').value
        })
      });

      if (response.ok) {
        Auth.showSuccess('Offer sent successfully!');
        this.closeModal('make-offer-modal');
        this.loadMyOffers();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to send offer');
      }
    } catch (error) {
      console.error('[Marketplace] Error sending offer:', error);
      Auth.showError('Failed to send offer');
    }
  },

  /**
   * Open offer detail modal
   */
  async openOfferDetail(offerId) {
    const offers = this.myOffersType === 'received' ? this.receivedOffers : this.sentOffers;
    let offer = offers.find(o => o.id === offerId);

    if (!offer) {
      try {
        const response = await Auth.apiRequest(`/api/marketplace/offers/${offerId}`);
        if (response.ok) {
          offer = await response.json();
        } else {
          Auth.showError('Offer not found');
          return;
        }
      } catch (error) {
        console.error('[Marketplace] Error loading offer:', error);
        return;
      }
    }

    this.currentOffer = offer;
    this.renderOfferDetail(offer);
    this.openModal('offer-detail-modal');
  },

  /**
   * Render offer detail
   */
  renderOfferDetail(offer) {
    const fromSection = document.getElementById('offer-from-section');
    const forSection = document.getElementById('offer-for-section');
    const amountSection = document.getElementById('offer-amount-section');
    const tradeSection = document.getElementById('offer-trade-section');
    const messageSection = document.getElementById('offer-message-section');
    const actionsSection = document.getElementById('offer-actions');

    fromSection.innerHTML = `
      <img src="${this.escapeHtml(offer.buyer_picture || Utils.getDefaultAvatar(offer.buyer_name))}" alt="" onerror="this.src='${Utils.getDefaultAvatar(offer.buyer_name)}'">
      <div>
        <strong>${this.escapeHtml(offer.buyer_name)}</strong>
        <span style="color: var(--text-muted);"> made an offer</span>
      </div>
    `;

    forSection.innerHTML = `
      <img src="${this.escapeHtml(Utils.sanitizeImageUrl(offer.listing_cover, Utils.getDefaultItemPlaceholder()))}" alt="" onerror="this.style.opacity='0.3'">
      <div>
        <strong>${this.escapeHtml(offer.listing_title)}</strong>
        <span style="color: var(--accent);">${offer.listing_price ? '$' + parseFloat(offer.listing_price).toFixed(2) : 'Trade Only'}</span>
      </div>
    `;

    if (offer.amount) {
      amountSection.innerHTML = `
        <p class="amount-label">Offered Amount</p>
        <p class="amount-value">$${parseFloat(offer.amount).toFixed(2)}</p>
      `;
      amountSection.style.display = 'block';
    } else {
      amountSection.style.display = 'none';
    }

    if (offer.trade_items && offer.trade_items.length > 0) {
      tradeSection.innerHTML = `
        <h4>Items Offered in Trade</h4>
        ${offer.trade_items.map(item => `
          <div class="trade-item-selected">
            <img src="${this.escapeHtml(Utils.sanitizeImageUrl(item.cover, Utils.getDefaultItemPlaceholder()))}" alt="" onerror="this.style.opacity='0.3'">
            <span class="item-name">${this.escapeHtml(item.title)}</span>
          </div>
        `).join('')}
      `;
      tradeSection.style.display = 'block';
    } else {
      tradeSection.style.display = 'none';
    }

    if (offer.message) {
      messageSection.innerHTML = `<p>"${this.escapeHtml(offer.message)}"</p>`;
      messageSection.style.display = 'block';
    } else {
      messageSection.style.display = 'none';
    }

    // Show actions based on offer status and type
    if (this.myOffersType === 'received' && offer.status === 'pending') {
      actionsSection.innerHTML = `
        <button class="btn-accept-offer" id="btn-accept-offer">Accept</button>
        <button class="btn-counter-offer" id="btn-counter-offer">Counter</button>
        <button class="btn-reject-offer" id="btn-reject-offer">Decline</button>
      `;
      document.getElementById('btn-accept-offer')?.addEventListener('click', () => this.acceptOffer());
      document.getElementById('btn-counter-offer')?.addEventListener('click', () => this.openCounterOfferModal());
      document.getElementById('btn-reject-offer')?.addEventListener('click', () => this.rejectOffer());
    } else if (offer.status === 'accepted') {
      actionsSection.innerHTML = `
        <button class="btn-make-offer" onclick="MarketplaceModule.openCompleteTransaction()">Complete Transaction</button>
      `;
    } else {
      actionsSection.innerHTML = `<span class="offer-status ${offer.status}">${offer.status}</span>`;
    }
  },

  /**
   * Quick accept offer
   */
  async quickAcceptOffer(offerId) {
    event.stopPropagation();

    try {
      const response = await Auth.apiRequest(`/api/marketplace/offers/${offerId}/accept`, {
        method: 'POST'
      });

      if (response.ok) {
        Auth.showSuccess('Offer accepted!');
        this.loadMyOffers();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to accept offer');
      }
    } catch (error) {
      console.error('[Marketplace] Error accepting offer:', error);
      Auth.showError('Failed to accept offer');
    }
  },

  /**
   * Quick reject offer
   */
  async quickRejectOffer(offerId) {
    event.stopPropagation();

    try {
      const response = await Auth.apiRequest(`/api/marketplace/offers/${offerId}/reject`, {
        method: 'POST'
      });

      if (response.ok) {
        Auth.showSuccess('Offer declined');
        this.loadMyOffers();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to decline offer');
      }
    } catch (error) {
      console.error('[Marketplace] Error declining offer:', error);
      Auth.showError('Failed to decline offer');
    }
  },

  /**
   * Accept current offer
   */
  async acceptOffer() {
    if (!this.currentOffer) return;
    await this.quickAcceptOffer(this.currentOffer.id);
    this.closeModal('offer-detail-modal');
  },

  /**
   * Reject current offer
   */
  async rejectOffer() {
    if (!this.currentOffer) return;
    await this.quickRejectOffer(this.currentOffer.id);
    this.closeModal('offer-detail-modal');
  },

  /**
   * Open counter offer modal
   */
  openCounterOfferModal() {
    if (!this.currentOffer) return;

    document.getElementById('counter-offer-form')?.reset();
    document.getElementById('counter-original-amount').textContent =
      `Original offer: ${this.currentOffer.amount ? '$' + parseFloat(this.currentOffer.amount).toFixed(2) : 'Trade Only'}`;

    this.closeModal('offer-detail-modal');
    this.openModal('counter-offer-modal');
  },

  /**
   * Submit counter offer
   */
  async submitCounterOffer() {
    if (!this.currentOffer) return;

    const counterData = {
      amount: document.getElementById('counter-amount').value,
      message: document.getElementById('counter-message').value
    };

    try {
      const response = await Auth.apiRequest(`/api/marketplace/offers/${this.currentOffer.id}/counter`, {
        method: 'POST',
        body: JSON.stringify(counterData)
      });

      if (response.ok) {
        Auth.showSuccess('Counter offer sent!');
        this.closeModal('counter-offer-modal');
        this.loadMyOffers();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to send counter offer');
      }
    } catch (error) {
      console.error('[Marketplace] Error sending counter offer:', error);
      Auth.showError('Failed to send counter offer');
    }
  },

  /**
   * Open complete transaction modal
   */
  openCompleteTransaction() {
    if (!this.currentOffer) return;

    const summary = document.getElementById('transaction-summary');
    summary.innerHTML = `
      <img src="${this.escapeHtml(Utils.sanitizeImageUrl(this.currentOffer.listing_cover, Utils.getDefaultItemPlaceholder()))}" alt="" onerror="this.style.opacity='0.3'">
      <div class="summary-info">
        <h4>${this.escapeHtml(this.currentOffer.listing_title)}</h4>
        <p>${this.currentOffer.amount ? '$' + parseFloat(this.currentOffer.amount).toFixed(2) : 'Trade'}</p>
      </div>
    `;

    document.getElementById('rating-value').value = '0';
    document.querySelectorAll('.star-rating .star').forEach(star => star.classList.remove('active'));
    document.getElementById('transaction-feedback').value = '';

    this.closeModal('offer-detail-modal');
    this.openModal('complete-transaction-modal');
  },

  /**
   * Set rating value
   */
  setRating(rating) {
    document.getElementById('rating-value').value = rating;
    document.querySelectorAll('.star-rating .star').forEach((star, index) => {
      star.classList.toggle('active', index < rating);
    });
  },

  /**
   * Complete transaction
   */
  async completeTransaction() {
    if (!this.currentOffer) return;

    const transactionData = {
      rating: parseInt(document.getElementById('rating-value').value) || null,
      feedback: document.getElementById('transaction-feedback').value
    };

    try {
      const response = await Auth.apiRequest(`/api/marketplace/offers/${this.currentOffer.id}/complete`, {
        method: 'POST',
        body: JSON.stringify(transactionData)
      });

      if (response.ok) {
        Auth.showSuccess('Transaction completed!');
        this.closeModal('complete-transaction-modal');
        this.loadMyOffers();
        this.loadMyListings();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to complete transaction');
      }
    } catch (error) {
      console.error('[Marketplace] Error completing transaction:', error);
      Auth.showError('Failed to complete transaction');
    }
  },

  /**
   * Edit a listing
   */
  async editListing(listingId) {
    // Find the listing
    let listing = this.myListings.find(l => l.id === listingId) ||
                  this.listings.find(l => l.id === listingId);

    if (!listing) {
      // Fetch it from API
      try {
        const response = await Auth.apiRequest(`/api/marketplace/listings/${listingId}`);
        if (response.ok) {
          listing = await response.json();
        } else {
          Auth.showError('Listing not found');
          return;
        }
      } catch (error) {
        console.error('[Marketplace] Error fetching listing:', error);
        Auth.showError('Failed to load listing');
        return;
      }
    }

    // Set edit mode
    this.editingListingId = listingId;
    this.listingPhotos = listing.images?.map(img => img.image_url) || [];
    this.selectedCollectionItem = listing.collection_item || null;

    // Populate the form
    document.getElementById('listing-title').value = listing.title || '';
    document.getElementById('listing-description').value = listing.description || '';
    document.getElementById('listing-condition').value = listing.condition || '';
    document.getElementById('listing-type').value = listing.listing_type || listing.type || 'sale';
    document.getElementById('listing-price').value = listing.price || '';
    document.getElementById('listing-shipping').value = listing.shipping_available ? 'yes' : 'no';
    document.getElementById('listing-city').value = listing.location_city || '';
    document.getElementById('listing-state').value = listing.location_state || '';

    // Update photos preview
    this.refreshPhotosPreview();

    // Update modal title for edit mode
    const modalTitle = document.querySelector('#create-listing-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'Edit Listing';

    // Close detail modal if open
    this.closeModal('listing-detail-modal');

    // Open the edit modal
    this.openModal('create-listing-modal');
  },

  /**
   * Delete a listing
   */
  async deleteListing(listingId) {
    event.stopPropagation();

    try {
      const response = await Auth.apiRequest(`/api/marketplace/listings/${listingId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        Auth.showSuccess('Listing deleted');
        this.closeModal('listing-detail-modal');
        this.loadMyListings();
        this.loadListings();
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to delete listing');
      }
    } catch (error) {
      console.error('[Marketplace] Error deleting listing:', error);
      Auth.showError('Failed to delete listing');
    }
  },

  /**
   * Message seller - starts a marketplace conversation about the current listing
   */
  async messageSeller() {
    if (!this.currentListing) return;

    try {
      // Create or get existing conversation for this listing
      // Backend requires an initial message
      const response = await Auth.apiRequest('/api/marketplace/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({
          listing_id: this.currentListing.id,
          message: `Hi! I'm interested in "${this.currentListing.title}".`
        })
      });

      if (response.ok) {
        const conversation = await response.json();
        this.closeModal('listing-detail-modal');
        // Switch to messages tab and open this conversation
        this.switchSection('messages');
        // Reload conversations first, then open the new one
        await this.loadConversations();
        this.openConversation(conversation.id);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to start conversation');
      }
    } catch (error) {
      console.error('[Marketplace] Error starting conversation:', error);
      Auth.showError('Failed to start conversation');
    }
  },

  // ============================================================
  // MARKETPLACE MESSAGING
  // ============================================================

  /**
   * Load all marketplace conversations
   */
  async loadConversations() {
    const list = document.getElementById('conversations-list');
    if (!list) return;

    list.innerHTML = '<div class="listings-loading">Loading conversations...</div>';

    try {
      const response = await Auth.apiRequest('/api/marketplace/messages/conversations');

      if (response.ok) {
        this.conversations = await response.json();
        this.renderConversations();
      } else {
        this.conversations = [];
        this.renderConversations();
      }
    } catch (error) {
      console.error('[Marketplace] Error loading conversations:', error);
      this.conversations = [];
      this.renderConversations();
    }
  },

  /**
   * Render conversations list
   */
  renderConversations() {
    const list = document.getElementById('conversations-list');
    if (!list) return;

    if (this.conversations.length === 0) {
      list.innerHTML = `
        <div class="conversations-empty">
          <div class="empty-icon">💬</div>
          <p>No messages yet</p>
          <span>Start a conversation by messaging a seller</span>
        </div>
      `;
      return;
    }

    list.innerHTML = this.conversations.map(conv => {
      // Backend returns other_user_name, other_user_picture, unread_count
      const otherName = conv.other_user_name || 'User';
      const otherPicture = conv.other_user_picture;
      const avatar = otherPicture || Utils.getDefaultAvatar(otherName);
      const unreadCount = conv.unread_count || 0;
      const timeAgo = Utils.formatTime(conv.last_message_at);
      const lastMessage = conv.last_message || '';
      const truncatedMessage = lastMessage.length > 50 ? lastMessage.substring(0, 50) + '...' : lastMessage;

      return `
        <div class="conversation-item ${unreadCount > 0 ? 'unread' : ''}" data-id="${conv.id}">
          <img src="${avatar}" alt="" class="conversation-avatar" onerror="this.src='${Utils.getDefaultAvatar(otherName)}'">
          <div class="conversation-info">
            <div class="conversation-header">
              <span class="conversation-name">${this.escapeHtml(otherName)}</span>
              <span class="conversation-time">${timeAgo}</span>
            </div>
            <div class="conversation-listing">${this.escapeHtml(conv.listing_title)}</div>
            <div class="conversation-preview">${this.escapeHtml(truncatedMessage)}</div>
          </div>
          ${unreadCount > 0 ? `<span class="conversation-badge">${unreadCount}</span>` : ''}
        </div>
      `;
    }).join('');

    // Add click handlers
    list.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const conversationId = parseInt(item.dataset.id);
        this.openConversation(conversationId);
      });
    });
  },

  /**
   * Open a specific conversation
   */
  async openConversation(conversationId) {
    const conversation = this.conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    this.currentConversation = conversation;

    // Show chat view, hide list
    document.getElementById('conversations-list')?.classList.add('hidden');
    const chatView = document.getElementById('marketplace-chat');
    if (chatView) chatView.style.display = 'flex';

    // Update chat header - backend returns other_user_name, other_user_picture
    const otherName = conversation.other_user_name || 'User';
    const otherPicture = conversation.other_user_picture;

    document.getElementById('chat-other-avatar').src = otherPicture || Utils.getDefaultAvatar(otherName);
    document.getElementById('chat-other-name').textContent = otherName;
    document.getElementById('chat-listing-title').textContent = conversation.listing_title;

    // Load messages and offer status
    await this.loadMessages(conversationId);
    await this.loadChatOfferStatus(conversationId);

    // Start polling for new messages
    this.startChatPolling(conversationId);
  },

  /**
   * Load messages for a conversation
   */
  async loadMessages(conversationId) {
    try {
      const response = await Auth.apiRequest(`/api/marketplace/messages/conversations/${conversationId}`);

      if (response.ok) {
        // Backend returns array directly, not wrapped in { messages: [...] }
        const data = await response.json();
        this.chatMessages = Array.isArray(data) ? data : (data.messages || []);
        this.renderMessages();
      }
    } catch (error) {
      console.error('[Marketplace] Error loading messages:', error);
    }
  },

  /**
   * Render chat messages
   */
  renderMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const currentUserId = window.Profile?.profile?.id;

    if (this.chatMessages.length === 0) {
      container.innerHTML = `
        <div class="chat-empty">
          <p>No messages yet. Start the conversation!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.chatMessages.map(message => {
      const isMine = message.sender_id === currentUserId;
      const timeAgo = Utils.formatTime(message.created_at);
      const content = message.content || '';

      // Check for special offer messages
      const offerMatch = content.match(/^\[OFFER:(\d+):([\d.]+):(\w+)\](.*)$/);
      const acceptedMatch = content.match(/^\[OFFER_ACCEPTED:(\d+):([\d.]+)\]$/);
      const rejectedMatch = content.match(/^\[OFFER_REJECTED:(\d+):([\d.]+)\]$/);

      if (offerMatch) {
        const [, offerId, amount, offerType, extraMessage] = offerMatch;
        const typeLabel = offerType === 'offer' ? 'Offer' : 'Counter-offer';
        return `
          <div class="chat-message ${isMine ? 'sent' : 'received'} offer-message">
            <div class="offer-bubble">
              <div class="offer-header">${typeLabel}</div>
              <div class="offer-amount">$${parseFloat(amount).toFixed(2)}</div>
              ${extraMessage ? `<div class="offer-note">${this.escapeHtml(extraMessage.trim())}</div>` : ''}
            </div>
            <div class="message-time">${timeAgo}</div>
          </div>
        `;
      }

      if (acceptedMatch) {
        const [, offerId, amount] = acceptedMatch;
        return `
          <div class="chat-message system-message">
            <div class="system-bubble accepted">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>Offer accepted at $${parseFloat(amount).toFixed(2)}</span>
            </div>
            <div class="message-time">${timeAgo}</div>
          </div>
        `;
      }

      if (rejectedMatch) {
        const [, offerId, amount] = rejectedMatch;
        return `
          <div class="chat-message system-message">
            <div class="system-bubble rejected">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span>Offer declined ($${parseFloat(amount).toFixed(2)})</span>
            </div>
            <div class="message-time">${timeAgo}</div>
          </div>
        `;
      }

      // Regular message
      return `
        <div class="chat-message ${isMine ? 'sent' : 'received'}">
          <div class="message-bubble">${this.escapeHtml(content)}</div>
          <div class="message-time">${timeAgo}</div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  },

  /**
   * Send a chat message
   */
  async sendChatMessage() {
    if (!this.currentConversation) return;

    const input = document.getElementById('chat-message-input');
    const content = input?.value?.trim();

    if (!content) return;

    try {
      const response = await Auth.apiRequest(`/api/marketplace/messages/conversations/${this.currentConversation.id}`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        input.value = '';
        // Reload messages to show the new one
        await this.loadMessages(this.currentConversation.id);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to send message');
      }
    } catch (error) {
      console.error('[Marketplace] Error sending message:', error);
      Auth.showError('Failed to send message');
    }
  },

  /**
   * Go back to conversations list
   */
  backToConversations() {
    this.stopChatPolling();
    this.currentConversation = null;

    const chatView = document.getElementById('marketplace-chat');
    if (chatView) chatView.style.display = 'none';
    document.getElementById('conversations-list')?.classList.remove('hidden');

    // Reload conversations to update unread counts
    this.loadConversations();
  },

  /**
   * Start polling for new messages
   */
  startChatPolling(conversationId) {
    this.stopChatPolling();
    this.chatPollingInterval = setInterval(() => {
      if (this.currentConversation?.id === conversationId) {
        this.loadMessages(conversationId);
      }
    }, 5000);
  },

  /**
   * Stop polling for messages
   */
  stopChatPolling() {
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
      this.chatPollingInterval = null;
    }
  },

  /**
   * Load current offer status for conversation
   */
  async loadChatOfferStatus(conversationId) {
    try {
      const response = await Auth.apiRequest(`/api/marketplace/messages/conversations/${conversationId}/offer`);
      if (response.ok) {
        this.currentChatOffer = await response.json();
        this.renderOfferBar();
      }
    } catch (error) {
      console.error('[Marketplace] Error loading offer status:', error);
    }
  },

  /**
   * Render the offer action bar at the bottom of chat
   */
  renderOfferBar() {
    const container = document.getElementById('chat-offer-bar');
    if (!container) return;

    const offer = this.currentChatOffer;
    if (!offer) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    // If no offer yet, show make offer button
    if (!offer.has_offer) {
      const listingPrice = offer.listing_price ? `$${parseFloat(offer.listing_price).toFixed(2)}` : '';
      container.innerHTML = `
        <div class="offer-bar-content">
          <div class="offer-info">
            ${listingPrice ? `<span class="listing-price">Listed at ${listingPrice}</span>` : ''}
          </div>
          <button class="offer-btn make-offer" onclick="MarketplaceModule.showOfferInput()">
            Make Offer
          </button>
        </div>
      `;
      return;
    }

    // Has offer - show status and actions
    const currentAmount = offer.counter_amount || offer.offer_amount;
    const statusLabels = {
      'pending': offer.is_buyer ? 'Your offer' : 'Buyer offered',
      'countered': offer.is_buyer ? 'Seller countered' : 'Your counter',
      'rejected': 'Offer declined',
      'accepted': 'Accepted',
      'withdrawn': 'Withdrawn'
    };

    let actions = '';
    if (offer.can_accept && offer.status !== 'accepted') {
      actions += `<button class="offer-btn accept" onclick="MarketplaceModule.acceptChatOffer()">Accept $${parseFloat(currentAmount).toFixed(2)}</button>`;
    }
    if (offer.can_counter) {
      actions += `<button class="offer-btn counter" onclick="MarketplaceModule.showOfferInput()">Counter</button>`;
    }
    if (!offer.is_buyer && offer.status === 'pending') {
      actions += `<button class="offer-btn reject" onclick="MarketplaceModule.rejectChatOffer()">Decline</button>`;
    }

    container.innerHTML = `
      <div class="offer-bar-content">
        <div class="offer-status">
          <span class="status-label">${statusLabels[offer.status] || offer.status}</span>
          <span class="status-amount">$${parseFloat(currentAmount).toFixed(2)}</span>
        </div>
        <div class="offer-actions">${actions}</div>
      </div>
    `;
  },

  /**
   * Show offer input field
   */
  showOfferInput() {
    const container = document.getElementById('chat-offer-bar');
    if (!container) return;

    const currentAmount = this.currentChatOffer?.counter_amount || this.currentChatOffer?.offer_amount || this.currentChatOffer?.listing_price || '';
    const isCounter = this.currentChatOffer?.has_offer;

    container.innerHTML = `
      <div class="offer-input-form">
        <div class="offer-input-row">
          <span class="currency-symbol">$</span>
          <input type="number" id="chat-offer-amount" placeholder="0.00" step="0.01" min="0" value="${currentAmount}">
          <input type="text" id="chat-offer-message" placeholder="Add a note (optional)" maxlength="500">
        </div>
        <div class="offer-input-actions">
          <button class="offer-btn cancel" onclick="MarketplaceModule.renderOfferBar()">Cancel</button>
          <button class="offer-btn submit" onclick="MarketplaceModule.submitChatOffer()">
            ${isCounter ? 'Send Counter' : 'Send Offer'}
          </button>
        </div>
      </div>
    `;

    document.getElementById('chat-offer-amount')?.focus();
  },

  /**
   * Submit an offer from chat
   */
  async submitChatOffer() {
    if (!this.currentConversation) return;

    const amountInput = document.getElementById('chat-offer-amount');
    const messageInput = document.getElementById('chat-offer-message');
    const amount = parseFloat(amountInput?.value);
    const message = messageInput?.value?.trim() || null;

    if (!amount || amount <= 0) {
      Auth.showError('Please enter a valid amount');
      return;
    }

    try {
      const response = await Auth.apiRequest(
        `/api/marketplace/messages/conversations/${this.currentConversation.id}/offer`,
        {
          method: 'POST',
          body: JSON.stringify({ amount, message })
        }
      );

      if (response.ok) {
        // Reload messages and offer status
        await this.loadMessages(this.currentConversation.id);
        await this.loadChatOfferStatus(this.currentConversation.id);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to submit offer');
      }
    } catch (error) {
      console.error('[Marketplace] Error submitting offer:', error);
      Auth.showError('Failed to submit offer');
    }
  },

  /**
   * Accept offer from chat
   */
  async acceptChatOffer() {
    if (!this.currentConversation || !this.currentChatOffer?.offer_id) return;

    try {
      const response = await Auth.apiRequest(
        `/api/marketplace/messages/conversations/${this.currentConversation.id}/offer/${this.currentChatOffer.offer_id}/accept`,
        { method: 'POST' }
      );

      if (response.ok) {
        Auth.showSuccess('Offer accepted!');
        await this.loadMessages(this.currentConversation.id);
        await this.loadChatOfferStatus(this.currentConversation.id);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to accept offer');
      }
    } catch (error) {
      console.error('[Marketplace] Error accepting offer:', error);
      Auth.showError('Failed to accept offer');
    }
  },

  /**
   * Reject offer from chat
   */
  async rejectChatOffer() {
    if (!this.currentConversation || !this.currentChatOffer?.offer_id) return;

    try {
      const response = await Auth.apiRequest(
        `/api/marketplace/messages/conversations/${this.currentConversation.id}/offer/${this.currentChatOffer.offer_id}/reject`,
        { method: 'POST' }
      );

      if (response.ok) {
        await this.loadMessages(this.currentConversation.id);
        await this.loadChatOfferStatus(this.currentConversation.id);
      } else {
        const error = await response.json();
        Auth.showError(error.detail || 'Failed to decline offer');
      }
    } catch (error) {
      console.error('[Marketplace] Error declining offer:', error);
      Auth.showError('Failed to decline offer');
    }
  },

  /**
   * Load unread message count and update badge
   */
  async loadUnreadCount() {
    try {
      const response = await Auth.apiRequest('/api/marketplace/messages/unread-count');
      if (response.ok) {
        const data = await response.json();
        this.unreadMessageCount = data.count || 0;
        this.updateMessagesBadge();
      }
    } catch (error) {
      console.error('[Marketplace] Error loading unread count:', error);
    }
  },

  /**
   * Update the messages tab badge
   */
  updateMessagesBadge() {
    const badge = document.getElementById('marketplace-msg-badge');
    if (badge) {
      if (this.unreadMessageCount > 0) {
        badge.textContent = this.unreadMessageCount > 99 ? '99+' : this.unreadMessageCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  /**
   * Format condition value for display
   */
  formatCondition(condition) {
    const conditionMap = {
      'mint': 'Mint',
      'near_mint': 'Near Mint',
      'excellent': 'Excellent',
      'very_good': 'Very Good',
      'good': 'Good',
      'fair': 'Fair',
      'poor': 'Poor'
    };
    return conditionMap[condition] || condition || 'Unknown';
  },

  /**
   * Open a modal
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  },

  /**
   * Close a modal
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export for use in Profile
if (typeof window !== 'undefined') {
  window.MarketplaceModule = MarketplaceModule;
}

// Initialize on DOMContentLoaded (or immediately if already loaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    MarketplaceModule.init();
  });
} else {
  // DOM already loaded, init immediately
  MarketplaceModule.init();
}
