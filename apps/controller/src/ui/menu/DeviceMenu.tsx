import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useNearbyRobots } from "../../robot/use-nearby-robots";
import type { RobotView } from "../../robot/use-robot";
import { Segmented } from "../launcher/inputs";
import { useTheme, useThemedStyles, type Palette, type ThemeName } from "../theme";
import { DebugLog } from "./DebugLog";
import { DeviceList } from "./DeviceList";

const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "dark", label: "☾ Dark" },
  { value: "light", label: "☀ Light" },
];

export interface MenuSettings {
  theme: ThemeName;
  onTheme(theme: ThemeName): void;
  allowDriveDuringRun: boolean;
  onAllowDriveDuringRun(allow: boolean): void;
}

interface Props extends MenuSettings {
  visible: boolean;
  onClose(): void;
  robot: RobotView;
}

/** Devices, settings and the debug log. The caller centres the stick and blocks firing while it is open. */
export function DeviceMenu({ visible, onClose, robot, ...settings }: Props) {
  const styles = useThemedStyles(createStyles);
  // A scan replaces ble-plx's single scan slot, so it must not run while connect is scanning for its robot.
  const idle = robot.status === "connected" || robot.status === "disconnected";
  const nearby = useNearbyRobots(visible && idle);
  return (
    <Modal visible={visible} transparent animationType="fade" supportedOrientations={["landscape"]} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>DEVICE MENU</Text>
            <Pressable style={styles.close} onPress={onClose} hitSlop={8} accessibilityLabel="Close menu">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.columns}>
            <DeviceList robot={robot} nearby={nearby} />
            <SettingsColumn {...settings} />
            <DebugLog />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SettingsColumn({ theme, onTheme, allowDriveDuringRun, onAllowDriveDuringRun }: MenuSettings) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.settings}>
      <View style={styles.header}>
        <Text style={styles.heading}>SETTINGS</Text>
      </View>
      <Text style={styles.label}>Theme</Text>
      <Segmented options={THEME_OPTIONS} selected={theme} onSelect={onTheme} />
      <View style={styles.switchRow}>
        <Text style={styles.label}>Allow driving during runs</Text>
        <Switch
          value={allowDriveDuringRun}
          onValueChange={onAllowDriveDuringRun}
          trackColor={{ true: palette.accent, false: palette.track }}
          accessibilityLabel="Allow driving during runs"
        />
      </View>
      <Text style={styles.caption}>Untested: the stock app never drives during a run. Firing still needs the robot stopped.</Text>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 56, paddingVertical: 14 },
    sheet: {
      flex: 1,
      padding: 12,
      gap: 8,
      borderRadius: 16,
      backgroundColor: palette.panel,
      borderWidth: 2,
      borderColor: palette.panelBorder,
    },
    titleRow: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { color: palette.text, fontSize: 15, fontWeight: "800", letterSpacing: 2 },
    // A large, easy close target (owner request): 48 pt circle, well above the 44 pt minimum.
    close: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: palette.accent },
    closeText: { color: palette.onAccent, fontSize: 24, fontWeight: "800", lineHeight: 26 },
    columns: { flex: 1, flexDirection: "row", gap: 14 },
    settings: { flex: 1, gap: 8 },
    header: { height: 28, justifyContent: "center" },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
    label: { color: palette.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
    caption: { color: palette.textMuted, fontSize: 11, lineHeight: 15 },
  });
}
