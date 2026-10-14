import { StyleSheet, Text, View } from "react-native";
import type { RowLayout } from "../layout";
import { useThemedStyles, type Palette } from "../theme";
import type { DriveProps } from "./DriveScreen";
import { KeysHelp } from "./KeysHelp";
import { LauncherPanel } from "./LauncherPanel";
import { StickGroup } from "./StickGroup";
import { ConnectionChip, TopBar } from "./TopBar";

/** Landscape: drive with the left stick, the device chip in the middle, aim and fire on the right. */
export function RowDrive({ layout, ...props }: DriveProps & { layout: RowLayout }) {
  const styles = useThemedStyles(createStyles);
  const { robot } = props;
  const nudge = { transform: [{ translateX: layout.nudgeX }, { translateY: layout.nudgeY }] };
  return (
    <>
      <TopBar robot={robot} />
      <View style={styles.body}>
        <StickGroup {...props} size={layout.column} knob={layout.knob} width={layout.stickWidth} style={nudge} />
        <View style={styles.centre}>
          <Text style={styles.wordmark}>ACEMATE</Text>
          <ConnectionChip robot={robot} robotName={props.robotName} onOpenMenu={props.onOpenMenu} />
          <KeysHelp />
        </View>
        <View style={{ transform: [{ translateX: -layout.nudgeX }] }}>
          <LauncherPanel robot={robot} shot={props.shot} onShot={props.onShot} hold={props.hold} layout={layout} />
        </View>
      </View>
    </>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    body: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    // Wordmark and device chip as one group, centred vertically on the whole screen (not the body under the top bar).
    centre: { alignItems: "center", gap: 10, transform: [{ translateY: -22 }] },
    wordmark: { color: palette.wordmark, fontSize: 20, fontWeight: "800", letterSpacing: 6 },
  });
}
