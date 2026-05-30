import { sqliteTable, text, integer, blob, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * knowledge_vector.db schema
 *
 * Stores embedded document chunks for the RAG pipeline.
 * The `embedding` column holds a raw Float32 binary blob consumed by sqlite-vec.
 *
 * NOTE: The virtual vec0 table for ANN search is created via a raw migration
 * (see drizzle/vector/) because Drizzle ORM does not yet model virtual tables.
 * All other schema changes must still go through Drizzle migrations.
 */

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(), // ULID
    /** Source identifier, e.g. "wiki:Sampotes" or "item:Braton". Unique per chunk. */
    source: text("source").notNull(),
    /** Plain-text chunk that was embedded. */
    content: text("content").notNull(),
    /**
     * SHA-256 hex digest of `content`. Used by the indexer to skip re-embedding
     * chunks whose text has not changed since the last ingestion run.
     */
    contentHash: text("content_hash").notNull(),
    /** Float32 embedding as a raw binary blob (dimension = 1536 for text-embedding-3-small). */
    embedding: blob("embedding", { mode: "buffer" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("documents_source_unique").on(t.source)],
);
