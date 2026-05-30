-- sqlite-vec virtual table for ANN (approximate nearest-neighbour) search.
--
-- This migration is hand-written because Drizzle ORM does not model virtual
-- tables. It must be applied AFTER the `documents` table exists (migration 0000).
--
-- The vec0 table stores float32 vectors of dimension 1536 (text-embedding-3-small).
-- It is kept in sync with `documents` via the INSERT and DELETE triggers below.
-- UPDATE is handled by DELETE + INSERT in the application layer (replaceDocument).
--
-- Requires the sqlite-vec extension to be loaded before this migration runs.
-- In the runtime container this is loaded via: sqliteVec.load(db)

--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents USING vec0(
  document_id TEXT PRIMARY KEY,
  embedding   FLOAT[1536]
);

--> statement-breakpoint
-- Keep vec_documents in sync when a document is inserted
CREATE TRIGGER IF NOT EXISTS trg_documents_insert
AFTER INSERT ON documents
BEGIN
  INSERT INTO vec_documents(document_id, embedding)
  VALUES (NEW.id, NEW.embedding);
END;

--> statement-breakpoint
-- Keep vec_documents in sync when a document is deleted
CREATE TRIGGER IF NOT EXISTS trg_documents_delete
AFTER DELETE ON documents
BEGIN
  DELETE FROM vec_documents WHERE document_id = OLD.id;
END;
