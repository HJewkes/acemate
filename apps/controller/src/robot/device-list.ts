import type { SavedRobot } from "../storage/settings";

export interface SeenRobot {
  id: string;
  name: string;
  /** dBm from the latest advertisement; null for the connected robot, which stops advertising. */
  rssi: number | null;
}

export interface DeviceRow extends SeenRobot {
  connected: boolean;
}

/** Adds a robot, or updates its name and RSSI; returns the same list when nothing changed, to skip a render. */
export function upsertRobot(list: readonly SeenRobot[], seen: SeenRobot): readonly SeenRobot[] {
  const index = list.findIndex((robot) => robot.id === seen.id);
  if (index < 0) return [...list, seen];
  const known = list[index] as SeenRobot;
  if (known.name === seen.name && known.rssi === seen.rssi) return list;
  return list.map((robot, at) => (at === index ? seen : robot));
}

const strength = (rssi: number | null) => rssi ?? -Infinity;

/** The connected robot first (added if the scan missed it), then strongest signal first. */
export function deviceRows(list: readonly SeenRobot[], connected: SavedRobot | null): DeviceRow[] {
  const rows = list.map((robot) => ({ ...robot, connected: robot.id === connected?.id }));
  if (connected && !rows.some((row) => row.connected)) rows.push({ ...connected, rssi: null, connected: true });
  return rows.sort((a, b) => Number(b.connected) - Number(a.connected) || strength(b.rssi) - strength(a.rssi));
}

// Rough BLE bands: about -60 dBm is beside the phone, -90 is the edge of range.
const BAR_FLOORS = [-90, -80, -70, -60];

/** 0-4 signal bars. */
export function rssiBars(rssi: number | null): number {
  return rssi === null ? 0 : BAR_FLOORS.filter((floor) => rssi >= floor).length;
}
