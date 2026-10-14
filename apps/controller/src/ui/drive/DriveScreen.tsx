import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { StyleSheet, View } from "react-native";
import type { Shot } from "../../launcher/shot";
import type { HoldFireView } from "../../launcher/use-hold-fire";
import type { RobotView } from "../../robot/use-robot";
import type { Arrangement } from "../layout";
import { useThemedStyles, type Palette } from "../theme";
import { useDriveLayout } from "../use-layout";
import { PortraitDrive } from "./PortraitDrive";
import { RowDrive } from "./RowDrive";
import type { StickProps } from "./StickGroup";

export interface DriveProps extends StickProps {
  robot: RobotView;
  robotName: string;
  onOpenMenu(): void;
  shot: Shot;
  onShot: Dispatch<SetStateAction<Shot>>;
  hold: HoldFireView;
}

interface Props extends DriveProps {
  /** Called when the phone turns between portrait and landscape, which rebuilds the stick under the thumb. */
  onArrangementChange(): void;
}

/** Drive with the stick, aim and fire one ball. Only the stick ever reaches the drive loop. */
export function DriveScreen({ onArrangementChange, ...props }: Props) {
  const styles = useThemedStyles(createStyles);
  const layout = useDriveLayout();
  useOnArrangementChange(layout.arrangement, onArrangementChange);
  const padding = {
    paddingHorizontal: layout.paddingH,
    paddingTop: layout.paddingTop,
    paddingBottom: layout.paddingBottom,
  };
  return (
    <View style={[styles.screen, padding]}>
      {layout.arrangement === "row" ? (
        <RowDrive {...props} layout={layout} />
      ) : (
        <PortraitDrive {...props} layout={layout} />
      )}
    </View>
  );
}

function useOnArrangementChange(arrangement: Arrangement, onChange: () => void) {
  const previous = useRef(arrangement);
  useEffect(() => {
    if (previous.current === arrangement) return;
    previous.current = arrangement;
    onChange();
  }, [arrangement, onChange]);
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.page },
  });
}
