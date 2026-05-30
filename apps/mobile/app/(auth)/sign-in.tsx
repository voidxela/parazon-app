import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/theme";

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(): Promise<void> {
    if (!signIn) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: identify the user
      const createResult = await signIn.create({ identifier: email });
      if (createResult.error) {
        setError(createResult.error.message ?? "Sign in failed.");
        return;
      }

      // Step 2: submit password
      const passwordResult = await signIn.password({ password });
      if (passwordResult.error) {
        setError(passwordResult.error.message ?? "Incorrect password.");
        return;
      }

      // Step 3: finalize the session
      const finalizeResult = await signIn.finalize();
      if (finalizeResult.error) {
        setError(finalizeResult.error.message ?? "Sign in failed.");
        return;
      }

      router.replace("/(tabs)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PARAZON</Text>
      <Text style={styles.subtitle}>Warframe Companion</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={Colors.text.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={Colors.text.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={() => void handleSignIn()} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={Colors.background.primary} />
        ) : (
          <Text style={styles.buttonText}>SIGN IN</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: Colors.accent.gold,
    letterSpacing: 6,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    letterSpacing: 3,
    marginBottom: 48,
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    height: 48,
    backgroundColor: Colors.background.elevated,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 4,
    paddingHorizontal: 16,
    color: Colors.text.primary,
    marginBottom: 12,
    fontSize: 14,
  },
  error: {
    color: Colors.accent.crimson,
    fontSize: 13,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  button: {
    width: "100%",
    height: 48,
    backgroundColor: Colors.accent.gold,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonText: {
    color: Colors.background.primary,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 2,
  },
});
