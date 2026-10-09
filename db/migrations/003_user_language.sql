-- Lets each user pick English or Hausa for bot messages (set via the
-- bot's "🌐 Language" menu button). Defaults existing users to English —
-- nobody's experience changes until they explicitly switch.

ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
