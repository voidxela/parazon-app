/**
 * Extended item metadata derived from the `warframe-items` data set.
 * https://github.com/WFCD/warframe-items
 *
 * GUARDRAIL: Weapon variants are strictly distinct categories.
 * Do NOT conflate standard weapons, Kuva weapons, Tenet weapons, or
 * Duviri/Incarnon weapons — they have separate acquisition paths,
 * stat profiles, and unique names.
 * e.g. Sampotes is a standard Duviri melee weapon; it is NOT Kuva or Tenet.
 */

import type { WeaponFaction, DamageType } from "./weapon.js";

export type ItemCategory =
  | "Warframes"
  | "Primary"
  | "Secondary"
  | "Melee"
  | "Archwing"
  | "Arch-Gun"
  | "Arch-Melee"
  | "Sentinels"
  | "Pets"
  | "Mods"
  | "Relics"
  | "Resources"
  | "Misc";

/**
 * Extended weapon variant classification beyond the Kuva/Tenet/Standard
 * faction split in `weapon.ts`.
 *
 * - "Prime"      : Orokin-era variants (e.g. Braton Prime)
 * - "Wraith"     : Grineer-themed variants (e.g. Strun Wraith)
 * - "Vandal"     : Corpus-themed variants (e.g. Braton Vandal)
 * - "Prisma"     : Void Trader variants (e.g. Prisma Gorgon)
 * - "Incarnon"   : Duviri/Zariman evolution weapons — standard weapons with
 *                  an Incarnon Genesis adapter; NOT the same as Kuva or Tenet
 * - "Syndicate"  : Syndicate-modified variants (e.g. Sancti Tigris)
 * - "Umbra"      : Umbra-forged variants (e.g. Skiajati)
 */
export type WeaponVariant =
  | WeaponFaction
  | "Prime"
  | "Wraith"
  | "Vandal"
  | "Prisma"
  | "Incarnon"
  | "Syndicate"
  | "Umbra";

/** Minimal shared fields present on every item in the catalogue. */
export interface BaseItem {
  readonly uniqueName: string; // e.g. "/Lotus/Weapons/Tenno/Melee/..."
  readonly name: string;
  readonly description: string;
  readonly category: ItemCategory;
  readonly imageName: string;
  readonly tradable: boolean;
  readonly masteryReq: number;
}

/**
 * Bonus elemental damage present on Kuva and Tenet weapons.
 * These are mutually exclusive variant families — a weapon is either
 * Kuva OR Tenet, never both.
 */
export interface BonusElement {
  readonly type: DamageType;
  /** Percentage bonus, e.g. 60 = 60% bonus elemental damage. Range: 25–60. */
  readonly value: number;
}
