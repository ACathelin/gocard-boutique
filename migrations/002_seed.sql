-- =============================================================================
-- GoCard Boutique — consolidated seed data.
--
-- This reflects the live production state of the catalog as it evolved
-- through the original monorepo's migrations 0128 → 0141. The company
-- slug (`octobre-boutique`) and all UUIDs are preserved so anyone
-- migrating data from that source stays key-compatible.
--
-- Visible brand, category names, product names, and images all reflect
-- the current GoCard rebrand — a private lifestyle membership with a
-- curated collection of VIP experiences.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Company + brand + categories
-- -----------------------------------------------------------------------------
INSERT INTO companies (id, name, display_name) VALUES
  ('f0000000-0000-4000-8000-0000000000b0', 'octobre-boutique', 'GoCard')
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO brands (id, name, description) VALUES
  ('b0000000-0000-4000-8000-0000000000b0',
   'GoCard',
   'A private lifestyle membership. Access to experiences normally reached only through the right connections.')
ON CONFLICT (id) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description;

INSERT INTO categories (id, name, description) VALUES
  ('c0000000-0000-4000-8000-0000000000b0', 'Membership',  'Annual GoCard membership.'),
  ('c0000000-0000-4000-8000-0000000000b1', 'Experiences', 'Motorsport, factory visits, curated weekends.'),
  ('c0000000-0000-4000-8000-0000000000b2', 'Dining',      'Private tables with renowned chefs.'),
  ('c0000000-0000-4000-8000-0000000000b3', 'Travel',      'Personalised journeys for members and small groups.'),
  ('c0000000-0000-4000-8000-0000000000b4', 'Events',      'One-off evenings on the GoCard calendar.')
ON CONFLICT (id) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description;

-- -----------------------------------------------------------------------------
-- Products  (post-0141 final state, 18 active + 1 inactive)
-- -----------------------------------------------------------------------------
INSERT INTO products (id, name, description, brand_id, category_id, sku,
                      price_cents, currency, style, status,
                      availability, booking_note) VALUES

  -- Slot b1 — Membership
  ('a0000000-0000-4000-8000-0000000000b1',
   'GoCard Membership — Annual',
   'Annual access to the GoCard concierge and the right to book every privilege in the collection for twelve months. Priority notice on new dates, discreet cancellation policy, no credit card required to hold a reservation once you are a member.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b0',
   'GOC-MEM-ANN', 50000, 'EUR', 'Membership', 'active',
   'Year-round · 2026 membership year',
   'Instant activation · no notice period'),

  -- Slot b2 — Mille Miglia
  ('a0000000-0000-4000-8000-0000000000b2',
   'Mille Miglia — VIP Weekend',
   'Two days along the Brescia–Rome–Brescia route with a reserved viewpoint over the Iseo passage, a walking paddock pass, and dinner with the crews on the Saturday. Hotel in Brescia, transfers on both days, all meals included.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-MIL', 650000, 'EUR', 'Motorsport', 'active',
   '11 – 14 June 2026 · Brescia ⇄ Roma',
   'Book 60 days in advance · passport required'),

  -- Slot b3 — Palio di Siena
  ('a0000000-0000-4000-8000-0000000000b3',
   'Palio di Siena — Tribune Access',
   'A seat on the Piazza del Campo tribune for the race, with a Tuscan dinner the evening before and two nights in a restored palazzo on the edge of the city.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-PAL', 480000, 'EUR', 'Motorsport', 'active',
   '2 July & 16 August 2026 · Piazza del Campo',
   'Book 45 days in advance · dress code applies'),

  -- Slot b4 — McLaren Factory
  ('a0000000-0000-4000-8000-0000000000b4',
   'McLaren Factory — Private Visit',
   'A half-day behind the glass at the McLaren Technology Centre: Formula 1 assembly, the production car floor, and an engineer-led Q&A. Lunch in the design hall.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-MCL', 220000, 'EUR', 'Motorsport', 'active',
   'One Friday per month · February – November 2026',
   'Book 30 days in advance · no photography inside the assembly hall'),

  -- Slot b5 — GoCard Rally
  ('a0000000-0000-4000-8000-0000000000b5',
   'GoCard Rally — Two-Day Drive',
   'A curated two-day drive through the Alpes Maritimes in a classic or sports car of your choice, with three culinary stops and a closing gala dinner. Ten cars, no more.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-RLY', 340000, 'EUR', 'Motorsport', 'active',
   '14 – 16 May 2026 · Alpes Maritimes',
   'Ten cars only · valid driving licence required · book 60 days ahead'),

  -- Slot b6 — Le Mans Classic
  ('a0000000-0000-4000-8000-0000000000b6',
   'Le Mans Classic — Grid Pass',
   'A grid pass for the Le Mans Classic weekend: paddock access across all six plateaux, a hospitality table with view of the Dunlop bridge, and a guided walk of the museum.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-LEM', 360000, 'EUR', 'Motorsport', 'active',
   '2 – 5 July 2026 · Circuit de la Sarthe',
   'Book 90 days in advance · grid access confirmed by race week'),

  -- Slot b7 — Formula E Monaco
  ('a0000000-0000-4000-8000-0000000000b7',
   'Formula E Monaco — Paddock',
   'Race-day paddock access for the Monaco E-Prix with a team garage tour, an evening on a harbour terrace, and a car in the Sunday feeder parade.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-FEM', 280000, 'EUR', 'Motorsport', 'active',
   '9 May 2026 · Circuit de Monaco',
   'Book 30 days in advance · paddock pass delivered by concierge'),

  -- Slot b8 — Chef's Table
  ('a0000000-0000-4000-8000-0000000000b8',
   'Chef''s Table — Private Four-Course',
   'A private four-course menu for up to six, prepared by a Michelin-listed chef in a single-table kitchen. Wine pairings from a small independent cellar. Evening only.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b2',
   'GOC-DIN-CHT', 120000, 'EUR', 'Dining', 'active',
   'Thursday – Saturday evenings · year-round',
   'Up to 6 guests · book 21 days ahead · dietary notes welcome'),

  -- Slot b9 — Cellar Dinner (Champagne)
  ('a0000000-0000-4000-8000-0000000000b9',
   'Cellar Dinner — Champagne Pairing',
   'A five-course dinner in the cellar of a small Reims maison, with a champagne pairing from the house''s own library. A producer is at the table throughout.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b2',
   'GOC-DIN-CEL', 145000, 'EUR', 'Dining', 'active',
   'Second Saturday of each month · year-round',
   'Eight seats per evening · book 30 days ahead'),

  -- Slot ba — Tuk-Tuk Sri Lanka
  ('a0000000-0000-4000-8000-0000000000ba',
   'Tuk-Tuk Sri Lanka — Seven Days',
   'A chauffeured tuk-tuk route across Sri Lanka over seven days: tea country, the south coast, hand-picked boutique hotels. Private guide, all transfers, return flights not included.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b3',
   'GOC-TRV-SRI', 540000, 'EUR', 'Travel', 'active',
   'Departures every two weeks · November 2026 – March 2027',
   'Book 90 days in advance · return flights not included'),

  -- Slot bb — Arctic Icebergs
  ('a0000000-0000-4000-8000-0000000000bb',
   'Arctic Icebergs — Weekend',
   'A three-day expedition among Greenland''s Disko Bay icebergs from a small chartered sailboat. Two cabins, a resident naturalist, hot meals on board.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b3',
   'GOC-TRV-ARC', 490000, 'EUR', 'Travel', 'active',
   'Weekly departures · June – September 2026',
   'Two cabins per voyage · book 60 days ahead'),

  -- Slot bc — GoCard Gala
  ('a0000000-0000-4000-8000-0000000000bc',
   'GoCard Gala — New Year Evening',
   'A seated dinner for the GoCard circle on New Year''s Eve in a private Parisian hôtel particulier, with live music and a fireworks view over the Seine. Black tie.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b4',
   'GOC-EVT-GAL', 89000, 'EUR', 'Events', 'active',
   '31 December 2026 · Paris',
   'Black tie · seating confirmed in early December'),

  -- Slot bd — Rijksmuseum After-Hours (Van Gogh)
  ('a0000000-0000-4000-8000-0000000000bd',
   'Rijksmuseum After-Hours — Van Gogh & Michelin',
   'An evening alone with Van Gogh at the Rijksmuseum in Amsterdam: a private after-hours tour led by a senior curator, focused on the Dutch masters and the Van Gogh works held in the museum''s collection. The night continues at a three-Michelin-starred restaurant in the city with a tasting menu and wine pairing. Two guests, car service between the museum and the restaurant, one night in a canal-side suite.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-RKM', 780000, 'EUR', 'Culture', 'active',
   'First Monday of each month · April – October 2026',
   'Two guests · book 21 days ahead'),

  -- Slot be — Rijksmuseum Overnight (flagship)
  ('a0000000-0000-4000-8000-0000000000be',
   'Rijksmuseum Overnight — Private Museum Stay',
   'A night alone in the Rijksmuseum. After the last visitor leaves, the galleries are yours — a candle-lit walk with the senior curator through the Gallery of Honour, a private dinner for two laid between the Dutch masters, and a suite installed for the night under the vaults of the Great Hall. Breakfast at first light, before the doors reopen. No other guests. Two people. Once a month, from April through October.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-RKN', 1500000, 'EUR', 'Flagship', 'active',
   'One evening per month · April – October 2026',
   'By request through the concierge · minimum 45 days notice · two guests'),

  -- Slot bf — deactivated legacy streetwear slot
  ('a0000000-0000-4000-8000-0000000000bf',
   'Reserved',
   'Reserved slot.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b4',
   'GOC-RES-BF', 0, 'EUR', 'Reserved', 'inactive',
   NULL, NULL),

  -- Slot c1 — Royal Albert Hall Proms
  ('a0000000-0000-4000-8000-0000000000c1',
   'Royal Albert Hall — Last Night of the Proms',
   'A private box for two at the Last Night of the Proms, the closing ceremony of the BBC''s summer concert season at the Royal Albert Hall. Pre-concert dinner in the members'' restaurant, a dedicated attendant for the box, and a car home to your London hotel. Black tie encouraged, Union Jack optional.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-PROM', 320000, 'EUR', 'Music', 'active',
   '12 September 2026 · London',
   'Book 120 days in advance · black tie · valid passport required'),

  -- Slot c2 — Wimbledon Debenture
  ('a0000000-0000-4000-8000-0000000000c2',
   'Wimbledon — Centre Court Debenture',
   'Two debenture seats on Centre Court for the men''s semi-finals, with access to the debenture holders'' lounge, Pimm''s and strawberries through the day, and a private host for the afternoon. A car between your Mayfair hotel and the All England Club.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-WIM', 450000, 'EUR', 'Sport', 'active',
   '3 July 2026 · SW19 · Men''s Semi-Finals',
   'Book 180 days in advance · smart dress code · seats confirmed in late June'),

  -- Slot c3 — La Scala Opening Night
  ('a0000000-0000-4000-8000-0000000000c3',
   'La Scala Milano — Opening Night Box',
   'A private box at the Teatro alla Scala for the 7 December opening night — the most ceremonial evening in the Italian cultural calendar. Pre-performance champagne in the Ridotto dei Palchi, a seated dinner at a restaurant on Via Manzoni after the final curtain, and a night at a palazzo hotel within walking distance of the theatre.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-SCA', 380000, 'EUR', 'Opera', 'active',
   '7 December 2026 · Milano · Opening Night',
   'Book 180 days in advance · black tie · programme confirmed in September'),

  -- Slot c4 — Monaco GP Yacht
  ('a0000000-0000-4000-8000-0000000000c4',
   'Monaco Grand Prix — Yacht Harbour',
   'Race weekend in Monaco, watched from a 40-metre yacht moored in the Port Hercules. The circuit runs past the swim platform; the pit lane is a short tender ride away. Catering by a Provençal chef, a sommelier from Nice, paddock access on both qualifying and race day. Four guests.',
   'b0000000-0000-4000-8000-0000000000b0',
   'c0000000-0000-4000-8000-0000000000b1',
   'GOC-EXP-MCO', 850000, 'EUR', 'Motorsport', 'active',
   '22 – 24 May 2026 · Port Hercules',
   'Book 150 days in advance · passport required · tender schedule on race day')

ON CONFLICT (id) DO UPDATE
  SET name         = EXCLUDED.name,
      description  = EXCLUDED.description,
      category_id  = EXCLUDED.category_id,
      sku          = EXCLUDED.sku,
      price_cents  = EXCLUDED.price_cents,
      currency     = EXCLUDED.currency,
      style        = EXCLUDED.style,
      status       = EXCLUDED.status,
      availability = EXCLUDED.availability,
      booking_note = EXCLUDED.booking_note;

-- -----------------------------------------------------------------------------
-- Product images  (URLs starting with /boutique/ are shipped in web/public/)
-- -----------------------------------------------------------------------------
INSERT INTO product_images (id, product_id, url, alt_text, is_primary, sort_order) VALUES
  -- b1 Membership
  ('d0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-0000000000b1',
   'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=900&h=1200&fit=crop',
   'GoCard annual membership card', true, 1),
  -- b2 Mille Miglia
  ('d0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b2',
   'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=1200&fit=crop',
   'Classic racing car on an Italian road', true, 1),
  -- b3 Palio di Siena
  ('d0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-0000000000b3',
   '/boutique/palio-siena.jpg',
   'Italian Renaissance architecture', true, 1),
  -- b4 McLaren Factory
  ('d0000000-0000-4000-8000-0000000000b4', 'a0000000-0000-4000-8000-0000000000b4',
   '/boutique/mclaren-factory.jpg',
   'McLaren Technology Centre assembly hall', true, 1),
  -- b5 GoCard Rally
  ('d0000000-0000-4000-8000-0000000000b5', 'a0000000-0000-4000-8000-0000000000b5',
   'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=900&h=1200&fit=crop',
   'Sports car convoy on an alpine road', true, 1),
  -- b6 Le Mans Classic
  ('d0000000-0000-4000-8000-0000000000b6', 'a0000000-0000-4000-8000-0000000000b6',
   'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=900&h=1200&fit=crop',
   'Classic endurance race grid', true, 1),
  -- b7 Formula E Monaco
  ('d0000000-0000-4000-8000-0000000000b7', 'a0000000-0000-4000-8000-0000000000b7',
   '/boutique/formula-e-monaco.jpg',
   'Formula E car on a waterfront street circuit', true, 1),
  -- b8 Chef's Table
  ('d0000000-0000-4000-8000-0000000000b8', 'a0000000-0000-4000-8000-0000000000b8',
   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&h=1200&fit=crop',
   'Private dining table with candles', true, 1),
  -- b9 Cellar Dinner
  ('d0000000-0000-4000-8000-0000000000b9', 'a0000000-0000-4000-8000-0000000000b9',
   '/boutique/cellar-champagne.jpg',
   'Champagne being poured into a tulip glass', true, 1),
  -- ba Sri Lanka
  ('d0000000-0000-4000-8000-0000000000ba', 'a0000000-0000-4000-8000-0000000000ba',
   '/boutique/sri-lanka.jpg',
   'Tropical Sri Lankan beach with palms and turquoise water', true, 1),
  -- bb Arctic Icebergs
  ('d0000000-0000-4000-8000-0000000000bb', 'a0000000-0000-4000-8000-0000000000bb',
   '/boutique/arctic-icebergs.jpg',
   'Aurora borealis over a boreal forest', true, 1),
  -- bc GoCard Gala
  ('d0000000-0000-4000-8000-0000000000bc', 'a0000000-0000-4000-8000-0000000000bc',
   '/boutique/gala-paris.jpg',
   'Pont Alexandre III, Paris, lit at dusk', true, 1),
  -- bd Rijksmuseum After-Hours (Van Gogh)
  ('d0000000-0000-4000-8000-0000000000bd', 'a0000000-0000-4000-8000-0000000000bd',
   '/boutique/van-gogh-hero.jpg',
   'Van Gogh — Wheat Field with Cypresses (Rijksmuseum private after-hours experience)', true, 1),
  -- be Rijksmuseum Overnight
  ('d0000000-0000-4000-8000-0000000000be', 'a0000000-0000-4000-8000-0000000000be',
   '/boutique/rijksmuseum-overnight.jpg',
   'Rembrandt — The Night Watch (Rijksmuseum, Amsterdam)', true, 1),
  -- c1 Royal Albert Hall Proms
  ('d0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000c1',
   '/boutique/proms-concert.jpg',
   'Royal Albert Hall Proms concert', true, 1),
  -- c2 Wimbledon
  ('d0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-0000000000c2',
   '/boutique/wimbledon-tennis.jpg',
   'Grass-court tennis match', true, 1),
  -- c3 La Scala
  ('d0000000-0000-4000-8000-0000000000c3', 'a0000000-0000-4000-8000-0000000000c3',
   '/boutique/la-scala-opera.jpg',
   'Cello at the opera', true, 1),
  -- c4 Monaco GP Yacht
  ('d0000000-0000-4000-8000-0000000000c4', 'a0000000-0000-4000-8000-0000000000c4',
   '/boutique/monaco-yacht.jpg',
   'Yacht in Monaco harbour', true, 1)
ON CONFLICT (id) DO UPDATE
  SET url      = EXCLUDED.url,
      alt_text = EXCLUDED.alt_text;

-- -----------------------------------------------------------------------------
-- Inventory
-- -----------------------------------------------------------------------------
INSERT INTO inventory (id, product_id, quantity, low_stock_threshold) VALUES
  ('e0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-0000000000b1', 1000, 50),
  ('e0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b2',   12,  2),
  ('e0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-0000000000b3',   12,  2),
  ('e0000000-0000-4000-8000-0000000000b4', 'a0000000-0000-4000-8000-0000000000b4',   12,  2),
  ('e0000000-0000-4000-8000-0000000000b5', 'a0000000-0000-4000-8000-0000000000b5',   12,  2),
  ('e0000000-0000-4000-8000-0000000000b6', 'a0000000-0000-4000-8000-0000000000b6',   12,  2),
  ('e0000000-0000-4000-8000-0000000000b7', 'a0000000-0000-4000-8000-0000000000b7',   12,  2),
  ('e0000000-0000-4000-8000-0000000000b8', 'a0000000-0000-4000-8000-0000000000b8',   12,  2),
  ('e0000000-0000-4000-8000-0000000000b9', 'a0000000-0000-4000-8000-0000000000b9',   12,  2),
  ('e0000000-0000-4000-8000-0000000000ba', 'a0000000-0000-4000-8000-0000000000ba',   12,  2),
  ('e0000000-0000-4000-8000-0000000000bb', 'a0000000-0000-4000-8000-0000000000bb',   12,  2),
  ('e0000000-0000-4000-8000-0000000000bc', 'a0000000-0000-4000-8000-0000000000bc',   12,  2),
  ('e0000000-0000-4000-8000-0000000000bd', 'a0000000-0000-4000-8000-0000000000bd',   12,  2),
  ('e0000000-0000-4000-8000-0000000000be', 'a0000000-0000-4000-8000-0000000000be',    7,  1),
  ('e0000000-0000-4000-8000-0000000000bf', 'a0000000-0000-4000-8000-0000000000bf',    0,  0),
  ('e0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000c1',    4,  1),
  ('e0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-0000000000c2',    6,  1),
  ('e0000000-0000-4000-8000-0000000000c3', 'a0000000-0000-4000-8000-0000000000c3',    3,  1),
  ('e0000000-0000-4000-8000-0000000000c4', 'a0000000-0000-4000-8000-0000000000c4',    1,  1)
ON CONFLICT (id) DO UPDATE
  SET quantity            = EXCLUDED.quantity,
      low_stock_threshold = EXCLUDED.low_stock_threshold;

-- -----------------------------------------------------------------------------
-- Feature flags
-- -----------------------------------------------------------------------------
INSERT INTO feature_flags (name, enabled, description, status) VALUES
  ('boutique_public_enabled',              TRUE,  'Master switch for the /boutique public storefront.', 'stable'),
  ('boutique_chat_enabled',                TRUE,  'Enables the Claude concierge panel.',              'stable'),
  ('boutique_payments_enabled',            TRUE,  'Enables real Worldline checkout.',                  'stable'),
  ('boutique_turnstile_required',          TRUE,  'Forces Cloudflare Turnstile verification on chat + checkout.', 'stable'),
  ('boutique_vic_enabled',                 TRUE,  'Advertises Visa Intelligent Commerce support in /capabilities.', 'stable'),
  ('boutique_mc_agentpay_enabled',         TRUE,  'Advertises Mastercard Agent Pay support in /capabilities.',      'stable'),
  ('boutique_visa_trusted_agent_enabled',  FALSE, 'Advertises Visa Trusted Agent support (not shipped in this standalone build).', 'experimental'),
  ('boutique_mc_trusted_agent_enabled',    FALSE, 'Advertises Mastercard Trusted Agent support (not shipped in this standalone build).', 'experimental')
ON CONFLICT (name) DO UPDATE
  SET enabled     = EXCLUDED.enabled,
      description = EXCLUDED.description,
      status      = EXCLUDED.status;
