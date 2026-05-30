/**
 * Oracle session store.
 *
 * Chat history is volatile — it lives only for the duration of the active
 * session and is not persisted to SQLite or SecureStore. Zustand is the
 * right tool here: lightweight, no async middleware needed.
 */

import { create } from "zustand";
import type { OracleMessage, OracleResponsePayload } from "@parazon/types";

export interface OracleTurn {
  /** Unique key for FlatList rendering. */
  readonly id: string;
  readonly role: "user" | "assistant" | "error";
  /**
   * User turns: plain text string.
   * Assistant turns: parsed OracleResponsePayload.
   * Error turns: plain text error message string.
   */
  readonly payload: string | OracleResponsePayload;
}

interface OracleState {
  turns: OracleTurn[];
  isLoading: boolean;
  /** The message text of the last failed request, available for retry. */
  lastFailedMessage: string | null;

  addUserTurn: (id: string, message: string) => void;
  addAssistantTurn: (id: string, payload: OracleResponsePayload) => void;
  addErrorTurn: (id: string, message: string) => void;
  setLoading: (value: boolean) => void;
  setLastFailedMessage: (message: string | null) => void;
  clearSession: () => void;

  /** Returns the turn history in the format the API expects. */
  getApiHistory: () => OracleMessage[];
}

export const useOracleStore = create<OracleState>()((set, get) => ({
  turns: [],
  isLoading: false,
  lastFailedMessage: null,

  addUserTurn: (id, message) =>
    set((s) => ({
      turns: [...s.turns, { id, role: "user", payload: message }],
    })),

  addAssistantTurn: (id, payload) =>
    set((s) => ({
      turns: [...s.turns, { id, role: "assistant", payload }],
    })),

  addErrorTurn: (id, message) =>
    set((s) => ({
      turns: [...s.turns, { id, role: "error", payload: message }],
    })),

  setLoading: (value) => set({ isLoading: value }),

  setLastFailedMessage: (message) => set({ lastFailedMessage: message }),

  clearSession: () => set({ turns: [], isLoading: false, lastFailedMessage: null }),

  getApiHistory: () => {
    return get()
      .turns
      .filter((turn): turn is OracleTurn & { role: "user" | "assistant" } =>
        turn.role === "user" || turn.role === "assistant",
      )
      .map((turn) => ({
        role: turn.role,
        content:
          typeof turn.payload === "string"
            ? turn.payload
            : JSON.stringify(turn.payload),
      }));
  },
}));
