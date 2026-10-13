import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SPIN_STYLES, clamp, snapTo, spinStyle, spinValue, type Span, type SpinStyle } from "../../shared";
import { useThemedStyles, type Palette } from "../theme";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  selected: T;
  onSelect(value: T): void;
}

/** The one switch style on the drive screen: Strafe/Turn and spin both use it. */
export function Segmented<T extends string>({ options, selected, onSelect }: SegmentedProps<T>) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const on = option.value === selected;
        return (
          <Pressable key={option.value} style={[styles.segment, on && styles.segmentOn]} onPress={() => onSelect(option.value)}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Short labels keep each segment on one line at drive-screen widths ("Topspin" wrapped on the phone).
const SHORT_SPIN_LABELS: Record<SpinStyle, string> = { slice: "Slice", flat: "Flat", topspin: "Top" };
const SPIN_OPTIONS = SPIN_STYLES.map(({ style }) => ({ value: style, label: SHORT_SPIN_LABELS[style] }));

/** Slice / flat / topspin at each style's coarse value. */
export function SpinSegmented({ spin, onChange }: { spin: number; onChange(spin: number): void }) {
  return <Segmented<SpinStyle> options={SPIN_OPTIONS} selected={spinStyle(spin)} onSelect={(style) => onChange(spinValue(style))} />;
}

function valueAt(fraction: number, span: Span): number {
  return snapTo(span.min + clamp(fraction, 0, 1) * (span.max - span.min), span);
}

interface SliderProps {
  label: string;
  value: number;
  span: Span;
  onChange(value: number): void;
}

// The fill always covers the label zone, so the ink label sits on green and reads in both themes.
const LABEL_ZONE = 76;

/** A horizontal drag slider that fills from the right: dragging left raises the value (the panel sits on the right edge). */
export function HorizontalSlider({ label, value, span, onChange }: SliderProps) {
  const styles = useThemedStyles(createStyles);
  const [trackWidth, setTrackWidth] = useState(1);
  const gesture = useMemo(() => {
    const pick = (x: number) => onChange(valueAt((trackWidth - x) / (trackWidth - LABEL_ZONE), span));
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => pick(event.x))
      .onUpdate((event) => pick(event.x));
  }, [trackWidth, onChange, span]);
  const fraction = (value - span.min) / (span.max - span.min);
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.track}
        accessibilityLabel={`${label} ${value}`}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
      >
        <View style={[styles.fill, { width: LABEL_ZONE + fraction * Math.max(0, trackWidth - LABEL_ZONE) }]} />
        <Text style={styles.label}>
          {label} {value}
        </Text>
      </View>
    </GestureDetector>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    segmented: { flexDirection: "row", alignSelf: "stretch", padding: 3, gap: 3, borderRadius: 10, backgroundColor: palette.track },
    segment: { flex: 1, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
    segmentOn: { backgroundColor: palette.accent },
    segmentText: { color: palette.text, fontSize: 13, fontWeight: "600" },
    segmentTextOn: { color: palette.onAccent, fontWeight: "800" },
    track: { alignSelf: "stretch", height: 32, borderRadius: 10, backgroundColor: palette.track, overflow: "hidden", justifyContent: "center" },
    fill: { position: "absolute", right: 0, top: 0, bottom: 0, backgroundColor: palette.accent },
    label: { position: "absolute", right: 10, color: palette.onAccent, fontSize: 13, fontWeight: "800" },
  });
}
