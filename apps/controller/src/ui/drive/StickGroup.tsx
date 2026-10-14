import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { Horizontal, Stick } from "../../control/sticks";
import { Segmented } from "../launcher/inputs";
import { Thumbstick } from "../Thumbstick";

const HORIZONTAL_OPTIONS: { value: Horizontal; label: string; short: string }[] = [
  { value: "strafe", label: "↔ Strafe", short: "↔" },
  { value: "turn", label: "↻ Turn", short: "↻" },
];

export interface StickProps {
  horizontal: Horizontal;
  onHorizontal(horizontal: Horizontal): void;
  onStick(stick: Stick): void;
}

interface Props extends StickProps {
  size: number;
  knob: number;
  width: number;
  style?: StyleProp<ViewStyle>;
}

/** The Strafe / Turn switch over the stick, the same in both arrangements. */
export function StickGroup({ horizontal, onHorizontal, onStick, size, knob, width, style }: Props) {
  return (
    <View style={[styles.group, { width }, style]}>
      <Segmented options={HORIZONTAL_OPTIONS} selected={horizontal} onSelect={onHorizontal} />
      <Thumbstick size={size} knob={knob} onChange={onStick} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10, alignItems: "center" },
});
