/**
 * World-state types sourced from the WarframeStat.us API.
 * https://docs.warframestat.us/
 *
 * These represent live, ephemeral game state. They are injected directly
 * into the Oracle LLM system prompt and are NOT embedded into the vector DB.
 */

import type { VoidFissure } from "./fissure.js";

export type Platform = "pc" | "ps4" | "xb1" | "swi";

// ── Invasions ─────────────────────────────────────────────────────────────────

export type InvasionFaction = "Grineer" | "Corpus" | "Infested";

export interface InvasionReward {
  readonly itemString: string;
  readonly thumbnail: string;
  readonly color: number;
  readonly countedItems: readonly { readonly count: number; readonly type: string }[];
}

export interface Invasion {
  readonly id: string;
  readonly node: string;
  readonly desc: string;
  readonly attackingFaction: InvasionFaction;
  readonly defendingFaction: InvasionFaction;
  readonly attackerReward: InvasionReward;
  readonly defenderReward: InvasionReward;
  /** Completion percentage, 0–100. Negative = attacker winning. */
  readonly completion: number;
  readonly completed: boolean;
  readonly eta: string;
  readonly activation: string; // ISO 8601
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface AlertMission {
  readonly node: string;
  readonly type: string;
  readonly faction: string;
  readonly reward: {
    readonly items: readonly string[];
    readonly countedItems: readonly { readonly count: number; readonly type: string }[];
    readonly credits: number;
  };
  readonly minEnemyLevel: number;
  readonly maxEnemyLevel: number;
  readonly nightmare: boolean;
  readonly archwingRequired: boolean;
}

export interface Alert {
  readonly id: string;
  readonly activation: string; // ISO 8601
  readonly expiry: string; // ISO 8601
  readonly mission: AlertMission;
  readonly expired: boolean;
  readonly eta: string;
}

// ── Sortie ────────────────────────────────────────────────────────────────────

export type SortieModifier =
  | "Augmented Enemy Armor"
  | "Augmented Enemy Shields"
  | "Eximus Stronghold"
  | "Enemy Physical Enhancement"
  | "Enemy Elemental Enhancement"
  | "Hazard: Cryogenic Leakage"
  | "Hazard: Electromagnetic Anomalies"
  | "Hazard: Explosive Barrels"
  | "Hazard: Fog"
  | "Hazard: Ice Storm"
  | "Hazard: Radiation Pockets"
  | "Hazard: Toxic Gas"
  | "Low Energy"
  | "Weapon Restriction: Assault Rifle Only"
  | "Weapon Restriction: Bow Only"
  | "Weapon Restriction: Melee Only"
  | "Weapon Restriction: Pistol Only"
  | "Weapon Restriction: Rifle Only"
  | "Weapon Restriction: Shotgun Only"
  | "Weapon Restriction: Sniper Rifle Only";

export interface SortieVariant {
  readonly missionType: string;
  readonly modifier: SortieModifier;
  readonly modifierDescription: string;
  readonly node: string;
}

export interface Sortie {
  readonly id: string;
  readonly activation: string; // ISO 8601
  readonly expiry: string; // ISO 8601
  readonly boss: string;
  readonly faction: string;
  readonly variants: readonly [SortieVariant, SortieVariant, SortieVariant];
  readonly expired: boolean;
  readonly eta: string;
}

// ── Nightwave ─────────────────────────────────────────────────────────────────

export type NightwaveChallengeType = "daily" | "weekly" | "elite_weekly";

export interface NightwaveChallenge {
  readonly id: string;
  readonly activation: string; // ISO 8601
  readonly expiry: string; // ISO 8601
  readonly title: string;
  readonly desc: string;
  readonly reputation: number;
  readonly isDaily: boolean;
  readonly isElite: boolean;
}

export interface Nightwave {
  readonly id: string;
  readonly activation: string; // ISO 8601
  readonly expiry: string; // ISO 8601
  readonly season: number;
  readonly tag: string;
  readonly phase: number;
  readonly activeChallenges: readonly NightwaveChallenge[];
}

// ── Cycle nodes (Cetus, Fortuna, Cambion Drift) ───────────────────────────────

export type CycleState = "day" | "night" | "warm" | "cold" | "fass" | "vome" | "corpus" | "grineer";

export interface CycleNode {
  readonly id: string;
  readonly expiry: string; // ISO 8601
  readonly activation: string; // ISO 8601
  readonly state: CycleState;
  readonly timeLeft: string;
  readonly isDay: boolean;
  readonly isCetus: boolean;
}

// ── Void Trader (Baro Ki'Teer) ────────────────────────────────────────────────

export interface VoidTraderItem {
  readonly item: string;
  readonly ducats: number;
  readonly credits: number;
}

export interface VoidTrader {
  readonly id: string;
  readonly activation: string; // ISO 8601
  readonly expiry: string; // ISO 8601
  readonly character: string;
  readonly location: string;
  readonly inventory: readonly VoidTraderItem[];
  readonly active: boolean;
  readonly startString: string;
  readonly endString: string;
}

// ── Full world-state snapshot ─────────────────────────────────────────────────

export interface WorldState {
  readonly timestamp: string; // ISO 8601 — when this snapshot was fetched
  readonly fissures: readonly VoidFissure[];
  readonly invasions: readonly Invasion[];
  readonly alerts: readonly Alert[];
  readonly sortie: Sortie | null;
  readonly nightwave: Nightwave | null;
  readonly cetusCycle: CycleNode | null;
  readonly vallisCycle: CycleNode | null;
  readonly cambionCycle: CycleNode | null;
  readonly voidTrader: VoidTrader | null;
}
