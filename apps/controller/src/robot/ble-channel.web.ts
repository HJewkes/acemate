import type * as Native from "./ble-channel";

// Metro picks this file for the web build, so react-native-ble-plx never reaches the browser bundle.
// The Web Bluetooth channel replaces these stubs in the next slice; until then every connect fails politely.
const NOT_YET = "Web Bluetooth link coming next";

export const findRobot: typeof Native.findRobot = () => Promise.reject(new Error(NOT_YET));

export const connectRobot: typeof Native.connectRobot = () => Promise.reject(new Error(NOT_YET));

export const scanRobots: typeof Native.scanRobots = (_onDevice, onError) => {
  onError(new Error(NOT_YET));
  return () => undefined;
};
