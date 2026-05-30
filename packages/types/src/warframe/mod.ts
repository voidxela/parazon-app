/**
 * Mod types derived from the `warframe-items` data set.
 */

import type { Polarity } from "./warframe.js";

export type ModRarity = "Common" | "Uncommon" | "Rare" | "Legendary" | "Peculiar";

export type ModType =
  | "Normal"
  | "Aura"
  | "Stance"
  | "Exilus"
  | "Amalgam"
  | "Archon"
  | "Riven"
  | "Parazon";

export interface ModRank {
  readonly rank: number;
  readonly stats: readonly string[]; // human-readable stat descriptions per rank
  readonly cost: number; // drain at this rank
}

export interface Mod {
  readonly uniqueName: string;
  readonly name: string;
  readonly description: string;
  readonly rarity: ModRarity;
  readonly type: ModType;
  readonly polarity: Polarity;
  readonly baseDrain: number;
  readonly maxRank: number;
  readonly ranks: readonly ModRank[];
  readonly tradable: boolean;
  readonly imageName: string;
  /** Compatible item categories. Empty = universal. */
  readonly compatName: readonly string[];
}

// ── Riven mods ────────────────────────────────────────────────────────────────

export type RivenDisposition = 1 | 2 | 3 | 4 | 5;

export interface RivenStat {
  readonly name: string;
  readonly value: number;
  readonly positive: boolean;
}

export interface RivenMod extends Omit<Mod, "type" | "ranks"> {
  readonly type: "Riven";
  readonly weaponUniqueName: string;
  readonly disposition: RivenDisposition;
  readonly stats: readonly RivenStat[];
  readonly masteryRankRequired: number;
  readonly rerolls: number;
}
