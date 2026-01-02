/**
 * Template Registry - Manages category-specific profile templates
 */
const TemplateRegistry = {
  templates: {},

  /**
   * Register a template
   */
  register(slug, template) {
    this.templates[slug] = template;
  },

  /**
   * Get a template by category slug
   */
  get(slug) {
    return this.templates[slug] || null;
  },

  /**
   * Render a template
   */
  render(categorySlug, profile, items) {
    const template = this.get(categorySlug);
    if (!template) {
      return this.renderDefault(profile, items);
    }
    return template.render(profile, items);
  },

  /**
   * Default profile template
   */
  renderDefault(profile, items) {
    return `
      <div class="default-template">
        <div class="template-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Collector')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'No bio yet')}</p>
          </div>
        </div>
        <div class="template-stats">
          <div class="stat">
            <span class="stat-value">${parseInt(profile.item_count, 10) || 0}</span>
            <span class="stat-label">Items</span>
          </div>
        </div>
        <div class="template-collection">
          <h3>Collection</h3>
          <div class="collection-grid">
            ${items.map(item => `
              <div class="collection-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-title">${Utils.escapeHtml(item.title || '')}</span>
                  <span class="item-subtitle">${Utils.escapeHtml(item.subtitle || '')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Get category-specific section names
   */
  getSections(categorySlug) {
    // [0] = Showcase section name, [1] = Collection section name
    const sectionMap = {
      'vinyl': ['Showcase', 'Collection', 'Turntable Setup', 'Genre Breakdown'],
      'trading-cards': ['Featured Cards', 'Binder', 'Deck Lists', 'Trade List'],
      'cars': ['Finest Machines', 'Garage', 'Build Specs', 'Mod History'],
      'sneakers': ['Grails', 'Shoe Rack', 'Size Info', 'For Trade'],
      'watches': ['Centerpieces', 'Timepieces', 'Wrist Check', 'Wishlist'],
      'comics': ['Featured Issues', 'Long Boxes', 'Reading List', 'Pull List'],
      'video-games': ['Playing Now', 'Library', 'Backlog', 'Wishlist'],
      'coins': ['Collection', 'By Era', 'Graded Coins', 'Want List']
    };
    return sectionMap[categorySlug] || ['Showcase', 'Collection'];
  },

  /**
   * Get category-specific item nouns
   */
  getItemNouns(categorySlug) {
    const nounMap = {
      'vinyl': { singular: 'Record', plural: 'Records', icon: '💿' },
      'trading-cards': { singular: 'Card', plural: 'Cards', icon: '🃏' },
      'cars': { singular: 'Vehicle', plural: 'Vehicles', icon: '🚗' },
      'sneakers': { singular: 'Pair', plural: 'Pairs', icon: '👟' },
      'watches': { singular: 'Watch', plural: 'Watches', icon: '⌚' },
      'comics': { singular: 'Issue', plural: 'Issues', icon: '📚' },
      'video-games': { singular: 'Game', plural: 'Games', icon: '🎮' },
      'coins': { singular: 'Coin', plural: 'Coins', icon: '🪙' }
    };
    return nounMap[categorySlug] || { singular: 'Item', plural: 'Items', icon: '📦' };
  },

  /**
   * Get category-specific AI system prompt
   */
  getAIPrompt(categorySlug) {
    const prompts = {
      'vinyl': `You are a vinyl record assistant helping a collector manage their vinyl collection.
You can help with: adding records, getting recommendations, identifying pressings, discussing genres, and music history.
When suggesting actions, use these formats:
- To add: {ADD:Artist|Album}
- To remove: {REMOVE:Artist|Album}
- To showcase: {SHOWCASE:Artist|Album}
Keep responses concise and focused on vinyl collecting.`,

      'trading-cards': `You are a trading card expert helping a collector manage their card collection.
Specialties: Pokemon, MTG, Yu-Gi-Oh, Sports cards, grading (PSA/BGS), meta decks, and card values.
When suggesting actions, use these formats:
- To add: {ADD:Set|Card Name}
- To remove: {REMOVE:Set|Card Name}
Keep responses concise and focused on card collecting and trading.`,

      'cars': `You are an automotive enthusiast assistant helping a car collector.
Specialties: Classic cars, JDM, muscle cars, builds, modifications, valuations, and automotive history.
When suggesting actions, use these formats:
- To add: {ADD:Year Make Model}
- To remove: {REMOVE:Year Make Model}
Keep responses concise and focused on automotive collecting.`,

      'sneakers': `You are a sneaker culture expert helping a sneakerhead manage their collection.
Specialties: Jordans, Nike, Adidas, Yeezy, resale values, authentication, and release calendars.
When suggesting actions, use these formats:
- To add: {ADD:Brand|Model|Colorway}
- To remove: {REMOVE:Brand|Model}
Keep responses concise and focused on sneaker culture.`,

      'watches': `You are a horology expert helping a watch collector manage their collection.
Specialties: Luxury watches, vintage pieces, movements, complications, brand history, and valuations.
When suggesting actions, use these formats:
- To add: {ADD:Brand|Model|Reference}
- To remove: {REMOVE:Brand|Model}
Keep responses concise and focused on watch collecting.`,

      'comics': `You are a comic book expert helping a collector manage their comic collection.
Specialties: Marvel, DC, indie publishers, key issues, grading (CGC), and comic history.
When suggesting actions, use these formats:
- To add: {ADD:Publisher|Series|Issue}
- To remove: {REMOVE:Publisher|Series|Issue}
Keep responses concise and focused on comic collecting.`,

      'video-games': `You are a video game collector assistant helping manage a game collection.
Specialties: Retro gaming, CIB collecting, sealed games, platform history, and game valuations.
When suggesting actions, use these formats:
- To add: {ADD:Platform|Title}
- To remove: {REMOVE:Platform|Title}
Keep responses concise and focused on game collecting.`,

      'coins': `You are a numismatic expert helping a coin collector manage their collection.
Specialties: US coins, world coins, ancient coins, grading (NGC/PCGS), bullion, and coin history.
When suggesting actions, use these formats:
- To add: {ADD:Country|Denomination|Year}
- To remove: {REMOVE:Country|Denomination|Year}
Keep responses concise and focused on coin collecting.`
    };
    return prompts[categorySlug] || prompts['vinyl'];
  }
};

// Vinyl Records Template
TemplateRegistry.register('vinyl', {
  name: 'Vinyl Records',
  icon: '🎵',

  render(profile, items) {
    const showcaseItems = items.filter(i => i.in_showcase).slice(0, 8);
    const collectionItems = items;

    return `
      <div class="vinyl-template">
        <div class="template-header vinyl-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Vinyl Collector')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'Spinning wax since...')}</p>
          </div>
        </div>

        ${showcaseItems.length > 0 ? `
          <section class="template-section">
            <h3><span class="section-icon">✨</span> Showcase</h3>
            <div class="showcase-grid">
              ${showcaseItems.map(item => `
                <div class="showcase-item">
                  <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                  <div class="item-overlay">
                    <span class="item-artist">${Utils.escapeHtml(item.subtitle || '')}</span>
                    <span class="item-album">${Utils.escapeHtml(item.title || '')}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <section class="template-section">
          <h3><span class="section-icon">📚</span> Collection (${parseInt(collectionItems.length, 10) || 0})</h3>
          <div class="collection-grid vinyl-grid">
            ${collectionItems.map(item => `
              <div class="collection-item vinyl-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-title">${Utils.escapeHtml(item.title || '')}</span>
                  <span class="item-subtitle">${Utils.escapeHtml(item.subtitle || '')}</span>
                  ${item.year ? `<span class="item-year">${Utils.escapeHtml(String(item.year))}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }
});

// Trading Cards Template
TemplateRegistry.register('trading-cards', {
  name: 'Trading Cards',
  icon: '🃏',

  render(profile, items) {
    return `
      <div class="cards-template">
        <div class="template-header cards-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Card Collector')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'Collecting and trading...')}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">🃏</span> Cards (${parseInt(items.length, 10) || 0})</h3>
          <div class="collection-grid cards-grid">
            ${items.map(item => `
              <div class="collection-item card-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-title">${Utils.escapeHtml(item.title || '')}</span>
                  <span class="item-set">${Utils.escapeHtml(item.subtitle || '')}</span>
                  ${item.condition ? `<span class="item-grade">${Utils.escapeHtml(item.condition)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }
});

// Cars Template
TemplateRegistry.register('cars', {
  name: 'Cars',
  icon: '🚗',

  render(profile, items) {
    return `
      <div class="cars-template">
        <div class="template-header cars-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Car Enthusiast')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'Building and driving...')}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">🚗</span> Garage (${parseInt(items.length, 10) || 0})</h3>
          <div class="collection-grid cars-grid">
            ${items.map(item => `
              <div class="collection-item car-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-title">${Utils.escapeHtml(item.title || '')}</span>
                  <span class="item-subtitle">${Utils.escapeHtml(item.subtitle || '')}</span>
                  ${item.year ? `<span class="item-year">${Utils.escapeHtml(String(item.year))}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }
});

// Sneakers Template
TemplateRegistry.register('sneakers', {
  name: 'Sneakers',
  icon: '👟',

  render(profile, items) {
    return `
      <div class="sneakers-template">
        <div class="template-header sneakers-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Sneakerhead')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'Kicks for days...')}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">👟</span> Shoe Rack (${parseInt(items.length, 10) || 0})</h3>
          <div class="collection-grid sneakers-grid">
            ${items.map(item => `
              <div class="collection-item sneaker-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-title">${Utils.escapeHtml(item.title || '')}</span>
                  <span class="item-colorway">${Utils.escapeHtml(item.subtitle || '')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }
});

// Watches Template
TemplateRegistry.register('watches', {
  name: 'Watches',
  icon: '⌚',

  render(profile, items) {
    return `
      <div class="watches-template">
        <div class="template-header watches-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Watch Collector')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'Time is everything...')}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">⌚</span> Collection (${parseInt(items.length, 10) || 0})</h3>
          <div class="collection-grid watches-grid">
            ${items.map(item => `
              <div class="collection-item watch-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-brand">${Utils.escapeHtml(item.subtitle || '')}</span>
                  <span class="item-model">${Utils.escapeHtml(item.title || '')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }
});

// Comics Template
TemplateRegistry.register('comics', {
  name: 'Comics',
  icon: '📚',

  render(profile, items) {
    return `
      <div class="comics-template">
        <div class="template-header comics-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Comic Collector')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'Reading and collecting...')}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">📚</span> Long Boxes (${parseInt(items.length, 10) || 0})</h3>
          <div class="collection-grid comics-grid">
            ${items.map(item => `
              <div class="collection-item comic-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-series">${Utils.escapeHtml(item.subtitle || '')}</span>
                  <span class="item-issue">${Utils.escapeHtml(item.title || '')}</span>
                  ${item.condition ? `<span class="item-grade">${Utils.escapeHtml(item.condition)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }
});

// Video Games Template
TemplateRegistry.register('video-games', {
  name: 'Video Games',
  icon: '🎮',

  render(profile, items) {
    return `
      <div class="games-template">
        <div class="template-header games-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Game Collector')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'Player One...')}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">🎮</span> Library (${parseInt(items.length, 10) || 0})</h3>
          <div class="collection-grid games-grid">
            ${items.map(item => `
              <div class="collection-item game-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-title">${Utils.escapeHtml(item.title || '')}</span>
                  <span class="item-platform">${Utils.escapeHtml(item.subtitle || '')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }
});

// Coins Template
TemplateRegistry.register('coins', {
  name: 'Coins',
  icon: '🪙',

  render(profile, items) {
    return `
      <div class="coins-template">
        <div class="template-header coins-header">
          <div class="template-bg" style="background-image: url('${Utils.sanitizeImageUrl(profile.background_image, '')}')"></div>
          <img class="template-avatar" src="${Utils.sanitizeImageUrl(profile.avatar, '')}" alt="">
          <div class="template-info">
            <h2>${Utils.escapeHtml(profile.display_name || 'Numismatist')}</h2>
            <p class="template-bio">${Utils.escapeHtml(profile.bio || 'Collecting history...')}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">🪙</span> Collection (${parseInt(items.length, 10) || 0})</h3>
          <div class="collection-grid coins-grid">
            ${items.map(item => `
              <div class="collection-item coin-item">
                <img src="${Utils.sanitizeImageUrl(item.cover_image, '')}" alt="${Utils.escapeHtml(item.title || '')}">
                <div class="item-info">
                  <span class="item-title">${Utils.escapeHtml(item.title || '')}</span>
                  <span class="item-year">${Utils.escapeHtml(String(item.year || ''))}</span>
                  ${item.condition ? `<span class="item-grade">${Utils.escapeHtml(item.condition)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }
});

// Export for use
window.TemplateRegistry = TemplateRegistry;
