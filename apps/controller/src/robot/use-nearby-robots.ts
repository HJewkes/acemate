import { useEffect, useState } from "react";
import { scanRobots } from "./ble-channel";
import { upsertRobot, type SeenRobot } from "./device-list";

export interface NearbyRobots {
  robots: readonly SeenRobot[];
  error: string | null;
}

/** Scans for robots only while `scanning`; each new scan starts from an empty list so departed robots drop off. */
export function useNearbyRobots(scanning: boolean): NearbyRobots {
  const [robots, setRobots] = useState<readonly SeenRobot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wasScanning, setWasScanning] = useState(scanning);
  if (scanning !== wasScanning) {
    setWasScanning(scanning);
    if (scanning) {
      setRobots([]);
      setError(null);
    }
  }
  useEffect(() => {
    if (!scanning) return;
    const stop = scanRobots(
      (seen) => setRobots((list) => upsertRobot(list, seen)),
      (failure) => setError(failure.message),
    );
    return () => stop();
  }, [scanning]);
  return { robots, error };
}
