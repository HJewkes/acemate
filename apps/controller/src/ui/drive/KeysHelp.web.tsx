import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemedStyles, type Palette } from "../theme";
import { useFrame } from "../use-layout";
import { ControlsHelp } from "./ControlsHelp";

/** In the full-window layout, a "Keys" chip; in the laptop frame the side panel shows the controls instead. */
export function KeysHelp() {
  return useFrame() ? null : <KeysChip />;
}

/** A small "Keys" chip that opens a compact list of the keyboard and gamepad controls; any tap closes it. */
function KeysChip() {
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
            <ControlsHelp direction="row" />
          </View>
        </Pressable>
      </Modal>
    </>
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
      padding: 16,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: palette.panelBorder,
      backgroundColor: palette.panel,
    },
  });
}
