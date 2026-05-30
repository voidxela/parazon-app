/**
 * cache-sync worker
 *
 * Polls the Warframe world-state API on a fixed interval and upserts
 * fissure, sortie, cycle, and nightwave data into cache.db.
 *
 * s6-overlay supervises this process and will restart it on exit.
 * Every operation is wrapped so a single endpoint failure or rate-limit
 * never crashes the process — s6 restart is a last resort, not the norm.
 */

import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { getCacheClient, fissures, sorties, cycleNodes, nightwaves, nightwaveChallenges } from "@parazon/database";
import {
  fetchFissures,
  fetchSortie,
  fetchCetusCycle,
  fetchVallisCycle,
  fetchCambionCycle,
  fetchNightwave,
} from "../lib/worldStateClient.js";
import type { CycleNode, Sortie, Nightwave } from "@parazon/types";

const POLL_INTERVAL_MS = 60_000;

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function syncFissures(): Promise<void> {
  const data = await fetchFissures();
  if (data.length === 0) return;

  const db = drizzle(getCacheClient());
  const now = new Date();

  // Delete expired rows that are no longer in the API response
  const liveIds = new Set(data.map((f) => f.id));
  const existing = await db.select({ id: fissures.id }).from(fissures);
  const staleIds = existing.map((r) => r.id).filter((id) => !liveIds.has(id));
  for (const id of staleIds) {
    await db.delete(fissures).where(eq(fissures.id, id));
  }

  // Upsert live fissures
  for (const fissure of data) {
    await db
      .insert(fissures)
      .values({
        id: fissure.id,
        node: fissure.node,
        missionType: fissure.missionType,
        enemy: fissure.enemy,
        tier: fissure.tier,
        tierNum: fissure.tierNum,
        isStorm: fissure.isStorm,
        isHard: fissure.isHard,
        activation: new Date(fissure.activation),
        expiry: new Date(fissure.expiry),
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: fissures.id,
        set: {
          expiry: new Date(fissure.expiry),
          fetchedAt: now,
        },
      });
  }

  console.log(`[cache-sync] fissures: upserted ${data.length.toString()}, removed ${staleIds.length.toString()} stale`);
}

async function syncSortie(sortie: Sortie): Promise<void> {
  const db = drizzle(getCacheClient());
  const now = new Date();

  await db
    .insert(sorties)
    .values({
      id: sortie.id,
      boss: sortie.boss,
      faction: sortie.faction,
      variantsJson: JSON.stringify(sortie.variants),
      activation: new Date(sortie.activation),
      expiry: new Date(sortie.expiry),
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: sorties.id,
      set: { fetchedAt: now },
    });

  console.log(`[cache-sync] sortie: upserted ${sortie.id} (${sortie.boss})`);
}

async function syncCycleNode(
  nodeKey: "cetus" | "vallis" | "cambion",
  node: CycleNode,
): Promise<void> {
  const db = drizzle(getCacheClient());
  const now = new Date();

  await db
    .insert(cycleNodes)
    .values({
      nodeKey,
      state: node.state,
      expiry: new Date(node.expiry),
      activation: new Date(node.activation),
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: cycleNodes.nodeKey,
      set: {
        state: node.state,
        expiry: new Date(node.expiry),
        activation: new Date(node.activation),
        fetchedAt: now,
      },
    });

  console.log(`[cache-sync] cycle[${nodeKey}]: state=${node.state}`);
}

async function syncNightwave(nw: Nightwave): Promise<void> {
  const db = drizzle(getCacheClient());
  const now = new Date();

  await db
    .insert(nightwaves)
    .values({
      id: nw.id,
      season: nw.season,
      tag: nw.tag,
      phase: nw.phase,
      activation: new Date(nw.activation),
      expiry: new Date(nw.expiry),
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: nightwaves.id,
      set: { phase: nw.phase, fetchedAt: now },
    });

  // Replace challenges: delete stale, insert new
  const liveIds = new Set(nw.activeChallenges.map((c) => c.id));
  const existing = await db
    .select({ id: nightwaveChallenges.id })
    .from(nightwaveChallenges)
    .where(eq(nightwaveChallenges.nightwaveId, nw.id));

  for (const row of existing) {
    if (!liveIds.has(row.id)) {
      await db.delete(nightwaveChallenges).where(eq(nightwaveChallenges.id, row.id));
    }
  }

  for (const challenge of nw.activeChallenges) {
    await db
      .insert(nightwaveChallenges)
      .values({
        id: challenge.id,
        nightwaveId: nw.id,
        title: challenge.title,
        desc: challenge.desc,
        reputation: challenge.reputation,
        isDaily: challenge.isDaily,
        isElite: challenge.isElite,
        activation: new Date(challenge.activation),
        expiry: new Date(challenge.expiry),
      })
      .onConflictDoNothing();
  }

  console.log(`[cache-sync] nightwave: season ${nw.season.toString()}, ${nw.activeChallenges.length.toString()} challenges`);
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  console.log("[cache-sync] poll tick");

  // Run all fetches concurrently; each is independently fault-tolerant
  const [sortie, cetus, vallis, cambion, nightwave] = await Promise.all([
    fetchSortie(),
    fetchCetusCycle(),
    fetchVallisCycle(),
    fetchCambionCycle(),
    fetchNightwave(),
  ]);

  // Fissures run separately — they have their own stale-deletion logic
  await syncFissures().catch((err: unknown) => {
    console.error("[cache-sync] fissures sync error:", err);
  });

  if (sortie) {
    await syncSortie(sortie).catch((err: unknown) => {
      console.error("[cache-sync] sortie sync error:", err);
    });
  }

  if (cetus) {
    await syncCycleNode("cetus", cetus).catch((err: unknown) => {
      console.error("[cache-sync] cetus sync error:", err);
    });
  }

  if (vallis) {
    await syncCycleNode("vallis", vallis).catch((err: unknown) => {
      console.error("[cache-sync] vallis sync error:", err);
    });
  }

  if (cambion) {
    await syncCycleNode("cambion", cambion).catch((err: unknown) => {
      console.error("[cache-sync] cambion sync error:", err);
    });
  }

  if (nightwave) {
    await syncNightwave(nightwave).catch((err: unknown) => {
      console.error("[cache-sync] nightwave sync error:", err);
    });
  }
}

async function main(): Promise<void> {
  console.log("[cache-sync] starting");
  await poll();
  const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);

  /**
   * Graceful shutdown on SIGTERM.
   * Stop the poll interval and close the cache DB connection before exiting
   * so in-flight writes are not interrupted mid-transaction.
   */
  process.on("SIGTERM", () => {
    console.log("[cache-sync] SIGTERM received — shutting down");
    clearInterval(timer);
    try { getCacheClient().close(); } catch { /* already closed */ }
    console.log("[cache-sync] shutdown complete");
    process.exit(0);
  });
}

void main();
