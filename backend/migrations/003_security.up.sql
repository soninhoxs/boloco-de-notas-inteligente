-- Security hardening: email verification, MFA, AI consent

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255),
    ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ai_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ai_consent_version VARCHAR(32);

UPDATE users SET email_verified = true WHERE auth_provider IN ('google', 'github');

CREATE INDEX IF NOT EXISTS idx_users_pending_email ON users(pending_email) WHERE pending_email IS NOT NULL;
