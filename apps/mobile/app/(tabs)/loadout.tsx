import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function LoadoutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>LOADOUT CONSULTANT</Text>
      <Text style={styles.placeholder}>AI-driven loadout recommendations coming soon.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  content: { padding: 16 },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#E53935",
    letterSpacing: 3,
    marginBottom: 16,
  },
  placeholder: { color: "#555", fontSize: 14 },
});
