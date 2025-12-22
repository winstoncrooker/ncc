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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Collector'}</h2>
            <p class="template-bio">${profile.bio || 'No bio yet'}</p>
          </div>
        </div>
        <div class="template-stats">
          <div class="stat">
            <span class="stat-value">${profile.item_count || 0}</span>
            <span class="stat-label">Items</span>
          </div>
        </div>
        <div class="template-collection">
          <h3>Collection</h3>
          <div class="collection-grid">
            ${items.map(item => `
              <div class="collection-item">
                <img src="${item.cover_image || ''}" alt="">
                <div class="item-info">
                  <span class="item-title">${item.title}</span>
                  <span class="item-subtitle">${item.subtitle || ''}</span>
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
    const sectionMap = {
      'vinyl': ['Showcase', 'Collection', 'Turntable Setup', 'Genre Breakdown'],
      'trading-cards': ['Featured Cards', 'Deck Lists', 'Binder', 'Trade List'],
      'cars': ['Garage', 'Build Specs', 'Mod History', 'Meets'],
      'sneakers': ['Shoe Rack', 'Grails', 'Size Info', 'For Trade'],
      'watches': ['Collection', 'SOTC', 'Wrist Check', 'Wishlist'],
      'comics': ['Featured Issues', 'Long Boxes', 'Reading List', 'Pull List'],
      'video-games': ['Library', 'Now Playing', 'Backlog', 'Wishlist'],
      'coins': ['Collection', 'By Era', 'Graded Coins', 'Want List']
    };
    return sectionMap[categorySlug] || ['Collection'];
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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Vinyl Collector'}</h2>
            <p class="template-bio">${profile.bio || 'Spinning wax since...'}</p>
          </div>
        </div>

        ${showcaseItems.length > 0 ? `
          <section class="template-section">
            <h3><span class="section-icon">✨</span> Showcase</h3>
            <div class="showcase-grid">
              ${showcaseItems.map(item => `
                <div class="showcase-item">
                  <img src="${item.cover_image || ''}" alt="${item.title}">
                  <div class="item-overlay">
                    <span class="item-artist">${item.subtitle || ''}</span>
                    <span class="item-album">${item.title}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <section class="template-section">
          <h3><span class="section-icon">📚</span> Collection (${collectionItems.length})</h3>
          <div class="collection-grid vinyl-grid">
            ${collectionItems.map(item => `
              <div class="collection-item vinyl-item">
                <img src="${item.cover_image || ''}" alt="${item.title}">
                <div class="item-info">
                  <span class="item-title">${item.title}</span>
                  <span class="item-subtitle">${item.subtitle || ''}</span>
                  ${item.year ? `<span class="item-year">${item.year}</span>` : ''}
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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Card Collector'}</h2>
            <p class="template-bio">${profile.bio || 'Collecting and trading...'}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">🃏</span> Cards (${items.length})</h3>
          <div class="collection-grid cards-grid">
            ${items.map(item => `
              <div class="collection-item card-item">
                <img src="${item.cover_image || ''}" alt="${item.title}">
                <div class="item-info">
                  <span class="item-title">${item.title}</span>
                  <span class="item-set">${item.subtitle || ''}</span>
                  ${item.condition ? `<span class="item-grade">${item.condition}</span>` : ''}
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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Car Enthusiast'}</h2>
            <p class="template-bio">${profile.bio || 'Building and driving...'}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">🚗</span> Garage (${items.length})</h3>
          <div class="collection-grid cars-grid">
            ${items.map(item => `
              <div class="collection-item car-item">
                <img src="${item.cover_image || ''}" alt="${item.title}">
                <div class="item-info">
                  <span class="item-title">${item.title}</span>
                  <span class="item-subtitle">${item.subtitle || ''}</span>
                  ${item.year ? `<span class="item-year">${item.year}</span>` : ''}
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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Sneakerhead'}</h2>
            <p class="template-bio">${profile.bio || 'Kicks for days...'}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">👟</span> Shoe Rack (${items.length})</h3>
          <div class="collection-grid sneakers-grid">
            ${items.map(item => `
              <div class="collection-item sneaker-item">
                <img src="${item.cover_image || ''}" alt="${item.title}">
                <div class="item-info">
                  <span class="item-title">${item.title}</span>
                  <span class="item-colorway">${item.subtitle || ''}</span>
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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Watch Collector'}</h2>
            <p class="template-bio">${profile.bio || 'Time is everything...'}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">⌚</span> Collection (${items.length})</h3>
          <div class="collection-grid watches-grid">
            ${items.map(item => `
              <div class="collection-item watch-item">
                <img src="${item.cover_image || ''}" alt="${item.title}">
                <div class="item-info">
                  <span class="item-brand">${item.subtitle || ''}</span>
                  <span class="item-model">${item.title}</span>
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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Comic Collector'}</h2>
            <p class="template-bio">${profile.bio || 'Reading and collecting...'}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">📚</span> Long Boxes (${items.length})</h3>
          <div class="collection-grid comics-grid">
            ${items.map(item => `
              <div class="collection-item comic-item">
                <img src="${item.cover_image || ''}" alt="${item.title}">
                <div class="item-info">
                  <span class="item-series">${item.subtitle || ''}</span>
                  <span class="item-issue">${item.title}</span>
                  ${item.condition ? `<span class="item-grade">${item.condition}</span>` : ''}
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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Game Collector'}</h2>
            <p class="template-bio">${profile.bio || 'Player One...'}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">🎮</span> Library (${items.length})</h3>
          <div class="collection-grid games-grid">
            ${items.map(item => `
              <div class="collection-item game-item">
                <img src="${item.cover_image || ''}" alt="${item.title}">
                <div class="item-info">
                  <span class="item-title">${item.title}</span>
                  <span class="item-platform">${item.subtitle || ''}</span>
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
          <div class="template-bg" style="background-image: url('${profile.background_image || ''}')"></div>
          <img class="template-avatar" src="${profile.avatar || ''}" alt="">
          <div class="template-info">
            <h2>${profile.display_name || 'Numismatist'}</h2>
            <p class="template-bio">${profile.bio || 'Collecting history...'}</p>
          </div>
        </div>

        <section class="template-section">
          <h3><span class="section-icon">🪙</span> Collection (${items.length})</h3>
          <div class="collection-grid coins-grid">
            ${items.map(item => `
              <div class="collection-item coin-item">
                <img src="${item.cover_image || ''}" alt="${item.title}">
                <div class="item-info">
                  <span class="item-title">${item.title}</span>
                  <span class="item-year">${item.year || ''}</span>
                  ${item.condition ? `<span class="item-grade">${item.condition}</span>` : ''}
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
