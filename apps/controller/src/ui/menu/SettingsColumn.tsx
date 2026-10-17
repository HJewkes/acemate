import { ScrollView, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Segmented } from "../launcher/inputs";
import { useTheme, useThemedStyles, type Palette, type ThemeName } from "../theme";
import type { MenuSettings } from "./DeviceMenu";

const THEME_OPTIONS: { value: ThemeName; label: string; short: string }[] = [
  { value: "dark", label: "☾ Dark", short: "☾" },
  { value: "light", label: "☀ Light", short: "☀" },
];

type Props = Pick<
  MenuSettings,
  "theme" | "onTheme" | "allowDriveDuringRun" | "onAllowDriveDuringRun" | "advancedDrive" | "onAdvancedDrive"
> & {
  style?: StyleProp<ViewStyle>;
};

/** Theme, driving during runs and the advanced drive path. */
export function SettingsColumn(props: Props) {
  const { theme, onTheme, allowDriveDuringRun, onAllowDriveDuringRun, advancedDrive, onAdvancedDrive, style } = props;
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.settings, style]}>
      <View style={styles.header}>
        <Text style={styles.heading}>SETTINGS</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Theme</Text>
        <Segmented options={THEME_OPTIONS} selected={theme} onSelect={onTheme} />
        <SwitchRow label="Allow driving during runs" value={allowDriveDuringRun} onChange={onAllowDriveDuringRun} />
        <Text style={styles.caption}>
          Untested: the stock app never drives during a run. Firing still needs the robot stopped.
        </Text>
        <SwitchRow label="Advanced drive (beta)" value={advancedDrive} onChange={onAdvancedDrive} />
        <Text style={styles.caption}>Graded speed and true strafe, one direction at a time; no turning.</Text>
      </ScrollView>
    </View>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.switchRow}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: palette.accent, false: palette.track }}
        accessibilityLabel={label}
      />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    settings: { flex: 1, gap: 8 },
    // The scroll clips its box, and a wrapped caption's trailing space paints just past the text's right edge.
    body: { gap: 8, paddingRight: 6 },
    header: { height: 28, justifyContent: "center" },
    heading: { color: palette.label, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
    label: { color: palette.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
    caption: { color: palette.textMuted, fontSize: 11, lineHeight: 15 },
  });
}
