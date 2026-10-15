import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { SPIN_STYLES, clamp, snapTo, spinStyle, spinValue, stepBy, type Span, type SpinStyle } from "@acemate/core";
import type { ChipLabel } from "../../launcher/chips";
import { CHIP_LINE, CHIP_PADDING_V, CHIP_TRACK_PADDING } from "../layout";
import { FitText } from "../text/FitText";
import { useThemedStyles, type Palette } from "../theme";

interface SegmentedProps<T extends string> {
  /** `short`, usually the label's icon alone, is drawn when the label will not fit even shrunk. */
  options: { value: T; label: string; short?: string }[];
  selected: T;
  onSelect(value: T): void;
}

/**
 * The one switch style on the drive screen: Strafe/Turn and spin both use it. If any label needs its short form,
 * every label switches to its short form, so the switch reads as all icons or all words.
 */
export function Segmented<T extends string>({ options, selected, onSelect }: SegmentedProps<T>) {
  const styles = useThemedStyles(createStyles);
  const { compact, report } = useShortTogether<T>();
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Segment
          key={option.value}
          option={option}
          on={option.value === selected}
          compact={compact}
          onSelect={onSelect}
          onNeedsShort={report}
        />
      ))}
    </View>
  );
}

/** Collects which labels in a group need their short form; `compact` switches the whole group together. */
export function useShortTogether<T>() {
  const [cramped, setCramped] = useState<ReadonlySet<T>>(() => new Set());
  const report = useCallback((value: T, needsShort: boolean) => {
    setCramped((current) => {
      if (current.has(value) === needsShort) return current;
      const next = new Set(current);
      if (needsShort) next.add(value);
      else next.delete(value);
      return next;
    });
  }, []);
  return { compact: cramped.size > 0, report };
}

interface SegmentProps<T extends string> {
  option: SegmentedProps<T>["options"][number];
  on: boolean;
  compact: boolean;
  onSelect(value: T): void;
  onNeedsShort(value: T, needsShort: boolean): void;
}

function Segment<T extends string>({ option, on, compact, onSelect, onNeedsShort }: SegmentProps<T>) {
  const styles = useThemedStyles(createStyles);
  const { value } = option;
  const report = useCallback((needsShort: boolean) => onNeedsShort(value, needsShort), [onNeedsShort, value]);
  return (
    <Pressable
      style={[styles.segment, on && styles.segmentOn]}
      onPress={() => onSelect(value)}
      accessibilityLabel={option.label}
    >
      <FitText
        text={option.label}
        short={option.short}
        forceShort={compact}
        onNeedsShort={report}
        style={[styles.segmentText, on && styles.segmentTextOn]}
      />
    </Pressable>
  );
}

// Short labels keep each segment on one line at drive-screen widths ("Topspin" wrapped on the phone).
const SHORT_SPIN_LABELS: Record<SpinStyle, string> = { slice: "Slice", flat: "Flat", topspin: "Top" };
const SPIN_OPTIONS = SPIN_STYLES.map(({ style }) => ({ value: style, label: SHORT_SPIN_LABELS[style] }));

/** Slice / flat / topspin at each style's coarse value. */
export function SpinSegmented({ spin, onChange }: { spin: number; onChange(spin: number): void }) {
  return (
    <Segmented<SpinStyle>
      options={SPIN_OPTIONS}
      selected={spinStyle(spin)}
      onSelect={(style) => onChange(spinValue(style))}
    />
  );
}

interface ChipProps {
  /** What the chip sets, for its accessibility label: "Spin", "Balls". */
  name: string;
  label: ChipLabel;
  open: boolean;
  compact: boolean;
  onPress(): void;
  onNeedsShort(needsShort: boolean): void;
}

/** A compact control in the chip row: shows the current value, and opens its popover on a tap. */
export function Chip({ name, label, open, compact, onPress, onNeedsShort }: ChipProps) {
  const styles = useThemedStyles(createStyles);
  const chipStyles = useThemedStyles(createChipStyles);
  return (
    <Pressable
      style={[chipStyles.chip, open && styles.segmentOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${label.label}`}
      accessibilityState={{ expanded: open }}
    >
      <FitText
        text={`${label.label} ${open ? "▴" : "▾"}`}
        short={label.short}
        forceShort={compact}
        onNeedsShort={onNeedsShort}
        style={[styles.segmentText, chipStyles.chipText, open && styles.segmentTextOn]}
      />
    </Pressable>
  );
}

/** Where a popover hangs from, in window coordinates: the chip row's box. */
export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const POPOVER_MIN_WIDTH = 220;
const POPOVER_MARGIN = 8;

function popoverBox(anchor: Anchor, screenWidth: number) {
  const width = Math.min(Math.max(anchor.width, POPOVER_MIN_WIDTH), screenWidth - 2 * POPOVER_MARGIN);
  // Right-aligned to the row, since the launcher sits on the right edge; then kept on screen.
  const left = clamp(anchor.x + anchor.width - width, POPOVER_MARGIN, screenWidth - width - POPOVER_MARGIN);
  return { left, top: anchor.y + anchor.height + 4, width };
}

interface ChipPopoverProps {
  /** Null while closed. */
  anchor: Anchor | null;
  /** Names the dialog for screen readers and gives it a testID. */
  label: string;
  onClose(): void;
  children: ReactNode;
}

/**
 * A chip's options under the chip row. It is a Modal, its own native window, so the aim pad's pan gesture beneath
 * never sees a touch while it is open: a tap anywhere outside lands on the backdrop and only closes it. The Modal
 * needs its own gesture root for the sliders inside it. Turning the screen closes it, since the anchor moves.
 */
export function ChipPopover({ anchor, label, onClose, children }: ChipPopoverProps) {
  const styles = useThemedStyles(createPopoverStyles);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  useEffect(() => onClose, [screenWidth, screenHeight, onClose]);
  return (
    <Modal
      visible={anchor !== null}
      transparent
      animationType="none"
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.popoverRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} focusable={false} accessibilityLabel="Close" />
        {anchor && (
          <View
            role="dialog"
            aria-modal
            aria-label={label}
            testID={`${label.toLowerCase().replace(/\s+/g, "-")}-popover`}
            style={[styles.popover, popoverBox(anchor, screenWidth)]}
          >
            {children}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

interface StepperProps {
  label: string;
  value: number;
  span: Span;
  onChange(value: number): void;
}

/** [−] value [+] across the span; each button greys out at its end. */
export function Stepper({ label, value, span, onChange }: StepperProps) {
  const styles = useThemedStyles(createPopoverStyles);
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <StepButton
        text="−"
        name={`Fewer ${label.toLowerCase()}`}
        disabled={value <= span.min}
        onPress={() => onChange(stepBy(value, -1, span))}
      />
      <Text style={styles.stepperValue} accessibilityLabel={`${label} ${value}`}>
        {value}
      </Text>
      <StepButton
        text="+"
        name={`More ${label.toLowerCase()}`}
        disabled={value >= span.max}
        onPress={() => onChange(stepBy(value, 1, span))}
      />
    </View>
  );
}

function StepButton({
  text,
  name,
  disabled,
  onPress,
}: {
  text: string;
  name: string;
  disabled: boolean;
  onPress(): void;
}) {
  const styles = useThemedStyles(createPopoverStyles);
  return (
    <Pressable
      style={[styles.stepButton, disabled && styles.stepButtonOff]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <Text style={[styles.stepButtonText, disabled && styles.stepButtonTextOff]}>{text}</Text>
    </Pressable>
  );
}

function valueAt(fraction: number, span: Span): number {
  return snapTo(span.min + clamp(fraction, 0, 1) * (span.max - span.min), span);
}

interface SliderProps {
  label: string;
  value: number;
  span: Span;
  onChange(value: number): void;
  /** Written after the value: "Every 4 s". */
  unit?: string;
  /** Greyed out and inert, for a setting that does nothing right now. */
  disabled?: boolean;
  /** Width the fill always covers, so the ink label sits on green; widen it for a longer label. */
  labelZone?: number;
}

// The fill always covers the label zone, so the ink label sits on green and reads in both themes.
const LABEL_ZONE = 76;

interface SliderGesture extends Pick<SliderProps, "span" | "onChange"> {
  trackWidth: number;
  labelZone: number;
  disabled: boolean;
}

function useSliderGesture({ trackWidth, labelZone, span, disabled, onChange }: SliderGesture) {
  return useMemo(() => {
    const pick = (x: number) => onChange(valueAt((trackWidth - x) / (trackWidth - labelZone), span));
    return Gesture.Pan()
      .runOnJS(true)
      .enabled(!disabled)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => pick(event.x))
      .onUpdate((event) => pick(event.x));
  }, [trackWidth, onChange, span, disabled, labelZone]);
}

/** A horizontal drag slider that fills from the right: dragging left raises the value (the panel sits on the right edge). */
export function HorizontalSlider(props: SliderProps) {
  const { label, value, span, onChange, unit, disabled = false, labelZone = LABEL_ZONE } = props;
  const styles = useThemedStyles(createStyles);
  const [trackWidth, setTrackWidth] = useState(1);
  const gesture = useSliderGesture({ trackWidth, labelZone, span, disabled, onChange });
  const fraction = (value - span.min) / (span.max - span.min);
  const text = unit ? `${label} ${value} ${unit}` : `${label} ${value}`;
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.track, disabled && styles.trackOff]}
        testID={`${label.toLowerCase()}-slider`}
        accessibilityLabel={text}
        accessibilityState={{ disabled }}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
      >
        <View style={[styles.fill, { width: labelZone + fraction * Math.max(0, trackWidth - labelZone) }]} />
        <Text style={styles.label}>{text}</Text>
      </View>
    </GestureDetector>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    segmented: {
      flexDirection: "row",
      alignSelf: "stretch",
      padding: CHIP_TRACK_PADDING,
      gap: 3,
      borderRadius: 10,
      backgroundColor: palette.track,
    },
    segment: { flex: 1, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
    segmentOn: { backgroundColor: palette.accent },
    segmentText: { color: palette.text, fontSize: 13, fontWeight: "600" },
    segmentTextOn: { color: palette.onAccent, fontWeight: "800" },
    track: {
      alignSelf: "stretch",
      height: 32,
      borderRadius: 10,
      backgroundColor: palette.track,
      overflow: "hidden",
      justifyContent: "center",
    },
    trackOff: { opacity: 0.4 },
    fill: { position: "absolute", right: 0, top: 0, bottom: 0, backgroundColor: palette.accent },
    label: { position: "absolute", right: 10, color: palette.onAccent, fontSize: 13, fontWeight: "800" },
  });
}

function createPopoverStyles(palette: Palette) {
  return StyleSheet.create({
    popoverRoot: { flex: 1 },
    popover: {
      position: "absolute",
      padding: 10,
      gap: 8,
      borderRadius: 12,
      backgroundColor: palette.panel,
      borderWidth: 2,
      borderColor: palette.ring,
    },
    stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
    stepperLabel: { flex: 1, color: palette.text, fontSize: 13, fontWeight: "700" },
    stepperValue: { minWidth: 28, textAlign: "center", color: palette.text, fontSize: 17, fontWeight: "800" },
    stepButton: {
      width: 44,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accent,
    },
    stepButtonOff: { backgroundColor: palette.disabled },
    stepButtonText: { color: palette.onAccent, fontSize: 20, fontWeight: "800", lineHeight: 22 },
    stepButtonTextOff: { color: palette.onDisabled },
  });
}

function createChipStyles(palette: Palette) {
  return StyleSheet.create({
    chip: {
      flex: 1,
      paddingHorizontal: 6,
      paddingVertical: CHIP_PADDING_V,
      borderRadius: 8,
      alignItems: "center",
      backgroundColor: palette.panel,
    },
    // A fixed line keeps the row at CHIP_ROW whatever the label shrinks to.
    chipText: { lineHeight: CHIP_LINE },
  });
}
