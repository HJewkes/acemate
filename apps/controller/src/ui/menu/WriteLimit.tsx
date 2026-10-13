import { StyleSheet, Text, View } from "react-native";
import { UNACKED_LIMITS, type UnackedLimit } from "../../storage/settings";
import { Segmented } from "../launcher/inputs";
import { useThemedStyles, type Palette } from "../theme";

const OPTIONS = UNACKED_LIMITS.map((limit) => ({ value: String(limit), label: `${limit} B` }));

interface Props {
  value: UnackedLimit;
  onChange(limit: UnackedLimit): void;
}

/** Web-only debug control: Android Chrome may keep a 23-byte MTU, where motion must go with response. */
export function WriteLimit({ value, onChange }: Props) {
  const styles = useThemedStyles(createStyles);
  const select = (next: string) => {
    const limit = UNACKED_LIMITS.find((option) => String(option) === next);
    if (limit !== undefined) onChange(limit);
  };
  return (
    <View style={styles.box}>
      <Text style={styles.label}>Max write without response</Text>
      <Segmented options={OPTIONS} selected={String(value)} onSelect={select} />
      <Text style={styles.caption}>Longer lines go with response. Try 20 B if driving fails on Android.</Text>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    box: { gap: 4 },
    label: { color: palette.text, fontSize: 12, fontWeight: "600" },
    caption: { color: palette.textMuted, fontSize: 11, lineHeight: 15 },
  });
}
