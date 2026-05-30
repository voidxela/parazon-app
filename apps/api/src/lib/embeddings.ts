/**
 * Vector embedding pipeline.
 *
 * Responsibilities:
 *   1. Hash each text chunk (SHA-256) and skip chunks already stored with
 *      the same hash — no OpenAI tokens spent on unchanged content.
 *   2. Call OpenAI text-embedding-3-small for new/changed chunks.
 *   3. Convert the returned float[] to a Float32Array binary blob.
 *   4. Upsert into knowledge_vector.db via Drizzle ORM.
 *
 * sqlite-vec virtual table:
 *   The vec0 ANN index is NOT managed by Drizzle (it doesn't model virtual
 *   tables). It is created once via a raw SQL migration and kept in sync by
 *   triggers defined in that same migration file. The `documents` table is
 *   the source of truth; vec0 is a read-side index only.
 */

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { sql } from "drizzle-orm";
import { ulid } from "ulid";
import { getVectorDb, documents } from "@parazon/database";
import type { WikiChunk } from "./wikiIngestion.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Mandatory per spec — cost-optimised embedding model. */
const EMBEDDING_MODEL = "text-embedding-3-small" as const;

/** Output dimension for text-embedding-3-small. */
const EMBEDDING_DIM = 1536;

/**
 * Maximum chunks per OpenAI batch request.
 * The API accepts up to 2048 inputs per call; we use a conservative batch
 * size to stay well within rate limits and avoid oversized payloads.
 */
const BATCH_SIZE = 100;

// ── OpenAI client ─────────────────────────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set");
  return new OpenAI({ apiKey });
}

// ── Hashing ───────────────────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of a string.
 * Used as a content-addressable key to detect unchanged chunks.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ── Float32 serialisation ─────────────────────────────────────────────────────

/**
 * Converts an OpenAI embedding (number[]) to a raw Float32 binary Buffer.
 * sqlite-vec expects IEEE 754 little-endian float32 blobs.
 */
export function embeddingToBuffer(embedding: number[]): Buffer {
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `Expected ${EMBEDDING_DIM.toString()} dimensions, got ${embedding.length.toString()}`,
    );
  }
  const buf = Buffer.allocUnsafe(EMBEDDING_DIM * 4);
  for (let i = 0; i < embedding.length; i++) {
    buf.writeFloatLE(embedding[i] ?? 0, i * 4);
  }
  return buf;
}

// ── Hash lookup ───────────────────────────────────────────────────────────────

/**
 * Loads all existing (source → contentHash) pairs from knowledge_vector.db
 * into a Map for O(1) lookup during the indexing loop.
 */
async function loadExistingHashes(): Promise<Map<string, string>> {
  const db = getVectorDb();
  const rows = await db
    .select({ source: documents.source, contentHash: documents.contentHash })
    .from(documents);

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.source, row.contentHash);
  }
  return map;
}

// ── OpenAI batch embedding ────────────────────────────────────────────────────

/**
 * Sends a batch of text strings to OpenAI and returns the embeddings in
 * the same order. Throws on API error so the caller can decide to retry.
 */
async function embedBatch(
  client: OpenAI,
  texts: string[],
): Promise<number[][]> {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    encoding_format: "float",
  });

  // The API guarantees order is preserved when input is an array
  return response.data.map((d) => d.embedding);
}

// ── Upsert ────────────────────────────────────────────────────────────────────

/**
 * Upserts a document by source using ON CONFLICT DO UPDATE on the unique
 * `source` index (migration 0003). When the content changes, the existing
 * row is updated in-place; the vec0 triggers keep vec_documents consistent.
 *
 * Wrapped in a transaction so a trigger failure (e.g. vec_documents write)
 * rolls back the documents row too, preventing index/table divergence.
 */
async function upsertDocument(
  source: string,
  content: string,
  contentHash: string,
  embedding: Buffer,
): Promise<void> {
  const db = getVectorDb();

  // better-sqlite3 transactions are synchronous
  db.transaction((tx) => {
    tx
      .insert(documents)
      .values({
        id: ulid(),
        source,
        content,
        contentHash,
        embedding,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: sql`(source) WHERE true`,
        set: {
          content,
          contentHash,
          embedding,
          createdAt: new Date(),
        },
      })
      .run();
  });
}

// ── Public entry point ────────────────────────────────────────────────────────

export interface IndexingStats {
  total: number;
  skipped: number;
  embedded: number;
  failed: number;
}

/**
 * Indexes a list of chunks into knowledge_vector.db.
 *
 * For each chunk:
 *   - Compute SHA-256 of content
 *   - If an existing row has the same hash → skip (no API call)
 *   - Otherwise → embed via OpenAI, store Float32 blob
 *
 * Chunks are sent to OpenAI in batches of BATCH_SIZE to minimise
 * round-trips while staying within rate limits.
 */
export async function indexChunks(chunks: WikiChunk[]): Promise<IndexingStats> {
  const stats: IndexingStats = { total: chunks.length, skipped: 0, embedded: 0, failed: 0 };
  if (chunks.length === 0) return stats;

  const existingHashes = await loadExistingHashes();
  const client = getOpenAIClient();

  // Partition into skip / needs-embedding
  const toEmbed: WikiChunk[] = [];
  const toEmbedHashes: string[] = [];

  for (const chunk of chunks) {
    const hash = hashContent(chunk.content);
    const existing = existingHashes.get(chunk.source);
    if (existing === hash) {
      stats.skipped++;
    } else {
      toEmbed.push(chunk);
      toEmbedHashes.push(hash);
    }
  }

  console.log(
    `[embeddings] ${stats.skipped.toString()} unchanged, ${toEmbed.length.toString()} to embed`,
  );

  // Process in batches
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batchChunks = toEmbed.slice(i, i + BATCH_SIZE);
    const batchHashes = toEmbedHashes.slice(i, i + BATCH_SIZE);
    const batchTexts = batchChunks.map((c) => c.content);

    let embeddings: number[][];
    try {
      embeddings = await embedBatch(client, batchTexts);
    } catch (err) {
      console.error(
        `[embeddings] OpenAI batch ${Math.floor(i / BATCH_SIZE).toString()} failed:`,
        err,
      );
      stats.failed += batchChunks.length;
      continue;
    }

    for (let j = 0; j < batchChunks.length; j++) {
      const chunk = batchChunks[j];
      const hash = batchHashes[j];
      const embedding = embeddings[j];

      if (!chunk || !hash || !embedding) continue;

      try {
        const buf = embeddingToBuffer(embedding);
        await upsertDocument(chunk.source, chunk.content, hash, buf);
        stats.embedded++;
      } catch (err) {
        console.error(`[embeddings] upsert failed for "${chunk.source}":`, err);
        stats.failed++;
      }
    }

    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toEmbed.length / BATCH_SIZE);
    console.log(`[embeddings] batch ${batchNum.toString()}/${totalBatches.toString()} complete`);
  }

  return stats;
}
