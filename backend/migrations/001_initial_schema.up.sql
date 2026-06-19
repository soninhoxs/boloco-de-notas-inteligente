-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    settings JSONB DEFAULT '{"theme": "system", "language": "pt-BR", "ai_enabled": true, "ai_provider": "groq"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Notes table with partitioning by created_at
CREATE TABLE IF NOT EXISTS notes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('idea', 'task', 'reflection', 'gratitude')),
    location JSONB,
    ai_suggestions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) PARTITION BY RANGE (created_at);

-- Create partitions for notes (example: by year-month)
-- These should be created automatically by a cron job or migration script
CREATE TABLE IF NOT EXISTS notes_2024_01 PARTITION OF notes
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS notes_2024_02 PARTITION OF notes
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE IF NOT EXISTS notes_2024_03 PARTITION OF notes
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE IF NOT EXISTS notes_2024_04 PARTITION OF notes
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE IF NOT EXISTS notes_2024_05 PARTITION OF notes
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE IF NOT EXISTS notes_2024_06 PARTITION OF notes
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE IF NOT EXISTS notes_2024_07 PARTITION OF notes
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE IF NOT EXISTS notes_2024_08 PARTITION OF notes
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE IF NOT EXISTS notes_2024_09 PARTITION OF notes
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE IF NOT EXISTS notes_2024_10 PARTITION OF notes
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE IF NOT EXISTS notes_2024_11 PARTITION OF notes
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE IF NOT EXISTS notes_2024_12 PARTITION OF notes
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- 2025 partitions
CREATE TABLE IF NOT EXISTS notes_2025_01 PARTITION OF notes
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS notes_2025_02 PARTITION OF notes
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS notes_2025_03 PARTITION OF notes
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS notes_2025_04 PARTITION OF notes
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE IF NOT EXISTS notes_2025_05 PARTITION OF notes
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE IF NOT EXISTS notes_2025_06 PARTITION OF notes
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS notes_2025_07 PARTITION OF notes
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE IF NOT EXISTS notes_2025_08 PARTITION OF notes
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE IF NOT EXISTS notes_2025_09 PARTITION OF notes
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS notes_2025_10 PARTITION OF notes
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE IF NOT EXISTS notes_2025_11 PARTITION OF notes
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE IF NOT EXISTS notes_2025_12 PARTITION OF notes
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 partitions
CREATE TABLE IF NOT EXISTS notes_2026_01 PARTITION OF notes
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS notes_2026_02 PARTITION OF notes
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS notes_2026_03 PARTITION OF notes
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS notes_2026_04 PARTITION OF notes
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS notes_2026_05 PARTITION OF notes
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS notes_2026_06 PARTITION OF notes
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS notes_2026_07 PARTITION OF notes
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS notes_2026_08 PARTITION OF notes
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS notes_2026_09 PARTITION OF notes
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS notes_2026_10 PARTITION OF notes
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS notes_2026_11 PARTITION OF notes
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS notes_2026_12 PARTITION OF notes
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Create indexes on notes
CREATE INDEX IF NOT EXISTS idx_notes_user_created ON notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_category ON notes(user_id, category);
CREATE INDEX IF NOT EXISTS idx_notes_content_search ON notes USING GIN(to_tsvector('portuguese', content));

-- Attachments table (references to MinIO objects)
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_key VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on attachments
CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(user_id);

-- Function to auto-create future partitions
CREATE OR REPLACE FUNCTION create_notes_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Create partitions for next 3 months
    FOR i IN 0..2 LOOP
        partition_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        partition_name := 'notes_' || TO_CHAR(partition_date, 'YYYY_MM');
        start_date := partition_date;
        end_date := partition_date + INTERVAL '1 month';
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF notes FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
