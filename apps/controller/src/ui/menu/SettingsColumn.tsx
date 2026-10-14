import { StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Segmented } from "../launcher/inputs";
import { useTheme, useThemedStyles, type Palette, type ThemeName } from "../theme";
import type { MenuSettings } from "./DeviceMenu";

const THEME_OPTIONS: { value: ThemeName; label: string; short: string }[] = [
  { value: "dark", label: "☾ Dark", short: "☾" },
  { value: "light", label: "☀ Light", short: "☀" },
];

type Props = Pick<MenuSettings, "theme" | "onTheme" | "allowDriveDuringRun" | "onAllowDriveDuringRun"> & {
  style?: StyleProp<ViewStyle>;
};

/** Theme and driving during runs. */
export function SettingsColumn({ theme, onTheme, allowDriveDuringRun, onAllowDriveDuringRun, style }: Props) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.settings, style]}>
      <View style={styles.header}>
        <Text style={styles.heading}>SETTINGS</Text>
      </View>
      <Text style={styles.label}>Theme</Text>
      <Segmented options={THEME_OPTIONS} selected={theme} onSelect={onTheme} />
      <View style={styles.switchRow}>
        <Text style={styles.label}>Allow driving during runs</Text>
        <Switch
          value={allowDriveDuringRun}
          onValueChange={onAllowDriveDuringRun}
          trackColor={{ true: palette.accent, false: palette.track }}
          accessibilityLabel="Allow driving during runs"
        />
      </View>
      <Text style={styles.caption}>
        Untested: the stock app never drives during a run. Firing still needs the robot stopped.
      </Text>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    settings: { flex: 1, gap: 8 },
    header: { height: 28, justifyContent: "center" },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
    label: { color: palette.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
    caption: { color: palette.textMuted, fontSize: 11, lineHeight: 15 },
  });
}
