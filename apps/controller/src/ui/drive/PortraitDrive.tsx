import { StyleSheet, Text, View } from "react-native";
import type { ColumnLayout } from "../layout";
import { FIRE_GUARD, HEADER, HEADER_GAP, WORDMARK_HEIGHT } from "../layout-portrait";
import { useThemedStyles, type Palette } from "../theme";
import type { DriveProps } from "./DriveScreen";
import { KeysHelp } from "./KeysHelp";
import { LauncherPanel } from "./LauncherPanel";
import { StickGroup } from "./StickGroup";
import { ConnectionChip, RunChip } from "./TopBar";

/**
 * Portrait: the header on top, the wordmark, the launcher, then the switch and the stick near the bottom where the
 * thumb rests. Most spare height goes under the stick, a little around the wordmark; the switch keeps Fire clear.
 */
export function PortraitDrive({ layout, ...props }: DriveProps & { layout: ColumnLayout }) {
  const styles = useThemedStyles(createStyles);
  const { robot } = props;
  return (
    <>
      <View style={styles.header}>
        <View style={styles.chip}>
          <ConnectionChip robot={robot} robotName={props.robotName} onOpenMenu={props.onOpenMenu} />
        </View>
        <KeysHelp />
        <RunChip launch={robot.launch} onStop={robot.stopRun} />
      </View>
      <View style={[styles.spacer, { height: layout.spacerTop }]}>
        {layout.wordmark && <Text style={styles.wordmark}>ACEMATE</Text>}
      </View>
      <LauncherPanel robot={robot} shot={props.shot} onShot={props.onShot} hold={props.hold} layout={layout} />
      <StickGroup {...props} size={layout.column} knob={layout.knob} width={layout.stickWidth} style={styles.stick} />
      <View style={styles.bottom} />
    </>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    header: { height: HEADER, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: HEADER_GAP },
    // The chip gives way first, so Keys and the run chip always fit beside it.
    chip: { flexShrink: 1, minWidth: 0 },
    spacer: { alignItems: "center", justifyContent: "center" },
    wordmark: {
      color: palette.wordmark,
      fontSize: 20,
      lineHeight: WORDMARK_HEIGHT,
      fontWeight: "800",
      letterSpacing: 6,
    },
    // Takes the spare height under the stick (layout.spacerBottom), absorbing any rounding.
    bottom: { flex: 1 },
    stick: { alignSelf: "center", marginTop: FIRE_GUARD },
  });
}
