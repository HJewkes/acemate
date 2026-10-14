import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useNearbyRobots } from "../../robot/use-nearby-robots";
import type { RobotView } from "../../robot/use-robot";
import type { SavedRobot, UnackedLimit } from "../../storage/settings";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenArrangement } from "../use-layout";
import { useThemedStyles, type Palette, type ThemeName } from "../theme";
import { MenuColumns, MenuStack } from "./MenuBody";

const SHEET_MARGIN_H = 20;
const SHEET_MARGIN_V = 14;

export interface MenuSettings {
  theme: ThemeName;
  onTheme(theme: ThemeName): void;
  allowDriveDuringRun: boolean;
  onAllowDriveDuringRun(allow: boolean): void;
  maxUnackedWrite: UnackedLimit;
  onMaxUnackedWrite(limit: UnackedLimit): void;
}

interface Props extends MenuSettings {
  visible: boolean;
  onClose(): void;
  robot: RobotView;
  lastRobot: SavedRobot | null;
}

/**
 * Devices, settings and the debug log: three columns in landscape, one scrolling stack in portrait with a Done button
 * at the bottom, in reach of the thumb. The caller centres the stick and blocks firing while it is open.
 */
export function DeviceMenu({ visible, onClose, robot, lastRobot, ...settings }: Props) {
  const styles = useThemedStyles(createStyles);
  // A scan replaces ble-plx's single scan slot, so it must not run while connect is scanning for its robot.
  const idle = robot.status === "connected" || robot.status === "disconnected";
  const nearby = useNearbyRobots(visible && idle);
  const clearance = useSheetClearance();
  const portrait = useScreenArrangement() === "column";
  const body = { robot, nearby, lastRobot, settings };
  return (
    <Modal
      visible={visible}
      transparent
      animationType={portrait ? "slide" : "fade"}
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, clearance]}>
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>DEVICE MENU</Text>
            <Pressable style={styles.close} onPress={onClose} hitSlop={8} accessibilityLabel="Close menu">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {portrait ? <MenuStack {...body} /> : <MenuColumns {...body} />}
          {portrait && (
            <Pressable style={styles.done} onPress={onClose} accessibilityLabel="Done">
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Keeps the sheet clear of the Dynamic Island and home indicator, with a margin where there are none. */
function useSheetClearance() {
  const insets = useSafeAreaInsets();
  const side = Math.max(SHEET_MARGIN_H, insets.left, insets.right);
  return {
    paddingLeft: side,
    paddingRight: side,
    paddingTop: Math.max(SHEET_MARGIN_V, insets.top),
    paddingBottom: Math.max(SHEET_MARGIN_V, insets.bottom),
  };
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
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
    close: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accent,
    },
    closeText: { color: palette.onAccent, fontSize: 24, fontWeight: "800", lineHeight: 26 },
    done: {
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accent,
    },
    doneText: { color: palette.onAccent, fontSize: 15, fontWeight: "800" },
  });
}
