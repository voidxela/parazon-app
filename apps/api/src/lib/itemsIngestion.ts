/**
 * Tier 1 warframe-items ingestion pipeline.
 *
 * Fetches the community warframe-items JSON dataset, parses it through
 * strict typed parsers, and upserts Warframe and weapon rows into users.db.
 *
 * Designed to be called:
 *   - On first boot by the vector-indexer worker
 *   - On demand via the /data/.reindex sentinel file
 *   - Directly as a standalone script: tsx src/lib/itemsIngestion.ts
 */

import { drizzle } from "drizzle-orm/libsql";
import { getUsersClient, warframeItems, weaponItems } from "@parazon/database";
import { partitionItems, type ParsedWarframe, type ParsedWeapon } from "./itemsParser.js";

const ITEMS_CDN_URL =
  "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/All.json";

const FETCH_TIMEOUT_MS = 30_000;

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchItemsJson(): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    console.log("[items-ingestion] fetching warframe-items dataset…");
    const res = await fetch(ITEMS_CDN_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status.toString()} from warframe-items CDN`);
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new Error("warframe-items response is not an array");
    }

    console.log(`[items-ingestion] fetched ${data.length.toString()} raw items`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertWarframes(parsed: ParsedWarframe[]): Promise<void> {
  const db = drizzle(getUsersClient());
  const now = new Date();
  let count = 0;

  for (const { warframe, description, imageName } of parsed) {
    await db
      .insert(warframeItems)
      .values({
        uniqueName: warframe.uniqueName,
        name: warframe.name,
        description,
        health: warframe.health,
        shield: warframe.shield,
        armor: warframe.armor,
        energy: warframe.energy,
        sprintSpeed: warframe.sprintSpeed,
        masteryReq: warframe.masteryReq,
        isPrime: warframe.isPrime,
        isUmbra: warframe.isUmbra,
        polaritiesJson: JSON.stringify(warframe.polarities),
        auraPolarity: warframe.auraPolarity,
        imageName,
        ingestedAt: now,
      })
      .onConflictDoUpdate({
        target: warframeItems.uniqueName,
        set: {
          name: warframe.name,
          description,
          health: warframe.health,
          shield: warframe.shield,
          armor: warframe.armor,
          energy: warframe.energy,
          sprintSpeed: warframe.sprintSpeed,
          masteryReq: warframe.masteryReq,
          isPrime: warframe.isPrime,
          isUmbra: warframe.isUmbra,
          polaritiesJson: JSON.stringify(warframe.polarities),
          auraPolarity: warframe.auraPolarity,
          imageName,
          ingestedAt: now,
        },
      });
    count++;
  }

  console.log(`[items-ingestion] upserted ${count.toString()} warframes`);
}

async function upsertWeapons(parsed: ParsedWeapon[]): Promise<void> {
  const db = drizzle(getUsersClient());
  const now = new Date();
  let count = 0;

  for (const { weapon, description, imageName } of parsed) {
    await db
      .insert(weaponItems)
      .values({
        uniqueName: weapon.uniqueName,
        name: weapon.name,
        description,
        category: weapon.category,
        faction: weapon.faction,
        masteryReq: weapon.masteryReq,
        criticalChance: weapon.criticalChance,
        criticalMultiplier: weapon.criticalMultiplier,
        statusChance: weapon.statusChance,
        fireRate: weapon.fireRate,
        damageJson: JSON.stringify(weapon.damage),
        stancesJson: JSON.stringify(weapon.stances),
        imageName,
        ingestedAt: now,
      })
      .onConflictDoUpdate({
        target: weaponItems.uniqueName,
        set: {
          name: weapon.name,
          description,
          category: weapon.category,
          faction: weapon.faction,
          masteryReq: weapon.masteryReq,
          criticalChance: weapon.criticalChance,
          criticalMultiplier: weapon.criticalMultiplier,
          statusChance: weapon.statusChance,
          fireRate: weapon.fireRate,
          damageJson: JSON.stringify(weapon.damage),
          stancesJson: JSON.stringify(weapon.stances),
          imageName,
          ingestedAt: now,
        },
      });
    count++;
  }

  console.log(`[items-ingestion] upserted ${count.toString()} weapons`);
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function runItemsIngestion(): Promise<void> {
  const rawItems = await fetchItemsJson();
  const { weapons, warframes } = partitionItems(rawItems);

  console.log(
    `[items-ingestion] parsed: ${warframes.length.toString()} warframes, ${weapons.length.toString()} weapons`,
  );

  // Log faction breakdown for observability
  const kuva = weapons.filter((w) => w.weapon.faction === "Kuva").length;
  const tenet = weapons.filter((w) => w.weapon.faction === "Tenet").length;
  const standard = weapons.filter((w) => w.weapon.faction === "Standard").length;
  console.log(
    `[items-ingestion] weapon factions — Standard: ${standard.toString()}, Kuva: ${kuva.toString()}, Tenet: ${tenet.toString()}`,
  );

  await upsertWarframes(warframes);
  await upsertWeapons(weapons);

  console.log("[items-ingestion] complete");
}

// Allow running as a standalone script
if (process.argv[1]?.endsWith("itemsIngestion.js") === true) {
  await runItemsIngestion().catch((err: unknown) => {
    console.error("[items-ingestion] fatal:", err);
    process.exit(1);
  });
}
