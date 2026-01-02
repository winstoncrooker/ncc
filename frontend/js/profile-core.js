/**
 * Profile Core Module
 * Core profile state, initialization, and shared utilities
 */

const ProfileCore = {
  // ============================================
  // SHARED STATE
  // ============================================
  profile: null,
  collection: [],
  showcase: [],
  chatHistory: [],
  friends: [],
  friendRequests: [],
  pendingRequestCount: 0,
  conversations: [],
  currentConversation: null,
  currentConversationMessages: [],
  unreadCount: 0,
  pollingInterval: null,
  searchedFriend: null,
  wishlist: [],

  // Category profile state
  userCategories: [],
  currentCategorySlug: null,
  currentCategoryProfile: null,
  collectionStats: null,

  // Cropper state
  cropper: null,
  cropperType: null,

  // View profile state
  viewedProfile: null,
  viewedProfileCollection: null,
  editingImageAlbumId: null,

  // Friend profile state
  friendProfileState: {
    userId: null,
    profile: null,
    categories: [],
    currentCategoryId: null,
    showcase: [],
    collection: [],
    wishlist: []
  },

  // ============================================
  // CATEGORY TERMINOLOGY
  // ============================================
  categoryTerms: {
    'vinyl': {
      itemSingular: 'record',
      itemPlural: 'records',
      field1Label: 'Artist',
      field1Placeholder: 'Artist name',
      field2Label: 'Album',
      field2Placeholder: 'Album title',
      addTitle: 'Add Record',
      emptyIcon: '💿',
      showcaseEmpty: 'No albums in your showcase yet',
      showcaseHint: 'Add up to 8 albums from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add albums or search Discogs',
      aiCapabilities: [
        'Writing your bio',
        'Adding records to your collection',
        'Finding albums on Discogs',
        'Choosing what to showcase'
      ]
    },
    'trading-cards': {
      itemSingular: 'card',
      itemPlural: 'cards',
      field1Label: 'Set/Brand',
      field1Placeholder: 'e.g. Pokemon Base Set',
      field2Label: 'Card Name',
      field2Placeholder: 'Card name',
      addTitle: 'Add Card',
      emptyIcon: '🃏',
      showcaseEmpty: 'No cards in your showcase yet',
      showcaseHint: 'Add up to 8 cards from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add cards or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding cards to your collection',
        'Tracking card values and grades',
        'Building deck lists'
      ]
    },
    'cars': {
      itemSingular: 'vehicle',
      itemPlural: 'vehicles',
      field1Label: 'Make',
      field1Placeholder: 'e.g. Ford, Toyota',
      field2Label: 'Model',
      field2Placeholder: 'e.g. Mustang, Supra',
      addTitle: 'Add Vehicle',
      emptyIcon: '🚗',
      showcaseEmpty: 'No vehicles in your showcase yet',
      showcaseHint: 'Add up to 8 vehicles from your collection to feature here',
      collectionEmpty: 'Your garage is empty',
      collectionHint: 'Use the AI assistant to add vehicles or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding vehicles to your garage',
        'Tracking mods and builds',
        'Choosing what to showcase'
      ]
    },
    'sneakers': {
      itemSingular: 'pair',
      itemPlural: 'pairs',
      field1Label: 'Brand',
      field1Placeholder: 'e.g. Nike, Adidas',
      field2Label: 'Model/Colorway',
      field2Placeholder: 'e.g. Air Jordan 1 Chicago',
      addTitle: 'Add Sneakers',
      emptyIcon: '👟',
      showcaseEmpty: 'No sneakers in your showcase yet',
      showcaseHint: 'Add up to 8 pairs from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add sneakers or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding kicks to your collection',
        'Tracking release dates and drops',
        'Choosing grails to showcase'
      ]
    },
    'watches': {
      itemSingular: 'watch',
      itemPlural: 'watches',
      field1Label: 'Brand',
      field1Placeholder: 'e.g. Rolex, Omega',
      field2Label: 'Model',
      field2Placeholder: 'e.g. Submariner, Speedmaster',
      addTitle: 'Add Watch',
      emptyIcon: '⌚',
      showcaseEmpty: 'No watches in your showcase yet',
      showcaseHint: 'Add up to 8 watches from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add watches or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding watches to your collection',
        'Learning about movements and complications',
        'Choosing timepieces to showcase'
      ]
    },
    'comics': {
      itemSingular: 'comic',
      itemPlural: 'comics',
      field1Label: 'Publisher/Series',
      field1Placeholder: 'e.g. Marvel, Amazing Spider-Man',
      field2Label: 'Issue/Title',
      field2Placeholder: 'e.g. #300, First Appearance',
      addTitle: 'Add Comic',
      emptyIcon: '📚',
      showcaseEmpty: 'No comics in your showcase yet',
      showcaseHint: 'Add up to 8 comics from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add comics or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding comics to your long boxes',
        'Finding key issues and first appearances',
        'Choosing slabs to showcase'
      ]
    },
    'video-games': {
      itemSingular: 'game',
      itemPlural: 'games',
      field1Label: 'Platform',
      field1Placeholder: 'e.g. PS5, Nintendo Switch',
      field2Label: 'Title',
      field2Placeholder: 'Game title',
      addTitle: 'Add Game',
      emptyIcon: '🎮',
      showcaseEmpty: 'No games in your showcase yet',
      showcaseHint: 'Add up to 8 games from your collection to feature here',
      collectionEmpty: 'Your library is empty',
      collectionHint: 'Use the AI assistant to add games or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding games to your library',
        'Managing your backlog',
        'Choosing favorites to showcase'
      ]
    },
    'coins': {
      itemSingular: 'coin',
      itemPlural: 'coins',
      field1Label: 'Country/Type',
      field1Placeholder: 'e.g. USA, Morgan Dollar',
      field2Label: 'Year/Denomination',
      field2Placeholder: 'e.g. 1921, $1',
      addTitle: 'Add Coin',
      emptyIcon: '🪙',
      showcaseEmpty: 'No coins in your showcase yet',
      showcaseHint: 'Add up to 8 coins from your collection to feature here',
      collectionEmpty: 'Your collection is empty',
      collectionHint: 'Use the AI assistant to add coins or enter manually',
      aiCapabilities: [
        'Writing your bio',
        'Adding coins to your collection',
        'Learning about mint marks and varieties',
        'Choosing pieces to showcase'
      ]
    }
  },

  // Social link platform configurations
  socialPlatforms: {
    instagram: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>', label: 'Instagram', urlPrefix: 'https://instagram.com/', placeholder: '@username' },
    tiktok: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>', label: 'TikTok', urlPrefix: 'https://tiktok.com/@', placeholder: '@username' },
    twitter: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>', label: 'Twitter/X', urlPrefix: 'https://twitter.com/', placeholder: '@username' },
    youtube: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>', label: 'YouTube', urlPrefix: '', placeholder: 'Channel URL' },
    facebook: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>', label: 'Facebook', urlPrefix: 'https://facebook.com/', placeholder: 'Profile URL or username' },
    threads: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.33-3.022.88-.73 2.082-1.147 3.478-1.208l.186-.005c1.033 0 1.942.189 2.694.562.314-.77.48-1.656.48-2.645 0-.443-.038-.874-.114-1.29l2.024-.353c.102.562.154 1.137.154 1.716 0 1.285-.233 2.46-.682 3.471.67.586 1.18 1.301 1.49 2.138.63 1.705.528 4.322-1.637 6.442-1.87 1.826-4.155 2.62-7.384 2.644zm-.016-8.71c-1.424.058-2.317.545-2.317 1.384 0 .603.522 1.236 1.782 1.288 1.363-.006 2.287-.593 2.748-1.747a6.557 6.557 0 0 0-.645-.084 6.523 6.523 0 0 0-.546-.029c-.337 0-.683.063-1.022.188z"/></svg>', label: 'Threads', urlPrefix: 'https://threads.net/@', placeholder: '@username' },
    bluesky: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.296 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>', label: 'Bluesky', urlPrefix: 'https://bsky.app/profile/', placeholder: 'handle.bsky.social' },
    mastodon: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.668 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"/></svg>', label: 'Mastodon', urlPrefix: '', placeholder: '@user@instance.social' },
    twitch: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>', label: 'Twitch', urlPrefix: 'https://twitch.tv/', placeholder: 'username', isUsername: true },
    discord: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>', label: 'Discord', urlPrefix: '', placeholder: 'username', isUsername: true },
    spotify: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>', label: 'Spotify', urlPrefix: '', placeholder: 'Profile or playlist URL' },
    soundcloud: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.048-.1-.098-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094s.089-.037.099-.094l.21-1.308-.21-1.319c-.01-.057-.044-.094-.09-.094m1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.104.106.104.061 0 .12-.044.12-.104l.24-2.474-.24-2.547c0-.06-.06-.104-.12-.104m.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.627c-.015-.09-.074-.15-.15-.15l-.016.002m.93-.585c-.089 0-.165.075-.179.164l-.18 3.209.18 2.494c.015.09.09.164.18.164.089 0 .164-.074.164-.164l.21-2.494-.21-3.21c-.014-.089-.075-.163-.164-.163m.97-.705c-.105 0-.195.09-.21.195l-.165 3.884.18 2.43c.014.104.09.195.21.195.104 0 .194-.09.21-.195l.195-2.43-.195-3.885c-.016-.104-.106-.194-.211-.194m1.065-.584c-.12 0-.225.105-.225.225l-.15 4.439.165 2.369c.015.12.105.225.225.225.119 0 .225-.105.224-.225l.18-2.37-.18-4.439c-.015-.12-.105-.225-.224-.225m.96-.089c-.135 0-.255.12-.27.254l-.12 4.498.136 2.328c.015.135.12.255.255.255.135 0 .254-.12.27-.255l.154-2.328-.154-4.499c-.015-.135-.12-.254-.255-.254l-.016.001m2.04-.209c-.015-.165-.135-.3-.315-.3-.165 0-.3.135-.315.3l-.105 4.678.12 2.28c.015.164.135.3.3.3.164 0 .3-.135.3-.3l.135-2.28-.12-4.678m.916.195c-.164 0-.314.15-.329.315l-.106 4.455.121 2.205c.015.165.15.315.315.315.164 0 .314-.15.314-.315l.135-2.205-.12-4.455c-.015-.18-.15-.315-.314-.315l-.016.001m.96-.104c-.18 0-.33.15-.33.33l-.105 4.529.105 2.145c.016.18.166.33.33.33.18 0 .33-.15.33-.33l.121-2.145-.121-4.529c0-.18-.15-.33-.33-.33m1.05-.119c-.195 0-.36.164-.375.359l-.09 4.619.105 2.085c.015.195.165.36.36.36.195 0 .36-.165.36-.36l.12-2.085-.12-4.619c-.015-.195-.165-.359-.36-.359m.989-.119c-.21 0-.375.18-.39.39l-.09 4.694.09 2.025c.015.211.18.39.39.39.21 0 .375-.18.375-.39l.105-2.025-.105-4.694c0-.21-.165-.39-.375-.39m1.051.029c-.225 0-.405.18-.42.405l-.075 4.65.09 1.98c.015.225.195.405.405.405.225 0 .405-.18.405-.405l.105-1.98-.12-4.65c-.014-.24-.18-.405-.39-.405m1.021.24c0-.225-.194-.42-.435-.42-.24 0-.42.195-.42.42l-.075 4.38.09 1.935c0 .225.194.42.42.42.225 0 .42-.195.435-.42l.105-1.935-.12-4.38m.93-.181c-.255 0-.465.21-.465.465l-.06 4.065.075 1.905c.015.24.21.45.45.45.255 0 .465-.21.465-.45l.075-1.905-.075-4.065c0-.255-.21-.465-.465-.465m7.064 4.5c-.645 0-1.246.18-1.77.494-.33-3.75-3.42-6.69-7.215-6.69-.929 0-1.816.195-2.64.525-.316.13-.404.26-.404.51v13.095c0 .27.194.49.45.525.016 0 11.58 0 11.58 0 2.16 0 3.93-1.77 3.93-3.93-.015-2.175-1.77-3.93-3.93-3.93v.001z"/></svg>', label: 'SoundCloud', urlPrefix: 'https://soundcloud.com/', placeholder: 'username' },
    bandcamp: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/></svg>', label: 'Bandcamp', urlPrefix: '', placeholder: 'Profile URL' },
    linkedin: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>', label: 'LinkedIn', urlPrefix: 'https://linkedin.com/in/', placeholder: 'profile-name' },
    pinterest: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>', label: 'Pinterest', urlPrefix: 'https://pinterest.com/', placeholder: 'username' },
    reddit: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>', label: 'Reddit', urlPrefix: 'https://reddit.com/user/', placeholder: 'u/username' },
    website: { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.5 2.05c1.05.04 2.05.26 2.98.62-.46.55-1 1.08-1.62 1.56-.5-.56-.99-1.08-1.36-1.5v-.68zm-2 .32c-.36.46-.77 1.04-1.18 1.72-.58-.22-1.12-.47-1.62-.75.81-.49 1.78-.84 2.8-.97zm-4.54 1.77c.59.34 1.24.64 1.94.9-.27.63-.5 1.31-.69 2.01H3.22c.42-1.13 1.06-2.15 1.87-3l-.13.09zm-1.74 4.91h3.26c-.16 1.16-.25 2.4-.25 3.7 0 .65.03 1.29.08 1.9H3.09c-.24-.81-.38-1.67-.38-2.55 0-.72.11-1.42.31-2.1l.2-.95zm.53 7.6h2.94c.22 1.31.56 2.47 1 3.43-.6.17-1.16.38-1.68.61A9.922 9.922 0 0 1 3.75 16.65zm4.72 4.95c-.72-.11-1.41-.31-2.05-.58.34-.2.69-.38 1.06-.53.29.41.62.79.99 1.11zm.53-5.91v-.04H12v5.23c-.68-.49-1.32-1.21-1.89-2.12-.4-.68-.72-1.46-.96-2.28-.03-.27-.07-.53-.07-.79h-.08zm3.58 5.23V15.7h3.07c-.15.59-.35 1.14-.57 1.65-.62 1.4-1.43 2.44-2.5 3.37v.2zm4.25-1.11c.64-.75 1.17-1.6 1.56-2.54.12-.28.23-.56.32-.84h1.9a9.94 9.94 0 0 1-3.78 3.38zm2.34-5.31h-2.32c.09-.83.15-1.71.15-2.65s-.06-1.84-.15-2.7h3.05c.23.84.38 1.72.38 2.65 0 .93-.12 1.83-.35 2.7h-.76zm.95-7.4h-2.52c-.19-.77-.43-1.5-.72-2.17.67-.22 1.29-.5 1.88-.82a9.96 9.96 0 0 1 1.36 2.99zm-3.73-4.1c.43.26.83.55 1.21.87-.42.22-.88.42-1.36.6a8.11 8.11 0 0 0 .15-1.47zm-2.49-.58V5h-.02c-.38-.48-.76-.92-1.11-1.3.35-.1.71-.18 1.08-.24l.05-.01zm.05 1.86h2.33c.22.85.4 1.78.51 2.79h-2.84V7.35zm0 4.79h3.01c.01.53.02 1.05.02 1.56 0 .87-.06 1.71-.16 2.5h-2.87v-4.06zm-2 9.04v-3.18h2.85c-.1.59-.22 1.14-.38 1.65-.36.74-.82 1.32-1.39 1.73-.36.09-.72.13-1.08.13v-.33zm0-5.14V12.1h-3.06c-.07-.82-.11-1.65-.11-2.5 0-.87.06-1.71.15-2.5H12v4.9zm0-6.89V5.58c.49.39 1.01.93 1.54 1.63H12zm-2 0H9.45c.28-.34.58-.67.91-.98.23-.22.47-.43.72-.63.06-.02.12-.02.17-.02.29.19.58.4.83.65V9.08l-.08.07zm0 1.99v4.02h-3.2c-.12-.93-.18-1.9-.18-2.93 0-.37.01-.73.03-1.09H10v.01-.01z"/></svg>', label: 'Website', urlPrefix: '', placeholder: 'https://...' }
  },

  // Category-specific form field configurations
  categoryFormConfig: {
    'vinyl': {
      field1Label: 'Artist *', field1Placeholder: 'Artist name',
      field2Label: 'Album *', field2Placeholder: 'Album title',
      field3Label: 'Year', field3Placeholder: 'Release year'
    },
    'coins': {
      field1Label: 'Country/Type *', field1Placeholder: 'e.g. USA, Ancient Rome',
      field2Label: 'Coin *', field2Placeholder: 'e.g. Morgan Dollar, Denarius',
      field3Label: 'Year', field3Placeholder: 'e.g. 1921'
    },
    'trading-cards': {
      field1Label: 'Set/Game *', field1Placeholder: 'e.g. Pokemon Base Set, MTG Alpha',
      field2Label: 'Card Name *', field2Placeholder: 'e.g. Charizard, Black Lotus',
      field3Label: 'Card #', field3Placeholder: 'e.g. 4/102'
    },
    'sneakers': {
      field1Label: 'Brand *', field1Placeholder: 'e.g. Nike, Adidas',
      field2Label: 'Model/Colorway *', field2Placeholder: 'e.g. Air Jordan 1 Chicago',
      field3Label: 'Size', field3Placeholder: 'e.g. 10.5'
    },
    'watches': {
      field1Label: 'Brand *', field1Placeholder: 'e.g. Rolex, Omega',
      field2Label: 'Model *', field2Placeholder: 'e.g. Submariner, Speedmaster',
      field3Label: 'Reference', field3Placeholder: 'e.g. 116610LN'
    },
    'comics': {
      field1Label: 'Series *', field1Placeholder: 'e.g. Amazing Spider-Man',
      field2Label: 'Title/Issue *', field2Placeholder: 'e.g. #300 - Venom',
      field3Label: 'Issue #', field3Placeholder: 'e.g. 300'
    },
    'video-games': {
      field1Label: 'Platform *', field1Placeholder: 'e.g. PS5, Switch, N64',
      field2Label: 'Title *', field2Placeholder: 'e.g. The Legend of Zelda',
      field3Label: 'Region', field3Placeholder: 'e.g. NTSC, PAL'
    },
    'cars': {
      field1Label: 'Make *', field1Placeholder: 'e.g. Ford, Toyota',
      field2Label: 'Model *', field2Placeholder: 'e.g. Mustang GT, Supra',
      field3Label: 'Year', field3Placeholder: 'e.g. 1969'
    }
  },

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get terminology for current category
   */
  getTerms() {
    const slug = this.currentCategorySlug || 'vinyl';
    return this.categoryTerms[slug] || this.categoryTerms['vinyl'];
  },

  /**
   * Get current category ID from slug
   */
  getCurrentCategoryId() {
    if (!this.currentCategorySlug || !this.userCategories.length) return null;
    const category = this.userCategories.find(c => c.slug === this.currentCategorySlug);
    return category ? category.id : null;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Sanitize URL to prevent javascript: and other dangerous protocols
   */
  sanitizeUrl(url) {
    if (!url) return '#';
    const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];
    try {
      const parsed = new URL(url);
      if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        return this.escapeHtml(url);
      }
      return '#';
    } catch {
      if (url.includes(':') && !url.startsWith('http')) {
        return '#';
      }
      return this.escapeHtml(url);
    }
  },

  /**
   * Get placeholder cover image
   */
  getPlaceholderCover(album) {
    const initial = (album.artist || 'A')[0].toUpperCase();
    return `data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%231a1a1a%27 width=%27100%27 height=%27100%27/%3E%3Ctext x=%2750%27 y=%2760%27 font-size=%2740%27 text-anchor=%27middle%27 fill=%27%231db954%27%3E${encodeURIComponent(initial)}%3C/text%3E%3C/svg%3E`;
  },

  /**
   * Get default avatar for user
   */
  getDefaultAvatar(name) {
    const initial = (name || 'A')[0].toUpperCase();
    return `data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%231a1a1a%27 width=%27100%27 height=%27100%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2745%27 text-anchor=%27middle%27 fill=%27%231db954%27%3E${encodeURIComponent(initial)}%3C/text%3E%3C/svg%3E`;
  },

  /**
   * Format time for display
   */
  formatTime(timestamp) {
    let ts = timestamp;
    if (ts && !ts.endsWith('Z') && !ts.includes('+') && !ts.includes('-', 10)) {
      ts = ts.replace(' ', 'T') + 'Z';
    }
    const date = new Date(ts);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  },

  /**
   * Darken a hex color by a percentage
   */
  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  },

  /**
   * Open modal with proper accessibility
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  /**
   * Close modal with proper accessibility
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  /**
   * Render item tags as badges
   */
  renderItemTags(tagsStr) {
    if (!tagsStr) return '';

    const tagConfig = {
      'for_trade': { label: 'For Trade', class: 'tag-trade' },
      'grail': { label: 'Grail', class: 'tag-grail' },
      'sealed': { label: 'Sealed', class: 'tag-sealed' },
      'signed': { label: 'Signed', class: 'tag-signed' },
      'first_press': { label: '1st Press', class: 'tag-first' },
      'rare': { label: 'Rare', class: 'tag-rare' }
    };

    const validTagKeys = Object.keys(tagConfig);
    const tags = tagsStr.split(',')
      .map(t => t.trim())
      .filter(t => t && validTagKeys.includes(t));

    if (tags.length === 0) return '';

    return `<div class="item-tags">${tags.map(tag => {
      const config = tagConfig[tag];
      return `<span class="item-tag ${config.class}">${config.label}</span>`;
    }).join('')}</div>`;
  }
};

// Export for use
if (typeof window !== 'undefined') window.ProfileCore = ProfileCore;
