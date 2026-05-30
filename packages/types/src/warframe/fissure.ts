/**
 * Void Fissure types sourced from the Warframe world-state API
 * (https://api.warframestat.us/pc/fissures).
 */

export type VoidTier = "Lith" | "Meso" | "Neo" | "Axi" | "Requiem" | "Omnia";

export type MissionType =
  | "Assassination"
  | "Capture"
  | "Defense"
  | "Disruption"
  | "Excavation"
  | "Exterminate"
  | "Hijack"
  | "Infested Salvage"
  | "Interception"
  | "Mobile Defense"
  | "Rescue"
  | "Sabotage"
  | "Spy"
  | "Survival"
  | "Void Cascade"
  | "Void Flood";

export type FissureEnemy =
  | "Grineer"
  | "Corpus"
  | "Infested"
  | "Orokin"
  | "Corrupted"
  | "Narmer";

export interface VoidFissure {
  readonly id: string;
  readonly node: string;
  readonly missionType: MissionType;
  readonly enemy: FissureEnemy;
  readonly tier: VoidTier;
  readonly tierNum: 1 | 2 | 3 | 4 | 5 | 6;
  readonly expiry: string; // ISO 8601
  readonly activation: string; // ISO 8601
  readonly isStorm: boolean;
  readonly isHard: boolean; // Steel Path
}
