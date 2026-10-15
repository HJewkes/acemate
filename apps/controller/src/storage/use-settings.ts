import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type KeyValueStore, type Settings } from "./settings";

interface SettingsView {
  /** Defaults until the stored copy has loaded; `loaded` says which. */
  settings: Settings;
  loaded: boolean;
  update(change: (current: Settings) => Partial<Settings>): void;
}

/** Loads saved settings once, then writes every change back. */
export function useSettings(store: KeyValueStore = AsyncStorage): SettingsView {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    let live = true;
    void loadSettings(store).then((stored) => {
      if (!live) return;
      setSettings(stored);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [store]);

  useEffect(() => {
    if (loaded && dirty.current) void saveSettings(store, settings);
  }, [loaded, settings, store]);

  const update = useCallback((change: (current: Settings) => Partial<Settings>) => {
    dirty.current = true;
    setSettings((current) => ({ ...current, ...change(current) }));
  }, []);

  return { settings, loaded, update };
}
