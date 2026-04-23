-- =============================================================================
-- GoCard Boutique — consolidated schema.
--
-- This file is intentionally self-contained: no dependency on any prior
-- migration from the parent monorepo. It creates every table the boutique
-- uses, in FK-safe order, and ships with indexes tuned for the two read
-- paths that actually run in production (catalog browse + payment-log
-- lookup by hosted_checkout_id).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT UNIQUE NOT NULL,
  display_name TEXT,
  logo_url     TEXT,
  address      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- users  (minimal — boutique uses optional auth only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'guest',
  company_id    UUID REFERENCES companies(id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_company_id_idx ON users(company_id);

-- -----------------------------------------------------------------------------
-- brands
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url    TEXT,
  website_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  parent_id   UUID REFERENCES categories(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  brand_id     UUID REFERENCES brands(id),
  category_id  UUID REFERENCES categories(id),
  sku          TEXT UNIQUE,
  price_cents  INTEGER NOT NULL,
  currency     CHAR(3) NOT NULL DEFAULT 'EUR',
  style        TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  availability TEXT,
  booking_note TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_brand_status_idx ON products(brand_id, status);
CREATE INDEX IF NOT EXISTS products_category_idx     ON products(category_id);

-- -----------------------------------------------------------------------------
-- product_images
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  alt_text   TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_images_product_primary_idx
  ON product_images(product_id, is_primary);

-- -----------------------------------------------------------------------------
-- inventory
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id            UUID,
  quantity              INTEGER NOT NULL DEFAULT 0,
  reserved_quantity     INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold   INTEGER NOT NULL DEFAULT 5,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_product_idx
  ON inventory(product_id) WHERE variant_id IS NULL;

-- -----------------------------------------------------------------------------
-- feature_flags
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  status      TEXT,
  owner_email TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- payment_logs  (every column any code path writes — seeded with defaults so
-- partial INSERTs still land cleanly)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_logs (
  id                      SERIAL PRIMARY KEY,
  endpoint                TEXT,
  request_method          TEXT,
  request_body            TEXT,
  request_headers         TEXT,
  response_status         INTEGER,
  response_body           TEXT,
  response_headers        TEXT,
  error_message           TEXT,
  processing_time_ms      INTEGER,
  user_id                 UUID REFERENCES users(id),
  company_id              UUID REFERENCES companies(id),
  merchant_customer_id    TEXT,
  hosted_checkout_id      TEXT,
  ai_session_id           UUID,
  ai_type                 TEXT,
  platform                TEXT,
  requested_platform      TEXT,
  channel                 TEXT DEFAULT 'web',
  network                 VARCHAR(32),
  agent_protocol          VARCHAR(32),
  worldline_payment_id    TEXT,
  payment_status          TEXT,
  payment_status_code     INTEGER,
  payment_status_category TEXT,
  authorization_code      TEXT,
  card_number_masked      TEXT,
  card_expiry_date        TEXT,
  card_brand              TEXT,
  amount_cents            INTEGER,
  currency                CHAR(3),
  status_updated_at       TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_logs_created_idx         ON payment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS payment_logs_hosted_checkout_idx ON payment_logs(hosted_checkout_id);
CREATE INDEX IF NOT EXISTS payment_logs_company_created_idx ON payment_logs(company_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- ai_conversation_logs  (concierge memory + audit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_conversation_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  ai_type    VARCHAR(64),
  user_id    UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversation_logs_session_idx
  ON ai_conversation_logs(session_id, created_at);
