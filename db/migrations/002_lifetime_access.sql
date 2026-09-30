-- Makes lifetime (never-expiring) access possible on a per-course basis.
-- NULL access_duration_days on a course means lifetime; NULL expires_at
-- on a channel_access row means it never expires. The existing cron sweep
-- (WHERE expires_at <= now()) already excludes NULL rows automatically —
-- SQL's NULL comparison semantics mean a NULL never satisfies <=.

ALTER TABLE courses ALTER COLUMN access_duration_days DROP NOT NULL;
ALTER TABLE channel_access ALTER COLUMN expires_at DROP NOT NULL;
