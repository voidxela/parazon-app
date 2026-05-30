/**
 * Oracle chat route — POST /api/oracle/chat
 *
 * Pipeline per request:
 *   1. Embed the user's query with text-embedding-3-small.
 *   2. Run a vec_distance ANN search against vec_documents to retrieve the
 *      top-k relevant wikitext/item chunks from knowledge_vector.db.
 *   3. Read the live world state from cache.db and format it as plain text.
 *   4. Compose a system prompt containing both the RAG context and the live
 *      world state, then call the OpenAI chat completions API.
 *   5. Return the assistant message as JSON.
 *
 * The route is protected by the Clerk JWT middleware applied at the app level.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { getCacheClient, getVectorDb, fissures, sorties, cycleNodes, nightwaves, nightwaveChallenges } from "@parazon/database";
import { embeddingToBuffer } from "../lib/embeddings.js";
import type { HonoVariables } from "../types.js";
import type { OracleChatRequest, OracleChatResponse } from "@parazon/types";

export const oracleRouter = new Hono<{ Variables: HonoVariables }>();

// ── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small" as const;
const CHAT_MODEL = "gpt-4o-mini" as const;
/** Number of RAG chunks to inject into the context window. */
const TOP_K = 8;
/** Hard cap on characters per chunk to keep the context window manageable. */
const MAX_CHUNK_CHARS = 1200;

// ── OpenAI client ─────────────────────────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set");
  return new OpenAI({ apiKey });
}

// ── World-state context builder ───────────────────────────────────────────────

/**
 * Reads the current world state from cache.db and formats it as a concise
 * plain-text block for injection into the LLM system prompt.
 *
 * This data is NOT vectorised — it is injected directly so the Oracle always
 * has the live game state regardless of when the vector index was last built.
 */
async function buildWorldStateContext(): Promise<string> {
  const db = drizzle(getCacheClient());
  const lines: string[] = ["=== LIVE WARFRAME WORLD STATE ==="];

  // Cycle nodes
  const cycles = await db.select().from(cycleNodes);
  if (cycles.length > 0) {
    lines.push("\nOpen-World Cycles:");
    for (const cycle of cycles) {
      const label =
        cycle.nodeKey === "cetus"
          ? "Cetus (Plains of Eidolon)"
          : cycle.nodeKey === "vallis"
            ? "Orb Vallis (Fortuna)"
            : "Cambion Drift (Necralisk)";
      lines.push(`  ${label}: ${cycle.state} — expires ${cycle.expiry.toISOString()}`);
    }
  }

  // Active fissures (summarised by tier)
  const activeFissures = await db.select().from(fissures);
  if (activeFissures.length > 0) {
    lines.push("\nActive Void Fissures:");
    for (const f of activeFissures) {
      const storm = f.isStorm ? " [Steel Path]" : "";
      lines.push(`  ${f.tier} — ${f.missionType} on ${f.node} (${f.enemy})${storm}`);
    }
  }

  // Sortie
  const activeSorties = await db.select().from(sorties);
  const sortie = activeSorties[0];
  if (sortie) {
    lines.push(`\nSortie: ${sortie.boss} (${sortie.faction})`);
    type SortieVariantRow = { missionType: string; modifier: string; node: string };
    const variants = JSON.parse(sortie.variantsJson) as SortieVariantRow[];
    for (const v of variants) {
      lines.push(`  ${v.missionType} on ${v.node} — ${v.modifier}`);
    }
  }

  // Nightwave challenges
  const activeNightwaves = await db.select().from(nightwaves);
  const nw = activeNightwaves[0];
  if (nw) {
    lines.push(`\nNightwave: Season ${nw.season.toString()} (${nw.tag}), Phase ${nw.phase.toString()}`);
    const challenges = await db
      .select()
      .from(nightwaveChallenges)
      .where(eq(nightwaveChallenges.nightwaveId, nw.id));
    for (const c of challenges) {
      const type = c.isElite ? "Elite" : c.isDaily ? "Daily" : "Weekly";
      lines.push(`  [${type}] ${c.title} — ${c.reputation.toString()} rep`);
    }
  }

  if (lines.length === 1) {
    lines.push("(No live world-state data available — cache may not have synced yet.)");
  }

  return lines.join("\n");
}

// ── RAG retrieval ─────────────────────────────────────────────────────────────

/**
 * Embeds the user query and retrieves the top-k most semantically similar
 * document chunks from knowledge_vector.db using sqlite-vec's vec_distance.
 *
 * The ANN query targets the vec0 virtual table (vec_documents) which Drizzle
 * does not model, so we use the underlying libsql Database directly via
 * db.$client. The sqlite-vec extension is already loaded by getVectorDb().
 */
async function retrieveContext(query: string, client: OpenAI): Promise<string[]> {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
    encoding_format: "float",
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) return [];

  const queryBuffer = embeddingToBuffer(embedding);

  // Use $client (libsql Database) for the raw vec0 ANN query.
  // sqlite-vec's MATCH syntax: WHERE embedding MATCH <blob> AND k = <int>
  const db = getVectorDb();
  const results = db.$client
    .prepare(
      `SELECT d.content
       FROM vec_documents vd
       JOIN documents d ON d.id = vd.document_id
       WHERE vd.embedding MATCH ?
         AND k = ?
       ORDER BY vec_distance(vd.embedding, ?)`,
    )
    .all(queryBuffer, TOP_K, queryBuffer) as Array<{ content: string }>;

  return results.map((r) => r.content.slice(0, MAX_CHUNK_CHARS));
}

// ── System prompt composer ────────────────────────────────────────────────────

function buildSystemPrompt(worldStateContext: string, ragChunks: string[]): string {
  const ragSection =
    ragChunks.length > 0
      ? `=== WARFRAME KNOWLEDGE BASE (${ragChunks.length.toString()} relevant excerpts) ===\n\n` +
        ragChunks.map((chunk, i) => `[${(i + 1).toString()}] ${chunk}`).join("\n\n---\n\n")
      : "=== WARFRAME KNOWLEDGE BASE ===\n(No relevant excerpts found for this query.)";

  return `You are the Oracle, an expert Warframe loadout consultant embedded in the Parazon companion app.

Your role is to provide precise, mechanically accurate advice on Warframe builds, loadouts, and game strategy. You have access to:
1. A curated knowledge base of Warframe wiki content and item stats (injected below).
2. The live current world state of the game (injected below).

RESPONSE FORMAT:
- For loadout recommendations, respond with a JSON object matching this exact schema:
  {
    "type": "loadout",
    "summary": "<one-sentence rationale>",
    "warframe": "<Warframe name>",
    "primary": "<weapon name or null>",
    "secondary": "<weapon name or null>",
    "melee": "<weapon name or null>",
    "mods": {
      "warframe": ["<mod name>", ...],
      "primary": ["<mod name>", ...],
      "secondary": ["<mod name>", ...],
      "melee": ["<mod name>", ...]
    },
    "notes": "<additional mechanical context>"
  }
- For general questions, respond with:
  {
    "type": "text",
    "content": "<your answer>"
  }
- Always respond with valid JSON. Never include markdown code fences around the JSON.
- Base all advice strictly on the knowledge base excerpts provided. Do not hallucinate mod names, damage values, or mechanics not present in the excerpts.

${ragSection}

${worldStateContext}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/oracle/chat
 *
 * Body: OracleChatRequest { message: string; history?: OracleMessage[] }
 * Returns: OracleChatResponse
 */
oracleRouter.post("/chat", async (c) => {
  let body: OracleChatRequest;
  try {
    body = await c.req.json<OracleChatRequest>();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
    throw new HTTPException(400, { message: "message is required" });
  }

  const query = body.message.trim();
  const history = body.history ?? [];

  const openai = getOpenAIClient();

  // Run world-state fetch and RAG retrieval concurrently
  const [worldStateContext, ragChunks] = await Promise.all([
    buildWorldStateContext().catch((err: unknown) => {
      console.error("[oracle] world-state context error:", err);
      return "(World state unavailable.)";
    }),
    retrieveContext(query, openai).catch((err: unknown) => {
      console.error("[oracle] RAG retrieval error:", err);
      return [] as string[];
    }),
  ]);

  const systemPrompt = buildSystemPrompt(worldStateContext, ragChunks);

  // Build message history for the chat completion
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: query },
  ];

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 1024,
  });

  const rawContent = completion.choices[0]?.message.content ?? "{}";

  let parsed: OracleChatResponse["response"];
  try {
    parsed = JSON.parse(rawContent) as OracleChatResponse["response"];
  } catch {
    // If the model returns malformed JSON despite response_format, wrap it
    parsed = { type: "text", content: rawContent };
  }

  const responseBody: OracleChatResponse = {
    response: parsed,
    usage: {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    },
  };

  return c.json(responseBody);
});
