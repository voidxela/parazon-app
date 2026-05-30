import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * cache.db schema
 *
 * Stores world-state data polled from the Warframe API and
 * price snapshots from warframe.market. All rows are ephemeral —
 * the worker truncates and re-inserts on each poll cycle.
 */

// ── Void Fissures ─────────────────────────────────────────────────────────────

export const fissures = sqliteTable("fissures", {
  id: text("id").primaryKey(), // world-state API id
  node: text("node").notNull(),
  missionType: text("mission_type").notNull(),
  enemy: text("enemy").notNull(),
  tier: text("tier").notNull(),
  tierNum: integer("tier_num").notNull(),
  isStorm: integer("is_storm", { mode: "boolean" }).notNull(),
  isHard: integer("is_hard", { mode: "boolean" }).notNull(),
  activation: integer("activation", { mode: "timestamp" }).notNull(),
  expiry: integer("expiry", { mode: "timestamp" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

// ── Sortie ────────────────────────────────────────────────────────────────────

/**
 * One row per active sortie. The three mission variants are stored as
 * a JSON blob to avoid a separate join table for a fixed 3-element array.
 */
export const sorties = sqliteTable("sorties", {
  id: text("id").primaryKey(),
  boss: text("boss").notNull(),
  faction: text("faction").notNull(),
  /** JSON-serialised SortieVariant[3] */
  variantsJson: text("variants_json").notNull(),
  activation: integer("activation", { mode: "timestamp" }).notNull(),
  expiry: integer("expiry", { mode: "timestamp" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

// ── Open-world cycle nodes ────────────────────────────────────────────────────

/**
 * One row per cycle node (Cetus, Fortuna/Orb Vallis, Cambion Drift).
 * nodeKey is a stable identifier: "cetus" | "vallis" | "cambion".
 */
export const cycleNodes = sqliteTable("cycle_nodes", {
  nodeKey: text("node_key").primaryKey(),
  state: text("state").notNull(),
  expiry: integer("expiry", { mode: "timestamp" }).notNull(),
  activation: integer("activation", { mode: "timestamp" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

// ── Nightwave ─────────────────────────────────────────────────────────────────

export const nightwaves = sqliteTable("nightwaves", {
  id: text("id").primaryKey(),
  season: integer("season").notNull(),
  tag: text("tag").notNull(),
  phase: integer("phase").notNull(),
  activation: integer("activation", { mode: "timestamp" }).notNull(),
  expiry: integer("expiry", { mode: "timestamp" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

export const nightwaveChallenges = sqliteTable("nightwave_challenges", {
  id: text("id").primaryKey(),
  nightwaveId: text("nightwave_id")
    .notNull()
    .references(() => nightwaves.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  desc: text("desc").notNull(),
  reputation: integer("reputation").notNull(),
  isDaily: integer("is_daily", { mode: "boolean" }).notNull(),
  isElite: integer("is_elite", { mode: "boolean" }).notNull(),
  activation: integer("activation", { mode: "timestamp" }).notNull(),
  expiry: integer("expiry", { mode: "timestamp" }).notNull(),
});

// ── Market price snapshots ────────────────────────────────────────────────────

export const priceSnapshots = sqliteTable("price_snapshots", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  itemUrlName: text("item_url_name").notNull(),
  datetime: integer("datetime", { mode: "timestamp" }).notNull(),
  avgPrice: real("avg_price").notNull(),
  minPrice: real("min_price").notNull(),
  maxPrice: real("max_price").notNull(),
  volume: integer("volume").notNull(),
  median: real("median").notNull(),
});
