-- Migration 0009: Seed Categories and Interest Groups
-- Seeds the 8 main collecting categories with sub-groups

-- Insert main categories
INSERT INTO categories (slug, name, description, icon, color, item_noun_singular, item_noun_plural, ai_system_prompt) VALUES
('vinyl', 'Vinyl Records', 'For vinyl collectors and audiophiles', '🎵', '#1db954', 'record', 'records',
'You are a vinyl record collection assistant. Help users manage their record collection.
ACTIONS: {ADD:Artist|Album}, {REMOVE:Artist|Album}, {SHOWCASE:Artist|Album}
EXPERTISE: Grading (VG/NM/M), pressings, genres, Discogs integration.'),

('trading-cards', 'Trading Cards', 'Pokemon, MTG, Yu-Gi-Oh, Sports cards and more', '🃏', '#ff6b35', 'card', 'cards',
'You are a trading card expert. Help users manage their card collections and decks.
ACTIONS: {ADD:Set|Card Name}, {REMOVE:Set|Card Name}, {SHOWCASE:Set|Card Name}
EXPERTISE: Pokemon, MTG, Yu-Gi-Oh, Sports cards, grading (PSA/BGS), meta analysis.'),

('cars', 'Cars', 'Classic cars, JDM, muscle cars, and automotive builds', '🚗', '#e63946', 'vehicle', 'vehicles',
'You are an automotive enthusiast assistant. Help users document their garage and builds.
ACTIONS: {ADD:Year|Make|Model}, {REMOVE:Year|Make|Model}, {SHOWCASE:Year|Make|Model}
EXPERTISE: Classics, JDM, muscle cars, builds, mods, valuations.'),

('sneakers', 'Sneakers', 'Sneaker culture, Jordans, Nike, Adidas, and more', '👟', '#7b2cbf', 'pair', 'pairs',
'You are a sneaker culture expert. Help users manage their sneaker collection.
ACTIONS: {ADD:Brand|Model|Colorway}, {REMOVE:Brand|Model}, {SHOWCASE:Brand|Model}
EXPERTISE: Jordans, Nike, Adidas, resale market, authentication.'),

('watches', 'Watches', 'Horology, luxury watches, vintage timepieces', '⌚', '#2a9d8f', 'watch', 'watches',
'You are a horology expert. Help users manage their watch collection.
ACTIONS: {ADD:Brand|Model|Reference}, {REMOVE:Brand|Model}, {SHOWCASE:Brand|Model}
EXPERTISE: Luxury, vintage, movements, complications, market values.'),

('comics', 'Comics', 'Comic books, graphic novels, manga', '📚', '#f77f00', 'issue', 'issues',
'You are a comic book expert. Help users manage their comic collection.
ACTIONS: {ADD:Publisher|Series|Issue}, {REMOVE:Publisher|Series|Issue}, {SHOWCASE:Publisher|Series|Issue}
EXPERTISE: Marvel, DC, indie, grading (CGC), key issues, first appearances.'),

('video-games', 'Video Games', 'Retro gaming, modern collecting, CIB and sealed games', '🎮', '#4361ee', 'game', 'games',
'You are a video game collector assistant. Help users manage their game library.
ACTIONS: {ADD:Platform|Title}, {REMOVE:Platform|Title}, {SHOWCASE:Platform|Title}
EXPERTISE: Retro, CIB, sealed games, platforms, valuations.'),

('coins', 'Coins', 'Numismatics, coin collecting, bullion', '🪙', '#d4a373', 'coin', 'coins',
'You are a numismatic expert. Help users manage their coin collection.
ACTIONS: {ADD:Country|Denomination|Year}, {REMOVE:Country|Denomination|Year}, {SHOWCASE:Country|Denomination|Year}
EXPERTISE: US coins, world coins, ancient, grading (PCGS/NGC), bullion.');

-- Vinyl sub-groups
INSERT INTO interest_groups (category_id, slug, name, description, level) VALUES
(1, 'rock', 'Rock & Classic Rock', 'Classic rock, hard rock, prog rock', 1),
(1, 'jazz', 'Jazz', 'Jazz, fusion, bebop, smooth jazz', 1),
(1, 'hip-hop', 'Hip-Hop & R&B', 'Hip-hop, R&B, soul, funk', 1),
(1, 'electronic', 'Electronic & Dance', 'EDM, house, techno, ambient', 1),
(1, 'punk', 'Punk & Alternative', 'Punk, post-punk, indie, alternative', 1);

-- Trading Cards sub-groups
INSERT INTO interest_groups (category_id, slug, name, description, level) VALUES
(2, 'pokemon', 'Pokemon TCG', 'Pokemon trading card game collectors', 1),
(2, 'mtg', 'Magic: The Gathering', 'MTG collectors and players', 1),
(2, 'yugioh', 'Yu-Gi-Oh!', 'Yu-Gi-Oh! card collectors', 1),
(2, 'sports', 'Sports Cards', 'Baseball, basketball, football, hockey', 1),
(2, 'one-piece', 'One Piece TCG', 'One Piece trading card game', 1);

-- Cars sub-groups
INSERT INTO interest_groups (category_id, slug, name, description, level) VALUES
(3, 'jdm', 'JDM', 'Japanese domestic market vehicles', 1),
(3, 'muscle', 'Muscle Cars', 'American muscle and pony cars', 1),
(3, 'european', 'European', 'BMW, Mercedes, Porsche, etc.', 1),
(3, 'classics', 'Classics & Antiques', 'Pre-1980 classic automobiles', 1),
(3, 'trucks', 'Trucks & Off-Road', 'Trucks, SUVs, off-road builds', 1);

-- Sneakers sub-groups
INSERT INTO interest_groups (category_id, slug, name, description, level) VALUES
(4, 'jordans', 'Air Jordans', 'All things Jordan Brand', 1),
(4, 'nike-sb', 'Nike SB & Dunks', 'Nike SB, Dunks, skateboarding', 1),
(4, 'yeezy', 'Yeezy', 'Yeezy and Adidas collaborations', 1),
(4, 'new-balance', 'New Balance', 'New Balance collectors', 1),
(4, 'runners', 'Runners', 'Running shoes, ASICS, Saucony', 1);

-- Watches sub-groups
INSERT INTO interest_groups (category_id, slug, name, description, level) VALUES
(5, 'rolex', 'Rolex', 'Rolex collectors and enthusiasts', 1),
(5, 'omega', 'Omega', 'Omega Speedmaster, Seamaster, etc.', 1),
(5, 'seiko', 'Seiko & Grand Seiko', 'Seiko, Grand Seiko, Orient', 1),
(5, 'vintage', 'Vintage Watches', 'Pre-1990 vintage timepieces', 1),
(5, 'affordables', 'Affordable Watches', 'Budget-friendly collecting', 1);

-- Comics sub-groups
INSERT INTO interest_groups (category_id, slug, name, description, level) VALUES
(6, 'marvel', 'Marvel', 'Marvel Comics collectors', 1),
(6, 'dc', 'DC Comics', 'DC Comics collectors', 1),
(6, 'indie', 'Indie & Image', 'Image, Dark Horse, indie publishers', 1),
(6, 'manga', 'Manga', 'Japanese manga collectors', 1),
(6, 'golden-age', 'Golden & Silver Age', 'Pre-1970 vintage comics', 1);

-- Video Games sub-groups
INSERT INTO interest_groups (category_id, slug, name, description, level) VALUES
(7, 'nintendo', 'Nintendo', 'Nintendo consoles and games', 1),
(7, 'playstation', 'PlayStation', 'Sony PlayStation collectors', 1),
(7, 'retro', 'Retro Gaming', 'Pre-2000 gaming', 1),
(7, 'sealed', 'Sealed & Graded', 'WATA/VGA graded games', 1),
(7, 'handhelds', 'Handhelds', 'Game Boy, PSP, Switch, etc.', 1);

-- Coins sub-groups
INSERT INTO interest_groups (category_id, slug, name, description, level) VALUES
(8, 'us-coins', 'US Coins', 'United States coinage', 1),
(8, 'world', 'World Coins', 'International coins', 1),
(8, 'ancient', 'Ancient Coins', 'Greek, Roman, Byzantine', 1),
(8, 'bullion', 'Bullion & Precious Metals', 'Gold, silver, platinum', 1),
(8, 'errors', 'Error Coins', 'Mint errors and varieties', 1);

-- Sample micro-communities (level 2)
-- Vinyl → Rock → Pink Floyd
INSERT INTO interest_groups (category_id, parent_id, slug, name, description, level) VALUES
(1, 1, 'pink-floyd', 'Pink Floyd', 'Pink Floyd collectors', 2),
(1, 1, 'led-zeppelin', 'Led Zeppelin', 'Led Zeppelin collectors', 2),
(1, 1, 'beatles', 'The Beatles', 'Beatles collectors', 2);

-- Trading Cards → Pokemon → Vintage
INSERT INTO interest_groups (category_id, parent_id, slug, name, description, level) VALUES
(2, 6, 'base-set', 'Base Set', 'Original Base Set collectors', 2),
(2, 6, 'japanese', 'Japanese Pokemon', 'Japanese card collectors', 2);

-- Sneakers → Jordans → Jordan 1
INSERT INTO interest_groups (category_id, parent_id, slug, name, description, level) VALUES
(4, 16, 'jordan-1', 'Air Jordan 1', 'Jordan 1 collectors', 2),
(4, 16, 'jordan-4', 'Air Jordan 4', 'Jordan 4 collectors', 2);

-- Watches → Rolex → Submariner
INSERT INTO interest_groups (category_id, parent_id, slug, name, description, level) VALUES
(5, 21, 'submariner', 'Submariner', 'Rolex Submariner collectors', 2),
(5, 21, 'daytona', 'Daytona', 'Rolex Daytona collectors', 2);
