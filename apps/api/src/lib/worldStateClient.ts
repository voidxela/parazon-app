/**
 * WarframeStat.us API client.
 *
 * Fetches individual world-state endpoints rather than the monolithic /pc
 * payload to reduce bandwidth and allow independent retry per data type.
 *
 * All functions return null on any fetch/parse failure so callers can
 * decide whether to skip or retry — the worker must never crash s6.
 */

import type {
  VoidFissure,
  Sortie,
  SortieVariant,
  CycleNode,
  Nightwave,
  NightwaveChallenge,
} from "@parazon/types";

const BASE = "https://api.warframestat.us/pc";
const LANGUAGE = "en";

/** Shared fetch with a hard timeout so a stalled connection doesn't block the poll loop. */
async function fetchJson<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BASE}/${path}?language=${LANGUAGE}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[world-state] ${path} returned HTTP ${res.status.toString()}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[world-state] ${path} fetch error: ${msg}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Raw API shapes (WarframeStat.us camelCase) ────────────────────────────────
// These are the actual JSON keys returned by the API. We keep them separate
// from our domain types so a breaking API change is caught at the boundary.

interface RawFissure {
  id: string;
  node: string;
  missionType: string;
  enemy: string;
  tier: string;
  tierNum: number;
  expiry: string;
  activation: string;
  isStorm: boolean;
  isHard: boolean;
  expired: boolean;
}

interface RawSortieVariant {
  missionType: string;
  modifier: string;
  modifierDescription: string;
  node: string;
}

interface RawSortie {
  id: string;
  activation: string;
  expiry: string;
  boss: string;
  faction: string;
  variants: RawSortieVariant[];
  expired: boolean;
}

interface RawCycleNode {
  id: string;
  expiry: string;
  activation: string;
  state: string;
  timeLeft: string;
  isDay: boolean;
  isCetus: boolean;
}

interface RawNightwaveChallenge {
  id: string;
  activation: string;
  expiry: string;
  title: string;
  desc: string;
  reputation: number;
  isDaily: boolean;
  isElite: boolean;
  active: boolean;
}

interface RawNightwave {
  id: string;
  activation: string;
  expiry: string;
  season: number;
  tag: string;
  phase: number;
  activeChallenges: RawNightwaveChallenge[];
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapFissure(raw: RawFissure): VoidFissure {
  return {
    id: raw.id,
    node: raw.node,
    missionType: raw.missionType as VoidFissure["missionType"],
    enemy: raw.enemy as VoidFissure["enemy"],
    tier: raw.tier as VoidFissure["tier"],
    tierNum: raw.tierNum as VoidFissure["tierNum"],
    expiry: raw.expiry,
    activation: raw.activation,
    isStorm: raw.isStorm,
    isHard: raw.isHard,
  };
}

function mapSortieVariant(raw: RawSortieVariant): SortieVariant {
  return {
    missionType: raw.missionType,
    modifier: raw.modifier as SortieVariant["modifier"],
    modifierDescription: raw.modifierDescription,
    node: raw.node,
  };
}

function mapSortie(raw: RawSortie): Sortie {
  const [v0, v1, v2] = raw.variants;
  if (!v0 || !v1 || !v2) throw new Error("Sortie has fewer than 3 variants");
  return {
    id: raw.id,
    activation: raw.activation,
    expiry: raw.expiry,
    boss: raw.boss,
    faction: raw.faction,
    variants: [mapSortieVariant(v0), mapSortieVariant(v1), mapSortieVariant(v2)],
    expired: raw.expired,
    eta: "",
  };
}

function mapCycleNode(raw: RawCycleNode): CycleNode {
  return {
    id: raw.id,
    expiry: raw.expiry,
    activation: raw.activation,
    state: raw.state as CycleNode["state"],
    timeLeft: raw.timeLeft,
    isDay: raw.isDay,
    isCetus: raw.isCetus,
  };
}

function mapNightwaveChallenge(raw: RawNightwaveChallenge): NightwaveChallenge {
  return {
    id: raw.id,
    activation: raw.activation,
    expiry: raw.expiry,
    title: raw.title,
    desc: raw.desc,
    reputation: raw.reputation,
    isDaily: raw.isDaily,
    isElite: raw.isElite,
  };
}

function mapNightwave(raw: RawNightwave): Nightwave {
  return {
    id: raw.id,
    activation: raw.activation,
    expiry: raw.expiry,
    season: raw.season,
    tag: raw.tag,
    phase: raw.phase,
    activeChallenges: raw.activeChallenges
      .filter((c) => c.active)
      .map(mapNightwaveChallenge),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns only non-expired fissures. */
export async function fetchFissures(): Promise<VoidFissure[]> {
  const raw = await fetchJson<RawFissure[]>("fissures");
  if (!raw) return [];
  return raw
    .filter((f) => !f.expired)
    .map((f) => {
      try {
        return mapFissure(f);
      } catch {
        return null;
      }
    })
    .filter((f): f is VoidFissure => f !== null);
}

export async function fetchSortie(): Promise<Sortie | null> {
  const raw = await fetchJson<RawSortie>("sortie");
  if (!raw || raw.expired) return null;
  try {
    return mapSortie(raw);
  } catch (err) {
    console.warn("[world-state] sortie mapping error:", err);
    return null;
  }
}

export async function fetchCetusCycle(): Promise<CycleNode | null> {
  const raw = await fetchJson<RawCycleNode>("cetusCycle");
  if (!raw) return null;
  try {
    return mapCycleNode(raw);
  } catch {
    return null;
  }
}

export async function fetchVallisCycle(): Promise<CycleNode | null> {
  const raw = await fetchJson<RawCycleNode>("vallisCycle");
  if (!raw) return null;
  try {
    return mapCycleNode(raw);
  } catch {
    return null;
  }
}

export async function fetchCambionCycle(): Promise<CycleNode | null> {
  const raw = await fetchJson<RawCycleNode>("cambionCycle");
  if (!raw) return null;
  try {
    return mapCycleNode(raw);
  } catch {
    return null;
  }
}

export async function fetchNightwave(): Promise<Nightwave | null> {
  const raw = await fetchJson<RawNightwave>("nightwave");
  if (!raw) return null;
  try {
    return mapNightwave(raw);
  } catch {
    return null;
  }
}
