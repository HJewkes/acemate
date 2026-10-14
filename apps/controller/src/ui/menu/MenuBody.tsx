import { Platform, ScrollView, StyleSheet, View } from "react-native";
import type { NearbyRobots } from "../../robot/use-nearby-robots";
import type { RobotView } from "../../robot/use-robot";
import type { SavedRobot } from "../../storage/settings";
import { DebugLog } from "./DebugLog";
import type { MenuSettings } from "./DeviceMenu";
import { DeviceList } from "./DeviceList";
import { SettingsColumn } from "./SettingsColumn";
import { WriteLimit } from "./WriteLimit";

export interface MenuBodyProps {
  robot: RobotView;
  nearby: NearbyRobots;
  lastRobot: SavedRobot | null;
  settings: MenuSettings;
}

function Log({ settings, stacked }: { settings: MenuSettings; stacked: boolean }) {
  return (
    <DebugLog stacked={stacked}>
      {Platform.OS === "web" && <WriteLimit value={settings.maxUnackedWrite} onChange={settings.onMaxUnackedWrite} />}
    </DebugLog>
  );
}

/** Landscape: devices, settings and the log side by side. */
export function MenuColumns({ robot, nearby, lastRobot, settings }: MenuBodyProps) {
  return (
    <View style={styles.columns}>
      <DeviceList robot={robot} nearby={nearby} lastRobot={lastRobot} />
      <SettingsColumn {...settings} />
      <Log settings={settings} stacked={false} />
    </View>
  );
}

/** Portrait: the same sections one under another, in one scroll. */
export function MenuStack({ robot, nearby, lastRobot, settings }: MenuBodyProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.stack}>
      <DeviceList robot={robot} nearby={nearby} lastRobot={lastRobot} style={styles.section} />
      <SettingsColumn {...settings} style={styles.section} />
      <Log settings={settings} stacked />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  columns: { flex: 1, flexDirection: "row", gap: 14 },
  scroll: { flex: 1 },
  stack: { gap: 20, paddingBottom: 8 },
  // Sections size to their content rather than share the height.
  section: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
});
