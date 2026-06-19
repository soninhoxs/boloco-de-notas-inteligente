DROP TABLE IF EXISTS oauth_accounts;

ALTER TABLE users
    DROP COLUMN IF EXISTS consent_version,
    DROP COLUMN IF EXISTS consented_at,
    DROP COLUMN IF EXISTS auth_provider;

ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
