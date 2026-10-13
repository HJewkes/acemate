import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { aimToPad, pixelToAim, type Aim } from "@acemate/core";
import { useThemedStyles, type Palette } from "../theme";

interface Props {
  aim: Aim;
  width: number;
  height: number;
  flipDirection: boolean;
  onAim(aim: Aim): void;
}

/** A square pad with a draggable crosshair: across is direction −15..15, up is elevation 10..40. */
export function AimPad({ aim, width, height, flipDirection, onAim }: Props) {
  const styles = useThemedStyles(createStyles);
  const gesture = useMemo(() => {
    const pick = (x: number, y: number) => onAim(pixelToAim(x, y, { width, height }, flipDirection));
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => pick(event.x, event.y))
      .onUpdate((event) => pick(event.x, event.y));
  }, [flipDirection, onAim, width, height]);
  const point = aimToPad(aim, flipDirection);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.pad, { width, height }]}>
        <View style={[styles.axis, { left: width / 2, top: 0, bottom: 0, width: 1 }]} />
        <View style={[styles.axis, { top: height / 2, left: 0, right: 0, height: 1 }]} />
        <View style={[styles.lineX, { top: point.fy * height }]} />
        <View style={[styles.lineY, { left: point.fx * width }]} />
        <View style={[styles.dot, { left: point.fx * width - 9, top: point.fy * height - 9 }]} />
      </View>
    </GestureDetector>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    pad: {
      backgroundColor: palette.panel,
      borderWidth: 1,
      borderColor: palette.gridAxis,
      borderRadius: 10,
      overflow: "hidden",
    },
    axis: { position: "absolute", backgroundColor: palette.grid },
    lineX: { position: "absolute", left: 0, right: 0, height: 1.5, backgroundColor: palette.label },
    lineY: { position: "absolute", top: 0, bottom: 0, width: 1.5, backgroundColor: palette.label },
    dot: {
      position: "absolute",
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 3,
      borderColor: palette.label,
      backgroundColor: palette.accent,
    },
  });
}
