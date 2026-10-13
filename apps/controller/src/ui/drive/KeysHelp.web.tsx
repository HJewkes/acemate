import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { PAD_HELP } from "../../control/gamepad";
import { KEY_HELP } from "../../control/keyboard";
import { useThemedStyles, type Palette } from "../theme";

type HelpRows = readonly { keys: string; action: string }[];

/** A small "Keys" chip that opens a compact list of the keyboard and gamepad controls; any tap closes it. */
export function KeysHelp() {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={styles.chip} onPress={() => setOpen(true)} accessibilityLabel="Show keyboard controls">
        <Text style={styles.chipText}>⌨ Keys</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close keyboard controls">
          <View style={styles.card}>
            <HelpSection title="KEYBOARD" rows={KEY_HELP} />
            <HelpSection title="GAMEPAD" rows={PAD_HELP} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function HelpSection({ title, rows }: { title: string; rows: HelpRows }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {rows.map(({ keys, action }) => (
        <View key={keys} style={styles.row}>
          <Text style={styles.keys}>{keys}</Text>
          <Text style={styles.action}>{action}</Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.panelBorder,
      backgroundColor: palette.panel,
    },
    chipText: { color: palette.textMuted, fontSize: 12, fontWeight: "700" },
    backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" },
    card: {
      flexDirection: "row",
      gap: 24,
      padding: 16,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: palette.panelBorder,
      backgroundColor: palette.panel,
    },
    section: { gap: 6 },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
    row: { flexDirection: "row", gap: 12 },
    keys: { width: 96, color: palette.text, fontSize: 13, fontWeight: "700" },
    action: { color: palette.textMuted, fontSize: 13 },
  });
}
