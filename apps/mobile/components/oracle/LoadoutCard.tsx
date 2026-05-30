/**
 * LoadoutCard
 *
 * Renders a structured loadout recommendation from the Oracle.
 * Displays warframe, weapon slots, mod lists per slot, and mechanical notes.
 */

import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";
import type { OracleLoadoutResponse } from "@parazon/types";

interface Props {
  readonly data: OracleLoadoutResponse;
}

interface SlotRowProps {
  readonly label: string;
  readonly value: string | null;
  readonly mods: readonly string[];
  readonly accentColor: string;
}

function SlotRow({ label, value, mods, accentColor }: SlotRowProps) {
  if (!value) return null;
  return (
    <View style={styles.slotRow}>
      <View style={styles.slotHeader}>
        <View style={[styles.slotDot, { backgroundColor: accentColor }]} />
        <Text style={styles.slotLabel}>{label}</Text>
        <Text style={[styles.slotValue, { color: accentColor }]}>{value}</Text>
      </View>
      {mods.length > 0 && (
        <View style={styles.modList}>
          {mods.map((mod) => (
            <View key={mod} style={styles.modChip}>
              <Text style={styles.modText}>{mod}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function LoadoutCard({ data }: Props) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>ORACLE LOADOUT</Text>
        <Text style={styles.warframeName}>{data.warframe.toUpperCase()}</Text>
      </View>

      {/* Summary */}
      <Text style={styles.summary}>{data.summary}</Text>

      {/* Warframe mods */}
      {data.mods.warframe.length > 0 && (
        <View style={styles.slotRow}>
          <View style={styles.slotHeader}>
            <View style={[styles.slotDot, { backgroundColor: Colors.accent.crimson }]} />
            <Text style={styles.slotLabel}>WARFRAME MODS</Text>
          </View>
          <View style={styles.modList}>
            {data.mods.warframe.map((mod) => (
              <View key={mod} style={styles.modChip}>
                <Text style={styles.modText}>{mod}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Weapon slots */}
      <SlotRow
        label="PRIMARY"
        value={data.primary}
        mods={data.mods.primary}
        accentColor={Colors.accent.gold}
      />
      <SlotRow
        label="SECONDARY"
        value={data.secondary}
        mods={data.mods.secondary}
        accentColor={Colors.accent.gold}
      />
      <SlotRow
        label="MELEE"
        value={data.melee}
        mods={data.mods.melee}
        accentColor={Colors.accent.gold}
      />

      {/* Notes */}
      {data.notes.length > 0 && (
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>NOTES</Text>
          <Text style={styles.notesText}>{data.notes}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent.cyan + "40", // 25% opacity
    padding: 14,
    gap: 10,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    paddingBottom: 10,
    gap: 2,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accent.cyan,
    letterSpacing: 2,
  },
  warframeName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: 1,
  },
  summary: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  slotRow: {
    gap: 6,
  },
  slotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  slotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.text.muted,
    letterSpacing: 1.5,
  },
  slotValue: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  modList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingLeft: 12,
  },
  modChip: {
    backgroundColor: Colors.background.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  modText: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  notesBlock: {
    backgroundColor: Colors.background.surface,
    borderRadius: 6,
    padding: 10,
    gap: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent.gold,
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.accent.gold,
    letterSpacing: 2,
  },
  notesText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 17,
  },
});
