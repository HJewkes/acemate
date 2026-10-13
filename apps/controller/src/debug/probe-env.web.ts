import { bluetoothOf } from "../robot/web-bluetooth";
import type { ProbeEnv } from "./probe";

function hasWriteWithoutResponse(): boolean {
  const characteristic: unknown = Reflect.get(window, "BluetoothRemoteGATTCharacteristic");
  return typeof characteristic === "function" && "writeValueWithoutResponse" in characteristic.prototype;
}

/** Reads the browser's Web Bluetooth support when the page was opened with ?probe=1. */
export function requestedProbe(): ProbeEnv | null {
  if (new URLSearchParams(window.location.search).get("probe") !== "1") return null;
  return {
    userAgent: navigator.userAgent,
    secureContext: window.isSecureContext,
    bluetooth: bluetoothOf(navigator),
    writeWithoutResponse: hasWriteWithoutResponse(),
  };
}
