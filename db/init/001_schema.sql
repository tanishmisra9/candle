CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS trials (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT,
    phase TEXT,
    start_date DATE,
    completion_date DATE,
    sponsor TEXT,
    intervention TEXT,
    intervention_type TEXT,
    enrollment INTEGER,
    primary_endpoint TEXT,
    locations JSONB NOT NULL DEFAULT '[]'::jsonb,
    contact_email TEXT,
    url TEXT NOT NULL,
    raw_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publications (
    pmid TEXT PRIMARY KEY,
    trial_id TEXT REFERENCES trials(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    authors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    journal TEXT,
    pub_date DATE,
    abstract TEXT,
    doi TEXT,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publication_overviews (
    pmid TEXT PRIMARY KEY REFERENCES publications (pmid) ON DELETE CASCADE,
    overview TEXT NOT NULL,
    abstract_hash TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outcomes (
    id BIGSERIAL PRIMARY KEY,
    trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
    outcome_type TEXT NOT NULL,
    measure TEXT NOT NULL,
    description TEXT,
    timeframe TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embeddings (
    id BIGSERIAL PRIMARY KEY,
    source_type TEXT NOT NULL CHECK (source_type IN ('trial', 'publication')),
    source_id TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trials_status ON trials(status);
CREATE INDEX IF NOT EXISTS idx_trials_phase ON trials(phase);
CREATE INDEX IF NOT EXISTS idx_trials_intervention_type ON trials(intervention_type);
CREATE INDEX IF NOT EXISTS idx_trials_sponsor ON trials(sponsor);
CREATE INDEX IF NOT EXISTS idx_publications_trial_id ON publications(trial_id);
CREATE INDEX IF NOT EXISTS idx_publication_overviews_prompt_lookup
    ON publication_overviews(pmid, abstract_hash, prompt_version);
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_embedding_ivfflat
    ON embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
