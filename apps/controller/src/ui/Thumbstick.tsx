import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { CENTERED, offsetToStick, type Stick } from "../control/sticks";
import { useThemedStyles, type Palette } from "./theme";

interface Props {
  size: number;
  knob: number;
  onChange(stick: Stick): void;
}

/** A fixed-base stick: deflection is the finger's offset from the pad centre, and it springs back on release. */
export function Thumbstick({ size, knob, onChange }: Props) {
  const styles = useThemedStyles(createStyles);
  const [stick, setStick] = useState<Stick>(CENTERED);
  const radius = (size - knob) / 2;
  useCentreOnUnmount(onChange);

  const gesture = useMemo(() => {
    const move = (x: number, y: number) => {
      const next = offsetToStick(x - size / 2, y - size / 2, radius);
      setStick(next);
      onChange(next);
    };
    const release = () => {
      setStick(CENTERED);
      onChange(CENTERED);
    };
    // JS-thread callbacks keep this free of Reanimated; the stick only needs to be as fast as the 50 ms send rate.
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => move(event.x, event.y))
      .onUpdate((event) => move(event.x, event.y))
      .onFinalize(release);
  }, [onChange, size, radius]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.pad, { width: size, height: size, borderRadius: size / 2 }]}
        accessibilityLabel="Drive stick"
        testID="drive-stick"
      >
        <View style={[styles.travel, { width: radius * 2, height: radius * 2, borderRadius: radius }]} />
        <View
          style={[
            styles.knob,
            { width: knob, height: knob, borderRadius: knob / 2 },
            { transform: [{ translateX: stick.x * radius }, { translateY: stick.y * radius }] },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

/** A stick removed mid-drag (the phone turned) never sees the release, so it centres itself on the way out. */
function useCentreOnUnmount(onChange: (stick: Stick) => void) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const send = latest;
    return () => send.current(CENTERED);
  }, []);
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    pad: {
      backgroundColor: palette.panel,
      borderWidth: 3,
      borderColor: palette.ring,
      alignItems: "center",
      justifyContent: "center",
    },
    travel: { position: "absolute", borderWidth: 1, borderColor: palette.grid },
    knob: { backgroundColor: palette.accent, borderWidth: 3, borderColor: palette.knobBorder },
  });
}
