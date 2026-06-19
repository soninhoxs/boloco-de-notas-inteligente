-- OAuth accounts and LGPD consent fields

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS consent_version VARCHAR(32),
    ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'github')),
    provider_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
