import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function FissuresScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>VOID FISSURES</Text>
      <Text style={styles.placeholder}>Live fissure tracking coming soon.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  content: { padding: 16 },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00E5FF",
    letterSpacing: 3,
    marginBottom: 16,
  },
  placeholder: { color: "#555", fontSize: 14 },
});
