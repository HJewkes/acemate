import { StyleSheet, Text, View } from "react-native";
import type { ColumnLayout } from "../layout";
import { FIRE_GUARD, HEADER, HEADER_GAP } from "../layout-portrait";
import { useThemedStyles, type Palette } from "../theme";
import type { DriveProps } from "./DriveScreen";
import { KeysHelp } from "./KeysHelp";
import { LauncherPanel } from "./LauncherPanel";
import { StickGroup } from "./StickGroup";
import { ConnectionChip, RunChip } from "./TopBar";

// The wordmark only shows where the spare height can hold it without crowding the header.
const WORDMARK_ROOM = 40;

/**
 * Portrait: the header on top, the launcher below it, then the switch and the stick at the bottom where the thumb
 * rests. Spare height sits above the launcher, so the controls stay low, and the switch keeps Fire clear of the stick.
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
      <View style={styles.spacer}>
        {layout.spacer >= WORDMARK_ROOM && <Text style={styles.wordmark}>ACEMATE</Text>}
      </View>
      <LauncherPanel robot={robot} shot={props.shot} onShot={props.onShot} hold={props.hold} layout={layout} />
      <StickGroup {...props} size={layout.column} knob={layout.knob} width={layout.stickWidth} style={styles.stick} />
    </>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    header: { height: HEADER, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: HEADER_GAP },
    // The chip gives way first, so Keys and the run chip always fit beside it.
    chip: { flexShrink: 1, minWidth: 0 },
    spacer: { flex: 1, alignItems: "center", justifyContent: "center" },
    wordmark: { color: palette.wordmark, fontSize: 20, fontWeight: "800", letterSpacing: 6 },
    stick: { alignSelf: "center", marginTop: FIRE_GUARD },
  });
}
