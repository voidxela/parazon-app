/**
 * Oracle screen — AI-driven loadout consultant.
 *
 * Architecture:
 *   - Chat history is managed by useOracleStore (Zustand, session-volatile).
 *   - Input is a controlled useState value — reliable clear/reset on send.
 *   - Each turn renders as: UserBubble | AssistantTurn | ErrorTurn.
 *   - ErrorTurn shows a crimson-accented error card with a Retry button that
 *     re-submits the last failed message without re-adding a user bubble.
 *   - The API call uses the Clerk session token from useAuth().
 */

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/expo";
import { ulid } from "ulid";
import { Colors } from "@/constants/theme";
import { useOracleStore } from "@/store";
import { LoadoutCard } from "@/components/oracle/LoadoutCard";
import type { OracleTurn } from "@/store";
import type { OracleChatRequest, OracleResponsePayload, OracleLoadoutResponse } from "@parazon/types";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

// ── Type guard ────────────────────────────────────────────────────────────────

function isLoadoutResponse(payload: OracleResponsePayload): payload is OracleLoadoutResponse {
  return payload.type === "loadout";
}

// ── Shared API call ───────────────────────────────────────────────────────────

interface SendMessageParams {
  message: string;
  history: ReturnType<typeof useOracleStore.getState>["getApiHistory"] extends () => infer R ? R : never;
  token: string;
}

async function callOracleApi(params: SendMessageParams): Promise<OracleResponsePayload> {
  const requestBody: OracleChatRequest = {
    message: params.message,
    history: params.history,
  };

  const res = await fetch(`${API_BASE}/api/oracle/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status.toString()}: ${errText}`);
  }

  const data = await res.json() as { response: OracleResponsePayload };
  return data.response;
}

// ── Turn renderers ────────────────────────────────────────────────────────────

function UserBubble({ text }: { readonly text: string }) {
  return (
    <View style={styles.userBubbleWrapper}>
      <View style={styles.userBubble}>
        <Text style={styles.userBubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function AssistantTurn({ payload }: { readonly payload: OracleResponsePayload }) {
  if (isLoadoutResponse(payload)) {
    return (
      <View style={styles.assistantWrapper}>
        <LoadoutCard data={payload} />
      </View>
    );
  }
  return (
    <View style={styles.assistantWrapper}>
      <View style={styles.assistantBubble}>
        <Text style={styles.assistantBubbleText}>{payload.content}</Text>
      </View>
    </View>
  );
}

function ErrorTurn({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <View style={styles.assistantWrapper}>
      <View style={styles.errorBubble}>
        <View style={styles.errorHeader}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorLabel}>ORACLE ERROR</Text>
        </View>
        <Text style={styles.errorText}>{message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} accessibilityLabel="Retry">
          <Text style={styles.retryButtonText}>RETRY</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ThinkingIndicator() {
  return (
    <View style={styles.assistantWrapper}>
      <View style={styles.thinkingBubble}>
        <ActivityIndicator size="small" color={Colors.accent.cyan} />
        <Text style={styles.thinkingText}>Oracle is thinking…</Text>
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>◈</Text>
      <Text style={styles.emptyTitle}>ORACLE</Text>
      <Text style={styles.emptySubtitle}>
        Ask about builds, damage types, mission strategies, or the current world state.
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OracleScreen() {
  const { getToken } = useAuth();
  const {
    turns,
    isLoading,
    lastFailedMessage,
    addUserTurn,
    addAssistantTurn,
    addErrorTurn,
    setLoading,
    setLastFailedMessage,
    clearSession,
    getApiHistory,
  } = useOracleStore();

  // Controlled input — reliable clear and consistent with React Native patterns
  const [inputText, setInputText] = useState("");
  const listRef = useRef<FlatList<OracleTurn>>(null);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  // Core send logic, shared between the send button and the Retry button.
  // When retrying, we pass the failed message directly and skip adding a new
  // user bubble (the original user bubble is already in the turn list).
  const dispatchMessage = useCallback(
    async (message: string, addUserBubble: boolean) => {
      if (!message || isLoading) return;

      const history = getApiHistory();

      if (addUserBubble) {
        addUserTurn(ulid(), message);
      }
      setLastFailedMessage(null);
      setLoading(true);
      setTimeout(scrollToBottom, 50);

      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");

        const response = await callOracleApi({ message, history, token });
        addAssistantTurn(ulid(), response);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "Unknown error";
        setLastFailedMessage(message);
        addErrorTurn(ulid(), errMessage);
      } finally {
        setLoading(false);
        setTimeout(scrollToBottom, 50);
      }
    },
    [
      isLoading,
      getApiHistory,
      addUserTurn,
      addAssistantTurn,
      addErrorTurn,
      setLoading,
      setLastFailedMessage,
      scrollToBottom,
      getToken,
    ],
  );

  const handleSend = useCallback(() => {
    const message = inputText.trim();
    if (!message) return;
    setInputText("");
    void dispatchMessage(message, true);
  }, [inputText, dispatchMessage]);

  const handleRetry = useCallback(() => {
    if (!lastFailedMessage) return;
    void dispatchMessage(lastFailedMessage, false);
  }, [lastFailedMessage, dispatchMessage]);

  const renderTurn = useCallback(
    ({ item }: { item: OracleTurn }) => {
      if (item.role === "user") {
        return <UserBubble text={item.payload as string} />;
      }
      if (item.role === "error") {
        return <ErrorTurn message={item.payload as string} onRetry={handleRetry} />;
      }
      return <AssistantTurn payload={item.payload as OracleResponsePayload} />;
    },
    [handleRetry],
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={turns}
        keyExtractor={(item) => item.id}
        renderItem={renderTurn}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={isLoading ? <ThinkingIndicator /> : null}
        onContentSizeChange={scrollToBottom}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask the Oracle…"
          placeholderTextColor={Colors.text.muted}
          multiline
          maxLength={500}
          value={inputText}
          onChangeText={setInputText}
          editable={!isLoading}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isLoading}
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendButtonText}>▶</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearSession}
          disabled={isLoading || turns.length === 0}
          accessibilityLabel="Clear session"
        >
          <Text
            style={[
              styles.clearButtonText,
              (isLoading || turns.length === 0) && styles.clearButtonDisabled,
            ]}
          >
            ✕
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  listContent: {
    padding: 12,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 36,
    color: Colors.accent.cyan,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.accent.crimson,
    letterSpacing: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    textAlign: "center",
    lineHeight: 19,
  },

  // User bubble
  userBubbleWrapper: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: Colors.accent.gold + "22",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accent.gold + "55",
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: "80%",
  },
  userBubbleText: {
    color: Colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },

  // Assistant bubble (text)
  assistantWrapper: {
    alignItems: "flex-start",
    marginBottom: 10,
  },
  assistantBubble: {
    backgroundColor: Colors.background.elevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: "90%",
  },
  assistantBubbleText: {
    color: Colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },

  // Error bubble
  errorBubble: {
    backgroundColor: Colors.background.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent.crimson + "66",
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent.crimson,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "90%",
    gap: 6,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorIcon: {
    fontSize: 13,
    color: Colors.accent.crimson,
  },
  errorLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accent.crimson,
    letterSpacing: 1.5,
  },
  errorText: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.accent.crimson,
  },
  retryButtonText: {
    color: Colors.accent.crimson,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // Thinking indicator
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.background.elevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  thinkingText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontStyle: "italic",
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.surface,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: Colors.text.primary,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.text.muted,
  },
  sendButtonText: {
    color: Colors.background.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: Colors.text.secondary,
    fontSize: 16,
  },
  clearButtonDisabled: {
    color: Colors.text.muted,
  },
});
