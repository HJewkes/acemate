import { Pressable, StyleSheet, Text, View } from "react-native";
import { runChip } from "../../launcher/run-chip";
import type { LaunchView, LinkStatus, RobotView } from "../../robot/use-robot";
import { useTheme, useThemedStyles, type Palette } from "../theme";
import { useNow } from "../use-clock";

const LINK_TEXT: Record<LinkStatus, string> = {
  connected: "Linked",
  scanning: "Scanning",
  connecting: "Connecting",
  disconnected: "Tap for devices",
};
const LOW_BATTERY = 20;

interface Props {
  robot: RobotView;
  robotName: string;
  onOpenMenu(): void;
}

/** The active run, top right; the connection chip lives under the centre wordmark. */
export function TopBar({ robot }: Pick<Props, "robot">) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.bar}>
      <RunChip launch={robot.launch} onStop={robot.stopRun} />
    </View>
  );
}

function linkColour(status: LinkStatus, palette: Palette): string {
  if (status === "connected") return palette.linkOk;
  return status === "disconnected" ? palette.linkOff : palette.linkBusy;
}

/** Robot name, link and battery; tapping it opens the device menu. */
export function ConnectionChip({ robot, robotName, onOpenMenu }: Props) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  const { status, launch } = robot;
  const battery = status === "connected" ? launch.battery : null;
  return (
    <Pressable style={styles.chip} onPress={onOpenMenu} accessibilityLabel="Open device menu">
      <View style={[styles.dot, { backgroundColor: linkColour(status, palette) }]} />
      <View>
        <Text style={styles.name} numberOfLines={1}>
          {robotName}
        </Text>
        <Text style={styles.caption}>{LINK_TEXT[status]}</Text>
      </View>
      {battery !== null && (
        <Text style={[styles.battery, { color: battery <= LOW_BATTERY ? palette.batteryLow : palette.batteryOk }]}>
          {battery}%
        </Text>
      )}
    </Pressable>
  );
}

function RunChip({ launch, onStop }: { launch: LaunchView; onStop(): void }) {
  const styles = useThemedStyles(createStyles);
  const visible = launch.runActive || launch.inFlight;
  const now = useNow(visible);
  const chip = runChip({ runActive: launch.runActive, inFlight: launch.inFlight, run: launch.run, now });
  if (!chip) return null;
  return (
    <Pressable style={styles.chip} onPress={onStop} accessibilityLabel="Stop run">
      <View>
        <Text style={styles.name}>{chip.mode}</Text>
        <Text style={styles.caption}>{chip.elapsed}</Text>
      </View>
      <View style={styles.stopSquare} />
    </Pressable>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    bar: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
    chip: {
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: palette.panel,
      borderWidth: 2,
      borderColor: palette.panelBorder,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    name: { color: palette.text, fontSize: 13, fontWeight: "700", maxWidth: 150 },
    caption: {
      color: palette.textMuted,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.5,
      fontVariant: ["tabular-nums"],
    },
    battery: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
    stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: palette.danger },
  });
}
