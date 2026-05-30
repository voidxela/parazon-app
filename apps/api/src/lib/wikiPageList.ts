/**
 * Curated seed list of Warframe wiki pages to ingest for the Oracle RAG pipeline.
 *
 * Covers the most commonly queried game mechanics, faction weapons, and frames.
 * Extend this list as the Oracle's knowledge base grows.
 *
 * Page titles must match the Fandom wiki URL slug exactly (spaces, not underscores).
 */

export const WIKI_PAGES: readonly string[] = [
  // Core mechanics
  "Damage",
  "Status Effects",
  "Critical Hit",
  "Modding",
  "Void Fissure",
  "Riven Mods",
  "Arcanes",
  "Warframe Abilities",

  // Faction weapon systems — these are distinct and must not be conflated
  "Kuva Lich",
  "Sisters of Parvos",
  "Incarnon",

  // Popular Warframes
  "Saryn",
  "Mesa",
  "Octavia",
  "Wisp",
  "Volt",
  "Rhino",
  "Nidus",
  "Khora",
  "Gara",
  "Revenant",
  "Lavos",
  "Caliban",
  "Citrine",
  "Dagath",
  "Qorvex",
  "Dante",

  // High-tier weapons
  "Bramma",
  "Kuva Bramma",
  "Tenet Arca Plasmor",
  "Tenet Cycron",
  "Kuva Nukor",
  "Phenmor",
  "Laetum",
  "Felarx",
  "Sampotes",
  "Edun",
  "Syam",

  // Open-world / game modes
  "Plains of Eidolon",
  "Orb Vallis",
  "Cambion Drift",
  "Zariman Ten Zero",
  "Duviri Paradox",
  "Sortie",
  "Nightwave",
];
