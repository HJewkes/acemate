import type * as Native from "./ble-channel";
import { NO_WEB_BLUETOOTH, bluetoothOf, openChannel, requestRobot } from "./web-bluetooth";

// Metro picks this file for the web build, so react-native-ble-plx never reaches the browser bundle.

// requestDevice needs a tap, so the web never connects on its own; the device menu offers "Reconnect <name>".
export const AUTO_CONNECT: typeof Native.AUTO_CONNECT = false;

/** Opens the chooser at once, keeping the tap's user gesture: every robot, or only the saved one when reconnecting. */
export const openRobot: typeof Native.openRobot = (prefer, onFound) => {
  const bluetooth = typeof navigator === "undefined" ? null : bluetoothOf(navigator);
  if (!bluetooth) return Promise.reject(new Error(NO_WEB_BLUETOOTH));
  return requestRobot(bluetooth, prefer?.name).then(async (device) => {
    onFound();
    return { id: device.id, channel: await openChannel(device) };
  });
};

// Browsers have no unprompted scan (requestLEScan is unshipped), so the chooser is the scan list.
export const scanRobots: typeof Native.scanRobots = () => () => undefined;
