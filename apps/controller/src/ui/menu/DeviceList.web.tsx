import { Pressable, StyleSheet, Text, View } from "react-native";
import { MOCK_MODE } from "../../robot/ble-channel.web";
import type { RobotView } from "../../robot/use-robot";
import { NO_WEB_BLUETOOTH, bluetoothOf } from "../../robot/web-bluetooth";
import { FitText } from "../text/FitText";
import { useThemedStyles, type Palette } from "../theme";
import type { DeviceListProps } from "./DeviceList";

function statusLine(robot: RobotView): string | null {
  if (robot.status === "scanning" || robot.status === "connecting") return "Connecting…";
  if (!MOCK_MODE && bluetoothOf(navigator) === null) return NO_WEB_BLUETOOTH;
  return robot.status === "disconnected" && robot.detail ? robot.detail : null;
}

/**
 * The web has no background scan: the browser's chooser lists nearby robots. Each button opens it straight from the
 * tap, since requestDevice needs the user gesture. Reconnect narrows the chooser to the saved robot.
 */
export function DeviceList({ robot, lastRobot, style }: DeviceListProps) {
  const styles = useThemedStyles(createStyles);
  const busy = robot.status === "scanning" || robot.status === "connecting";
  const status = statusLine(robot);
  const reconnect = robot.current === null ? lastRobot : null;
  return (
    <View style={[styles.column, style]}>
      <View style={styles.header}>
        <Text style={styles.heading}>DEVICES</Text>
      </View>
      {status !== null && <Text style={styles.status}>{status}</Text>}
      {robot.current && <ConnectedRow name={robot.current.name} onDisconnect={robot.disconnect} />}
      {reconnect && (
        <Pressable style={styles.action} disabled={busy} onPress={() => robot.connectTo(reconnect)}>
          <Text style={styles.actionText}>Reconnect {reconnect.name}</Text>
        </Pressable>
      )}
      <Pressable style={styles.action} disabled={busy} onPress={() => robot.connectTo(null)}>
        <Text style={styles.actionText}>Choose robot…</Text>
      </Pressable>
    </View>
  );
}

function ConnectedRow({ name, onDisconnect }: { name: string; onDisconnect(): void }) {
  const styles = useThemedStyles(createRowStyles);
  return (
    <View style={styles.row}>
      <FitText text={name} style={styles.name} />
      <Pressable style={styles.disconnect} onPress={onDisconnect} hitSlop={6}>
        <Text style={styles.text}>Disconnect</Text>
      </Pressable>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    column: { flex: 1.2, gap: 6 },
    header: { height: 28, justifyContent: "center" },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
    status: { color: palette.textMuted, fontSize: 12, fontWeight: "600" },
    action: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.ring,
    },
    actionText: { color: palette.text, fontSize: 12, fontWeight: "700" },
  });
}

function createRowStyles(palette: Palette) {
  return StyleSheet.create({
    // A long name pushes Disconnect onto its own line rather than squeezing either.
    row: {
      minHeight: 44,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      paddingVertical: 6,
      gap: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: palette.page,
      borderWidth: 2,
      borderColor: palette.ring,
    },
    name: { flexGrow: 1, color: palette.text, fontSize: 13, fontWeight: "700" },
    disconnect: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.danger,
    },
    text: { color: palette.text, fontSize: 12, fontWeight: "700" },
  });
}
