CREATE TABLE IF NOT EXISTS chunks (
	id          TEXT PRIMARY KEY,
	owner       TEXT NOT NULL,
	source      TEXT NOT NULL,
	chunk_index INTEGER NOT NULL,
	text        TEXT NOT NULL,
	hash        TEXT NOT NULL,
	created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_owner ON chunks(owner, source);
