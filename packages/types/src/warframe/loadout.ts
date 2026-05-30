import type { Warframe } from "./warframe.js";
import type { Weapon } from "./weapon.js";
import type { MissionType } from "./fissure.js";

export interface Loadout {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly warframe: Pick<Warframe, "uniqueName" | "name">;
  readonly primary: Pick<Weapon, "uniqueName" | "name"> | null;
  readonly secondary: Pick<Weapon, "uniqueName" | "name"> | null;
  readonly melee: Pick<Weapon, "uniqueName" | "name"> | null;
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
}

export interface LoadoutRecommendationRequest {
  readonly warframeName: string;
  readonly missionType: MissionType;
  readonly preferences?: string;
}

export interface LoadoutRecommendation {
  readonly loadout: Omit<Loadout, "id" | "userId" | "createdAt" | "updatedAt">;
  readonly rationale: string;
  /** Similarity score from the vector search (0–1). */
  readonly score: number;
}
