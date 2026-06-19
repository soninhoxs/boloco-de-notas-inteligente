ALTER TABLE users
    DROP COLUMN IF EXISTS ai_consent_version,
    DROP COLUMN IF EXISTS ai_consent_at,
    DROP COLUMN IF EXISTS mfa_enabled,
    DROP COLUMN IF EXISTS mfa_secret,
    DROP COLUMN IF EXISTS pending_email,
    DROP COLUMN IF EXISTS email_verified;

DROP INDEX IF EXISTS idx_users_pending_email;
