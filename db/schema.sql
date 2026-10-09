-- Abeekey Academy — Phase 1 schema (core paid loop)
-- Users, Courses, Orders, Virtual Accounts, Channel Access, Bookings (1-on-1)

CREATE TYPE course_type AS ENUM ('course', 'one_on_one');
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'expired', 'cancelled');
CREATE TYPE access_status AS ENUM ('active', 'expired', 'removed');
CREATE TYPE booking_status AS ENUM ('pending', 'scheduled', 'completed', 'cancelled');

-- People who've talked to the bot. telegram_id is what everything else keys off.
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    telegram_id     BIGINT UNIQUE NOT NULL,
    telegram_username TEXT,
    first_name      TEXT,
    language        TEXT NOT NULL DEFAULT 'en',  -- 'en' or 'ha' (Hausa); set via the bot's language menu
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeded manually for Phase 1; becomes admin-managed in Phase 2.
CREATE TABLE courses (
    id                  BIGSERIAL PRIMARY KEY,
    title               TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    description         TEXT,
    price_ngn           NUMERIC(12,2) NOT NULL,
    type                course_type NOT NULL DEFAULT 'course',
    access_duration_days INTEGER DEFAULT 30,             -- monthly access; NULL = lifetime access
    telegram_channel_id BIGINT,                          -- the private channel this course grants access to (null for one_on_one)
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lesson metadata only — actual videos live in the Telegram channel itself.
CREATE TABLE lessons (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    file_urls   JSONB DEFAULT '[]',   -- downloadable resources, where applicable
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per purchase attempt.
CREATE TABLE orders (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    course_id   BIGINT NOT NULL REFERENCES courses(id),
    amount_ngn  NUMERIC(12,2) NOT NULL,
    status      order_status NOT NULL DEFAULT 'pending',
    paid_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The Paystack (or other provider) dedicated virtual account tied to one order.
CREATE TABLE virtual_accounts (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL DEFAULT 'paystack',
    account_number  TEXT NOT NULL,
    bank_name       TEXT,
    provider_reference TEXT UNIQUE,   -- provider's tx/account reference, for webhook matching
    expires_at      TIMESTAMPTZ,      -- how long the account stays open for this order
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracks who currently has access to which course channel, and until when.
-- The daily cron job reads this table to know who to remove.
CREATE TABLE channel_access (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    course_id   BIGINT NOT NULL REFERENCES courses(id),
    order_id    BIGINT NOT NULL REFERENCES orders(id),
    invite_link TEXT,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,      -- NULL = never expires (lifetime access)
    status      access_status NOT NULL DEFAULT 'active'
);

-- 1-on-1 sessions, triggered by an order on a 'one_on_one' course.
CREATE TABLE bookings (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    course_id       BIGINT NOT NULL REFERENCES courses(id),
    order_id        BIGINT NOT NULL REFERENCES orders(id),
    scheduled_at    TIMESTAMPTZ,
    meeting_link    TEXT,
    status          booking_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Useful indexes for the hot paths: webhook lookup, cron expiry sweep, bot lookups.
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_virtual_accounts_reference ON virtual_accounts(provider_reference);
CREATE INDEX idx_channel_access_expiry ON channel_access(status, expires_at);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
