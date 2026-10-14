import type { Dispatch, SetStateAction } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Horizontal, Stick } from "../../control/sticks";
import type { Shot } from "../../launcher/shot";
import type { HoldFireView } from "../../launcher/use-hold-fire";
import type { RobotView } from "../../robot/use-robot";
import { Thumbstick } from "../Thumbstick";
import { useDriveLayout } from "../use-layout";
import { Segmented } from "../launcher/inputs";
import { useThemedStyles, type Palette } from "../theme";
import { KeysHelp } from "./KeysHelp";
import { LauncherPanel } from "./LauncherPanel";
import { ConnectionChip, TopBar } from "./TopBar";

const HORIZONTAL_OPTIONS: { value: Horizontal; label: string; short: string }[] = [
  { value: "strafe", label: "↔ Strafe", short: "↔" },
  { value: "turn", label: "↻ Turn", short: "↻" },
];

interface Props {
  robot: RobotView;
  robotName: string;
  onOpenMenu(): void;
  horizontal: Horizontal;
  onHorizontal(horizontal: Horizontal): void;
  onStick(stick: Stick): void;
  shot: Shot;
  onShot: Dispatch<SetStateAction<Shot>>;
  hold: HoldFireView;
}

/** Drive with the left stick, aim and fire one ball on the right. Only the stick ever reaches the drive loop. */
export function DriveScreen({
  robot,
  robotName,
  onOpenMenu,
  horizontal,
  onHorizontal,
  onStick,
  shot,
  onShot,
  hold,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const layout = useDriveLayout();
  return (
    <View
      style={[
        styles.screen,
        { paddingHorizontal: layout.paddingH, paddingTop: layout.paddingTop, paddingBottom: layout.paddingBottom },
      ]}
    >
      <TopBar robot={robot} />
      <View style={styles.body}>
        <View
          style={[
            styles.stickColumn,
            { width: layout.stickWidth, transform: [{ translateX: layout.nudgeX }, { translateY: layout.nudgeY }] },
          ]}
        >
          <Segmented options={HORIZONTAL_OPTIONS} selected={horizontal} onSelect={onHorizontal} />
          <Thumbstick size={layout.column} knob={layout.knob} onChange={onStick} />
        </View>
        <View style={styles.centre}>
          <Text style={styles.wordmark}>ACEMATE</Text>
          <ConnectionChip robot={robot} robotName={robotName} onOpenMenu={onOpenMenu} />
          <KeysHelp />
        </View>
        <View style={{ transform: [{ translateX: -layout.nudgeX }] }}>
          <LauncherPanel robot={robot} shot={shot} onShot={onShot} hold={hold} layout={layout} />
        </View>
      </View>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.page,
    },
    body: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    // Width and the owner's inward/downward nudges come from computeLayout, so they scale with the screen.
    stickColumn: { gap: 10, alignItems: "center" },
    // Wordmark and device chip as one group, centred vertically on the whole screen (not the body under the top bar).
    centre: { alignItems: "center", gap: 10, transform: [{ translateY: -22 }] },
    wordmark: { color: palette.wordmark, fontSize: 20, fontWeight: "800", letterSpacing: 6 },
  });
}
