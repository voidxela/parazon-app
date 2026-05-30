/**
 * Weapon classification types for Warframe.
 *
 * Faction weapon variants are strictly distinct categories:
 *   - Standard:  base weapons (e.g. Braton, Sampotes)
 *   - Kuva:      Kuva Lich weapons (e.g. Kuva Braton, Kuva Shildeg)
 *   - Tenet:     Sisters of Parvos weapons (e.g. Tenet Cycron, Tenet Agendus)
 *
 * Sampotes is a standard Duviri melee weapon. It is NOT a Tenet or Kuva variant.
 */

export type WeaponCategory =
  | "Primary"
  | "Secondary"
  | "Melee"
  | "Arch-Gun"
  | "Arch-Melee";

export type WeaponFaction = "Standard" | "Kuva" | "Tenet";

export type MeleeStance =
  | "Bleeding Willow"
  | "Burning Wasp"
  | "Carving Mantis"
  | "Cleaving Whirlwind"
  | "Crushing Ruin"
  | "Eleventh Storm"
  | "Flailing Branch"
  | "Four Riders"
  | "Fracturing Wind"
  | "Grim Fury"
  | "Iron Phoenix"
  | "Iron Typhoon"
  | "Malicious Raptor"
  | "Pointed Wind"
  | "Rending Crane"
  | "Seismic Palm"
  | "Shattering Storm"
  | "Sovereign Outcast"
  | "Swirling Tiger"
  | "Tempo Royale"
  | "Tranquil Cleave"
  | "Twisting Spines"
  | "Vermillion Storm"
  | "Vicious Frost"
  | "Vulpine Mask"
  | "Wise Razor";

export type DamageType =
  | "Impact"
  | "Puncture"
  | "Slash"
  | "Heat"
  | "Cold"
  | "Electricity"
  | "Toxin"
  | "Blast"
  | "Corrosive"
  | "Gas"
  | "Magnetic"
  | "Radiation"
  | "Viral"
  | "True"
  | "Void";

export interface DamageProfile {
  readonly type: DamageType;
  readonly value: number;
}

export interface Weapon {
  readonly uniqueName: string;
  readonly name: string;
  readonly category: WeaponCategory;
  readonly faction: WeaponFaction;
  /** Base damage breakdown before mods. */
  readonly damage: readonly DamageProfile[];
  readonly criticalChance: number;    // 0–1
  readonly criticalMultiplier: number;
  readonly statusChance: number;      // 0–1
  readonly fireRate: number;
  readonly masteryReq: number;
  /** Applicable stances; empty for non-melee weapons. */
  readonly stances: readonly MeleeStance[];
}
