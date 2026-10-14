import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { deviceRows, rssiBars, type DeviceRow } from "../../robot/device-list";
import type { RobotView } from "../../robot/use-robot";
import type { NearbyRobots } from "../../robot/use-nearby-robots";
import type { SavedRobot } from "../../storage/settings";
import { FitText } from "../text/FitText";
import { useThemedStyles, type Palette } from "../theme";

export interface DeviceListProps {
  robot: RobotView;
  nearby: NearbyRobots;
  /** Only the web list uses it, for its one-tap reconnect. */
  lastRobot: SavedRobot | null;
  style?: StyleProp<ViewStyle>;
}

function statusLine(robot: RobotView, nearby: NearbyRobots, empty: boolean): string | null {
  if (robot.status === "scanning" || robot.status === "connecting") return "Connecting…";
  if (nearby.error) return nearby.error;
  if (robot.status === "disconnected" && robot.detail) return robot.detail;
  return empty ? "Looking for robots…" : null;
}

/** Nearby robots, strongest first; tap one to connect (switching from the current one). */
export function DeviceList({ robot, nearby, style }: DeviceListProps) {
  const styles = useThemedStyles(createStyles);
  const rows = deviceRows(nearby.robots, robot.current);
  const busy = robot.status === "scanning" || robot.status === "connecting";
  const status = statusLine(robot, nearby, rows.length === 0);
  return (
    <View style={[styles.column, style]}>
      <View style={styles.header}>
        <Text style={styles.heading}>DEVICES</Text>
      </View>
      {status !== null && <Text style={styles.status}>{status}</Text>}
      <ScrollView contentContainerStyle={styles.rows}>
        {rows.map((row) => (
          <DeviceRowView key={row.id} row={row} busy={busy} robot={robot} />
        ))}
      </ScrollView>
    </View>
  );
}

function DeviceRowView({ row, busy, robot }: { row: DeviceRow; busy: boolean; robot: RobotView }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.row, row.connected && styles.rowConnected]}>
      <Pressable
        style={styles.pick}
        disabled={busy || row.connected}
        onPress={() => robot.connectTo({ id: row.id, name: row.name })}
        accessibilityLabel={`Connect to ${row.name}`}
      >
        <SignalBars bars={rssiBars(row.rssi)} />
        <FitText text={row.name} style={styles.name} />
        {row.connected && <Text style={styles.badge}>connected</Text>}
      </Pressable>
      {row.connected && (
        <Pressable style={styles.disconnect} onPress={robot.disconnect} hitSlop={6}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </Pressable>
      )}
    </View>
  );
}

const BAR_HEIGHTS = [5, 8, 11, 14];

function SignalBars({ bars }: { bars: number }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.bars} accessibilityLabel={`Signal ${bars} of 4`}>
      {BAR_HEIGHTS.map((height, index) => (
        <View key={height} style={[styles.bar, { height }, index < bars ? styles.barOn : styles.barOff]} />
      ))}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    column: { flex: 1.2, gap: 6 },
    header: { height: 28, justifyContent: "center" },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
    status: { color: palette.textMuted, fontSize: 12, fontWeight: "600" },
    rows: { gap: 6 },
    row: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: palette.page,
    },
    pick: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 },
    rowConnected: { borderWidth: 2, borderColor: palette.ring },
    name: { flex: 1, color: palette.text, fontSize: 13, fontWeight: "700" },
    badge: { color: palette.linkOk, fontSize: 11, fontWeight: "800" },
    disconnect: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.danger,
    },
    disconnectText: { color: palette.text, fontSize: 12, fontWeight: "700" },
    bars: { width: 22, height: 14, flexDirection: "row", alignItems: "flex-end", gap: 2 },
    bar: { width: 4, borderRadius: 1 },
    barOn: { backgroundColor: palette.text },
    barOff: { backgroundColor: palette.textMuted, opacity: 0.35 },
  });
}
