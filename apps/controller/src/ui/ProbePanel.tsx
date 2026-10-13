import { Pressable, StyleSheet, Text, View } from "react-native";
import { probeLines, type ProbeEnv } from "../debug/probe";
import { useThemedStyles, type Palette } from "./theme";

/** The ?probe=1 report over the drive screen, selectable so it can be copied into a bug note. */
export function ProbePanel({ env, onClose }: { env: ProbeEnv; onClose(): void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>WEB BLUETOOTH PROBE</Text>
      <Text style={styles.mono} selectable>
        {probeLines(env).join("\n")}
      </Text>
      <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Close probe">
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    panel: {
      position: "absolute",
      top: 12,
      left: 12,
      right: 12,
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: palette.panel,
      borderWidth: 2,
      borderColor: palette.panelBorder,
    },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
    mono: { color: palette.text, fontSize: 12, lineHeight: 17, fontFamily: "monospace" },
    close: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.ring,
    },
    closeText: { color: palette.text, fontSize: 12, fontWeight: "700" },
  });
}
