/**
 * vector-indexer worker
 *
 * Orchestrates the full RAG knowledge-base pipeline:
 *   1. Tier 1 — warframe-items ingestion (item stats + sanitised descriptions)
 *   2. Tier 2 — Fandom MediaWiki wikitext ingestion + semantic chunking
 *   3. Embedding — OpenAI text-embedding-3-small, hash-gated to skip unchanged chunks
 *
 * Runs once on startup, then idles. Re-indexing is triggered by the presence
 * of a sentinel file at /data/.reindex, which this worker removes after completion.
 *
 * s6-overlay supervises this process and will restart it on exit.
 * All errors are caught and logged — the worker never exits on partial failure.
 */

import { existsSync, rmSync } from "node:fs";
import { runItemsIngestion } from "../lib/itemsIngestion.js";
import { fetchAndChunkPages, chunkItemDescription } from "../lib/wikiIngestion.js";
import { indexChunks } from "../lib/embeddings.js";
import { WIKI_PAGES } from "../lib/wikiPageList.js";
import { drizzle } from "drizzle-orm/libsql";
import { getUsersClient, getVectorDb, warframeItems, weaponItems } from "@parazon/database";
import type { WikiChunk } from "../lib/wikiIngestion.js";

const SENTINEL_PATH = "/data/.reindex";
const IDLE_INTERVAL_MS = 30_000;

// ── Item description chunks ───────────────────────────────────────────────────

/**
 * Reads all warframe and weapon descriptions from users.db and converts
 * them to WikiChunk format for embedding alongside wiki content.
 */
async function buildItemDescriptionChunks(): Promise<WikiChunk[]> {
  const db = drizzle(getUsersClient());
  const chunks: WikiChunk[] = [];

  const frames = await db
    .select({ name: warframeItems.name, description: warframeItems.description })
    .from(warframeItems);

  for (const frame of frames) {
    if (!frame.description) continue;
    const chunk = chunkItemDescription(frame.name, frame.description);
    if (chunk) chunks.push(chunk);
  }

  const weapons = await db
    .select({ name: weaponItems.name, description: weaponItems.description })
    .from(weaponItems);

  for (const weapon of weapons) {
    if (!weapon.description) continue;
    const chunk = chunkItemDescription(weapon.name, weapon.description);
    if (chunk) chunks.push(chunk);
  }

  console.log(`[vector-indexer] ${chunks.length.toString()} item description chunks`);
  return chunks;
}

// ── Full index run ────────────────────────────────────────────────────────────

async function index(): Promise<void> {
  console.log("[vector-indexer] index run starting");

  // ── Tier 1: warframe-items ────────────────────────────────────────────────
  try {
    await runItemsIngestion();
  } catch (err) {
    console.error("[vector-indexer] Tier 1 ingestion error:", err);
    // Continue — we can still embed whatever was previously ingested
  }

  // ── Tier 2: wiki pages ────────────────────────────────────────────────────
  let wikiChunks: WikiChunk[] = [];
  try {
    wikiChunks = await fetchAndChunkPages([...WIKI_PAGES]);
    console.log(`[vector-indexer] wiki: ${wikiChunks.length.toString()} total chunks`);
  } catch (err) {
    console.error("[vector-indexer] Tier 2 wiki ingestion error:", err);
  }

  // ── Item description chunks ───────────────────────────────────────────────
  let itemChunks: WikiChunk[] = [];
  try {
    itemChunks = await buildItemDescriptionChunks();
  } catch (err) {
    console.error("[vector-indexer] item description chunk error:", err);
  }

  // ── Embedding ─────────────────────────────────────────────────────────────
  const allChunks = [...wikiChunks, ...itemChunks];
  if (allChunks.length === 0) {
    console.log("[vector-indexer] no chunks to embed — skipping OpenAI calls");
    return;
  }

  try {
    const stats = await indexChunks(allChunks);
    console.log(
      `[vector-indexer] embedding complete — ` +
      `total: ${stats.total.toString()}, ` +
      `embedded: ${stats.embedded.toString()}, ` +
      `skipped (unchanged): ${stats.skipped.toString()}, ` +
      `failed: ${stats.failed.toString()}`,
    );
  } catch (err) {
    console.error("[vector-indexer] embedding pipeline error:", err);
  }

  console.log("[vector-indexer] index run complete");
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[vector-indexer] starting");

  await index().catch((err: unknown) => {
    console.error("[vector-indexer] initial index error:", err);
  });

  const timer = setInterval(() => {
    if (existsSync(SENTINEL_PATH)) {
      rmSync(SENTINEL_PATH);
      console.log("[vector-indexer] sentinel detected — re-indexing");
      void index().catch((err: unknown) => {
        console.error("[vector-indexer] re-index error:", err);
      });
    }
  }, IDLE_INTERVAL_MS);

  /**
   * Graceful shutdown on SIGTERM.
   * Stop the sentinel-check interval and close DB connections. Any in-progress
   * index run will complete its current batch before the process exits because
   * SIGTERM does not interrupt synchronous SQLite writes.
   */
  process.on("SIGTERM", () => {
    console.log("[vector-indexer] SIGTERM received — shutting down");
    clearInterval(timer);
    try { getUsersClient().close(); } catch { /* already closed */ }
    // getVectorDb() returns the singleton — close its underlying $client
    try { getVectorDb().$client.close(); } catch { /* already closed */ }
    console.log("[vector-indexer] shutdown complete");
    process.exit(0);
  });
}

void main();
