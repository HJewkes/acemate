import type { BluetoothLike } from "../robot/web-bluetooth";

/** What the browser offers for Web Bluetooth, read once for the ?probe=1 panel (Bluefy and Android checks). */
export interface ProbeEnv {
  userAgent: string;
  secureContext: boolean;
  bluetooth: BluetoothLike | null;
  /** BluetoothRemoteGATTCharacteristic.prototype has writeValueWithoutResponse. */
  writeWithoutResponse: boolean;
}

const yesNo = (present: boolean) => (present ? "yes" : "no");
const isFunction = (value: unknown) => typeof value === "function";

export function probeLines(env: ProbeEnv): string[] {
  return [
    `secure context: ${yesNo(env.secureContext)}`,
    `navigator.bluetooth: ${yesNo(env.bluetooth !== null)}`,
    `getDevices: ${yesNo(isFunction(env.bluetooth?.getDevices))}`,
    `requestLEScan: ${yesNo(isFunction(env.bluetooth?.requestLEScan))}`,
    `writeValueWithoutResponse: ${yesNo(env.writeWithoutResponse)}`,
    `userAgent: ${env.userAgent}`,
  ];
}
