import { StyleSheet, Text, View } from "react-native";
import { PAD_HELP } from "../../control/gamepad";
import { KEY_HELP, type HelpRow } from "../../control/keyboard";
import { useThemedStyles, type Palette } from "../theme";

/** The keyboard and gamepad controls, from the same tables the input code is checked against. */
export function ControlsHelp({ direction }: { direction: "row" | "column" }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.sections, { flexDirection: direction }]}>
      <HelpSection title="KEYBOARD" rows={KEY_HELP} />
      <HelpSection title="GAMEPAD" rows={PAD_HELP} />
    </View>
  );
}

function HelpSection({ title, rows }: { title: string; rows: readonly HelpRow[] }) {
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
    sections: { gap: 24 },
    section: { gap: 6 },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
    row: { flexDirection: "row", gap: 12 },
    keys: { width: 96, color: palette.text, fontSize: 13, fontWeight: "700" },
    action: { flexShrink: 1, color: palette.textMuted, fontSize: 13 },
  });
}
