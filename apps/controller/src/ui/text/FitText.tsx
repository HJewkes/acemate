import { Text, type StyleProp, type TextStyle } from "react-native";
import { MIN_SCALE } from "./fit";

export interface FitTextProps {
  text: string;
  /** Drawn instead when even minScale does not fit, usually an icon. Web only; iOS shrinks further. */
  short?: string;
  minScale?: number;
  /** Lines to wrap to as a last resort, at minScale. */
  maxLines?: number;
  /** Draw the short form even if the label fits, so a group of labels can switch together. Web only. */
  forceShort?: boolean;
  /** Told after each measurement whether this label needs its short form. Web only. */
  onNeedsShort?(needsShort: boolean): void;
  style?: StyleProp<TextStyle>;
}

/** A one-line label that shrinks to fit rather than ending in "…". iOS and Android shrink natively. */
export function FitText({ text, minScale = MIN_SCALE, maxLines = 1, style }: FitTextProps) {
  return (
    <Text style={style} numberOfLines={maxLines} adjustsFontSizeToFit minimumFontScale={minScale}>
      {text}
    </Text>
  );
}
