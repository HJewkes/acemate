import { DEFAULT_ASSUMPTIONS } from "@acemate/core";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Shot } from "../../launcher/shot";
import type { RobotView } from "../../robot/use-robot";
import { ControlsHelp } from "../drive/ControlsHelp";
import { DebugLog } from "../menu/DebugLog";
import { liveReadout } from "../readout";
import { useThemedStyles, type Palette } from "../theme";
import { useNow } from "../use-clock";

export interface SidePanelProps {
  robot: RobotView;
  shot: Shot;
}

/** Beside the laptop frame: the controls, a live readout and the debug log, so none of them covers the drive screen. */
export function SidePanel({ robot, shot }: SidePanelProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <ControlsHelp direction="column" />
      </View>
      <View style={styles.card}>
        <LiveReadout robot={robot} shot={shot} />
      </View>
      <View style={[styles.card, styles.log]}>
        <DebugLog />
      </View>
    </ScrollView>
  );
}

function LiveReadout({ robot, shot }: SidePanelProps) {
  const styles = useThemedStyles(createStyles);
  const now = useNow(robot.launch.runActive || robot.launch.inFlight);
  const rows = liveReadout(robot, shot, now, DEFAULT_ASSUMPTIONS.flipDirection);
  return (
    <View style={styles.readout}>
      <Text style={styles.heading}>LIVE</Text>
      {rows.map(({ label, value }) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    panel: { flex: 1 },
    content: { flexGrow: 1, gap: 12 },
    card: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: palette.panelBorder,
      backgroundColor: palette.panel,
    },
    // The log takes whatever height the help and readout leave, but never shrinks to nothing.
    log: { flexGrow: 1, minHeight: 220 },
    readout: { gap: 6 },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
    row: { flexDirection: "row", gap: 12 },
    label: { width: 64, color: palette.textMuted, fontSize: 13, fontWeight: "700" },
    value: { flex: 1, color: palette.text, fontSize: 13, fontVariant: ["tabular-nums"] },
  });
}
