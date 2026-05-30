/**
 * Tier 1 warframe-items data parser.
 *
 * Maps raw JSON from the warframe-items community dataset to our strict
 * domain types (Weapon, Warframe) and database row shapes.
 *
 * Source: https://github.com/WFCD/warframe-items
 * The dataset is fetched from the CDN mirror at:
 *   https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/All.json
 *
 * GUARDRAIL — Faction classification rules:
 *   Kuva weapons:  uniqueName contains "/Kuva/" path segment
 *                  OR display name starts with "Kuva " AND is in the Kuva Lich
 *                  acquisition pool (verified via uniqueName path).
 *   Tenet weapons: uniqueName contains "/Tenet/" path segment
 *                  OR display name starts with "Tenet " AND is in the Sisters
 *                  of Parvos pool (verified via uniqueName path).
 *   Standard:      everything else, including Duviri weapons (e.g. Sampotes,
 *                  Edun, Syam) which have NO Kuva/Tenet path segment despite
 *                  being obtained from a special game mode.
 *
 * Do NOT classify by display name prefix alone — "Kuva" appears in node names
 * and other non-weapon contexts.
 */

import type { Weapon, WeaponCategory, WeaponFaction, DamageProfile, DamageType, MeleeStance } from "@parazon/types";
import type { Warframe, Polarity } from "@parazon/types";
import { stripHtml } from "./htmlSanitizer.js";

// ── Raw warframe-items JSON shapes ────────────────────────────────────────────
// Only the fields we actually consume are typed here. The full dataset has
// 100+ fields per item; we ignore everything not needed for our domain.

interface RawDamage {
  [damageType: string]: number;
}

interface RawComponent {
  uniqueName: string;
  name: string;
}

interface RawItem {
  uniqueName: string;
  name: string;
  description?: string;
  category: string;
  imageName?: string;
  masteryReq?: number;
  // Warframe stats
  health?: number;
  shield?: number;
  armor?: number;
  energy?: number;
  sprintSpeed?: number;
  polarities?: string[];
  auraPolarity?: string;
  // Weapon stats
  criticalChance?: number;
  criticalMultiplier?: number;
  statusChance?: number;
  fireRate?: number;
  attackSpeed?: number; // melee
  damage?: RawDamage;
  damagePerShot?: number[];
  totalDamage?: number;
  // Melee
  stances?: RawComponent[];
  // Flags
  isPrime?: boolean;
  isUmbra?: boolean;
  // Omitted: components, drops, patchlogs, tradable, etc.
}

// ── Weapon category mapping ───────────────────────────────────────────────────

const WEAPON_CATEGORIES = new Set<WeaponCategory>([
  "Primary",
  "Secondary",
  "Melee",
  "Arch-Gun",
  "Arch-Melee",
]);

function isWeaponCategory(cat: string): cat is WeaponCategory {
  return WEAPON_CATEGORIES.has(cat as WeaponCategory);
}

// ── Faction classification ────────────────────────────────────────────────────

/**
 * Derives WeaponFaction from the item's uniqueName path.
 *
 * The uniqueName is a Lotus path like:
 *   /Lotus/Weapons/Grineer/KuvaLich/Rifles/KuvaBraton
 *   /Lotus/Weapons/Corpus/Tenet/Pistols/TenetCycron
 *   /Lotus/Weapons/Tenno/Melee/Duviri/DuviSampotes   ← Standard, NOT Kuva/Tenet
 *
 * Path-segment matching is case-insensitive to guard against future casing
 * inconsistencies in the dataset.
 */
export function classifyFaction(uniqueName: string): WeaponFaction {
  const lower = uniqueName.toLowerCase();
  // Check path segments, not substring — "/KuvaLich/" not just "kuva"
  if (lower.includes("/kuvalich/") || lower.includes("/kuva/")) return "Kuva";
  if (lower.includes("/tenet/") || lower.includes("/sisters/")) return "Tenet";
  return "Standard";
}

// ── Damage profile mapping ────────────────────────────────────────────────────

const KNOWN_DAMAGE_TYPES = new Set<DamageType>([
  "Impact", "Puncture", "Slash",
  "Heat", "Cold", "Electricity", "Toxin",
  "Blast", "Corrosive", "Gas", "Magnetic", "Radiation", "Viral",
  "True", "Void",
]);

function isDamageType(t: string): t is DamageType {
  return KNOWN_DAMAGE_TYPES.has(t as DamageType);
}

function parseDamageProfile(raw: RawDamage): DamageProfile[] {
  return Object.entries(raw)
    .filter(([type]) => isDamageType(type))
    .map(([type, value]) => ({ type: type as DamageType, value }));
}

// ── Polarity mapping ──────────────────────────────────────────────────────────

const POLARITY_MAP: Record<string, Polarity> = {
  madurai: "Madurai",
  vazarin: "Vazarin",
  naramon: "Naramon",
  zenurik: "Zenurik",
  unairu: "Unairu",
  penjaga: "Penjaga",
  umbra: "Umbra",
  // Some dataset entries use the symbol names
  "=": "Madurai",
  d: "Vazarin",
  "-": "Naramon",
  r: "Zenurik",
  w: "Unairu",
  y: "Penjaga",
};

function parsePolarity(raw: string): Polarity | null {
  return POLARITY_MAP[raw.toLowerCase()] ?? null;
}

function parsePolarities(raw: string[] | undefined): Polarity[] {
  if (!raw) return [];
  return raw.map(parsePolarity).filter((p): p is Polarity => p !== null);
}

// ── Stance mapping ────────────────────────────────────────────────────────────

const KNOWN_STANCES = new Set<MeleeStance>([
  "Bleeding Willow", "Burning Wasp", "Carving Mantis", "Cleaving Whirlwind",
  "Crushing Ruin", "Eleventh Storm", "Flailing Branch", "Four Riders",
  "Fracturing Wind", "Grim Fury", "Iron Phoenix", "Iron Typhoon",
  "Malicious Raptor", "Pointed Wind", "Rending Crane", "Seismic Palm",
  "Shattering Storm", "Sovereign Outcast", "Swirling Tiger", "Tempo Royale",
  "Tranquil Cleave", "Twisting Spines", "Vermillion Storm", "Vicious Frost",
  "Vulpine Mask", "Wise Razor",
]);

function parseStances(raw: RawComponent[] | undefined): MeleeStance[] {
  if (!raw) return [];
  return raw
    .map((s) => s.name)
    .filter((name): name is MeleeStance => KNOWN_STANCES.has(name as MeleeStance));
}

// ── Public parsers ────────────────────────────────────────────────────────────

export interface ParsedWeapon {
  readonly weapon: Weapon;
  readonly description: string; // sanitised plain text
  readonly imageName: string;
}

export interface ParsedWarframe {
  readonly warframe: Warframe;
  readonly description: string; // sanitised plain text
  readonly imageName: string;
}

/**
 * Parses a raw warframe-items entry into a typed Weapon.
 * Returns null if the item is not a weapon or is missing critical fields.
 */
export function parseWeapon(raw: RawItem): ParsedWeapon | null {
  if (!isWeaponCategory(raw.category)) return null;

  const damage = raw.damage ? parseDamageProfile(raw.damage) : [];

  // fireRate for ranged, attackSpeed for melee — normalise to a single field
  const fireRate = raw.fireRate ?? raw.attackSpeed ?? 0;

  const weapon: Weapon = {
    uniqueName: raw.uniqueName,
    name: raw.name,
    category: raw.category,
    faction: classifyFaction(raw.uniqueName),
    damage,
    criticalChance: raw.criticalChance ?? 0,
    criticalMultiplier: raw.criticalMultiplier ?? 0,
    statusChance: raw.statusChance ?? 0,
    fireRate,
    masteryReq: raw.masteryReq ?? 0,
    stances: parseStances(raw.stances),
  };

  return { weapon, description: stripHtml(raw.description), imageName: raw.imageName ?? "" };
}

/**
 * Parses a raw warframe-items entry into a typed Warframe.
 * Returns null if the item is not a Warframe category entry.
 */
export function parseWarframe(raw: RawItem): ParsedWarframe | null {
  if (raw.category !== "Warframes") return null;

  const polarities = parsePolarities(raw.polarities);
  const auraPolarity = raw.auraPolarity
    ? (parsePolarity(raw.auraPolarity) ?? "Madurai")
    : "Madurai";

  const warframe: Warframe = {
    uniqueName: raw.uniqueName,
    name: raw.name,
    health: raw.health ?? 0,
    shield: raw.shield ?? 0,
    armor: raw.armor ?? 0,
    energy: raw.energy ?? 0,
    sprintSpeed: raw.sprintSpeed ?? 0,
    masteryReq: raw.masteryReq ?? 0,
    polarities,
    auraPolarity,
    exilusPolarity: null, // not present in warframe-items dataset
    isPrime: raw.isPrime ?? raw.name.includes("Prime"),
    isUmbra: raw.isUmbra ?? raw.name.includes("Umbra"),
  };

  return { warframe, description: stripHtml(raw.description), imageName: raw.imageName ?? "" };
}

/**
 * Partitions a raw items array into weapons and warframes, discarding
 * all other categories (Mods, Relics, Resources, etc.).
 */
export function partitionItems(rawItems: unknown[]): {
  weapons: ParsedWeapon[];
  warframes: ParsedWarframe[];
} {
  const weapons: ParsedWeapon[] = [];
  const warframes: ParsedWarframe[] = [];

  for (const raw of rawItems) {
    // Runtime guard — the JSON is untyped at the boundary
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as RawItem;
    if (!item.uniqueName || !item.name || !item.category) continue;

    if (item.category === "Warframes") {
      const parsed = parseWarframe(item);
      if (parsed) warframes.push(parsed);
    } else if (isWeaponCategory(item.category)) {
      const parsed = parseWeapon(item);
      if (parsed) weapons.push(parsed);
    }
  }

  return { weapons, warframes };
}
