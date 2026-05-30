/**
 * Oracle AI consultant types.
 *
 * The Oracle returns structured JSON responses so the client can render
 * rich UI components (e.g. LoadoutCard) rather than plain text.
 */

// ── Chat history ──────────────────────────────────────────────────────────────

export interface OracleMessage {
  readonly role: "user" | "assistant";
  /** Raw JSON string for assistant messages; plain text for user messages. */
  readonly content: string;
}

// ── Request ───────────────────────────────────────────────────────────────────

export interface OracleChatRequest {
  /** The user's current message. */
  readonly message: string;
  /** Prior turns in the session, oldest first. */
  readonly history?: readonly OracleMessage[];
}

// ── Structured response variants ──────────────────────────────────────────────

/**
 * Mod lists keyed by equipment slot.
 * Each array contains display names of recommended mods in priority order.
 */
export interface LoadoutMods {
  readonly warframe: readonly string[];
  readonly primary: readonly string[];
  readonly secondary: readonly string[];
  readonly melee: readonly string[];
}

/**
 * A fully specified loadout recommendation from the Oracle.
 * Rendered as a LoadoutCard component in the mobile client.
 */
export interface OracleLoadoutResponse {
  readonly type: "loadout";
  /** One-sentence rationale for the recommendation. */
  readonly summary: string;
  readonly warframe: string;
  readonly primary: string | null;
  readonly secondary: string | null;
  readonly melee: string | null;
  readonly mods: LoadoutMods;
  /** Additional mechanical context (damage types, ability synergies, etc.). */
  readonly notes: string;
}

/** Plain-text answer for general questions. */
export interface OracleTextResponse {
  readonly type: "text";
  readonly content: string;
}

export type OracleResponsePayload = OracleLoadoutResponse | OracleTextResponse;

// ── API response envelope ─────────────────────────────────────────────────────

export interface OracleChatResponse {
  readonly response: OracleResponsePayload;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
}
