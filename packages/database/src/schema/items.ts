import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * users.db — static Warframe item catalogue
 *
 * Populated by the Tier 1 ingestion pipeline from warframe-items JSON.
 * Rows are upserted (not deleted) so loadout foreign keys remain valid
 * across ingestion runs.
 */

// ── Warframes ─────────────────────────────────────────────────────────────────

export const warframeItems = sqliteTable("warframe_items", {
  uniqueName: text("unique_name").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  health: integer("health").notNull().default(0),
  shield: integer("shield").notNull().default(0),
  armor: integer("armor").notNull().default(0),
  energy: integer("energy").notNull().default(0),
  sprintSpeed: real("sprint_speed").notNull().default(0),
  masteryReq: integer("mastery_req").notNull().default(0),
  isPrime: integer("is_prime", { mode: "boolean" }).notNull().default(false),
  isUmbra: integer("is_umbra", { mode: "boolean" }).notNull().default(false),
  /** JSON-serialised Polarity[] */
  polaritiesJson: text("polarities_json").notNull().default("[]"),
  auraPolarity: text("aura_polarity").notNull().default(""),
  imageName: text("image_name").notNull().default(""),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }).notNull(),
});

// ── Weapons ───────────────────────────────────────────────────────────────────

export const weaponItems = sqliteTable("weapon_items", {
  uniqueName: text("unique_name").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** "Primary" | "Secondary" | "Melee" | "Arch-Gun" | "Arch-Melee" */
  category: text("category").notNull(),
  /** "Standard" | "Kuva" | "Tenet" */
  faction: text("faction").notNull().default("Standard"),
  masteryReq: integer("mastery_req").notNull().default(0),
  criticalChance: real("critical_chance").notNull().default(0),
  criticalMultiplier: real("critical_multiplier").notNull().default(0),
  statusChance: real("status_chance").notNull().default(0),
  fireRate: real("fire_rate").notNull().default(0),
  /** JSON-serialised DamageProfile[] */
  damageJson: text("damage_json").notNull().default("[]"),
  /** JSON-serialised MeleeStance[] — empty for ranged weapons */
  stancesJson: text("stances_json").notNull().default("[]"),
  imageName: text("image_name").notNull().default(""),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }).notNull(),
});
