import { ScrollView, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";

export default function ArsenalScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>ARSENAL</Text>
      <Text style={styles.placeholder}>Warframe and weapon management coming soon.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  content: { padding: 16 },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.accent.gold,
    letterSpacing: 3,
    marginBottom: 16,
  },
  placeholder: { color: Colors.text.muted, fontSize: 14 },
});
