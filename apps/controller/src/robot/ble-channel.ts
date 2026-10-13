import { Buffer } from "buffer";
import { BleManager, State, type Device } from "react-native-ble-plx";
import { NUS_NOTIFY, NUS_SERVICE, NUS_WRITE } from "../shared";
import type { ByteChannel } from "./channel";
import type { SeenRobot } from "./device-list";
import { dashedUuid } from "./uuid";

const SERVICE = dashedUuid(NUS_SERVICE);
const WRITE = dashedUuid(NUS_WRITE);
const NOTIFY = dashedUuid(NUS_NOTIFY);
// KCP in the stock app assumes 248; iOS negotiates on its own and ignores the request.
const WANTED_MTU = 247;

let manager: BleManager | null = null;
const bleManager = () => (manager ??= new BleManager());

async function waitForPoweredOn(timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Bluetooth is off or not allowed")), timeoutMs);
    const subscription = bleManager().onStateChange((state) => {
      if (state === State.PoweredOn) finish();
      if (state === State.Unauthorized || state === State.Unsupported) finish(new Error(`Bluetooth ${state}`));
    }, true);
    function finish(error?: Error) {
      clearTimeout(timer);
      subscription.remove();
      if (error) reject(error);
      else resolve();
    }
  });
}

// ble-plx runs one scan at a time and a new one replaces the last, so each stop only ends its own scan.
let activeScan = 0;

function startScan(onDevice: (device: Device) => void, onError: (error: Error) => void, allowDuplicates = false): () => void {
  const ble = bleManager();
  const mine = ++activeScan;
  void ble.startDeviceScan([SERVICE], { allowDuplicates }, (error, device) => {
    if (activeScan !== mine) return;
    if (error) onError(error);
    else if (device) onDevice(device);
  });
  return () => {
    if (activeScan !== mine) return;
    activeScan++;
    void ble.stopDeviceScan();
  };
}

const deviceName = (device: Device) => device.localName ?? device.name ?? device.id;

/** Scans for a robot advertising the Nordic UART service: the one with preferId if given, otherwise the first. */
export async function findRobot(timeoutMs = 10_000, preferId?: string): Promise<Device> {
  await waitForPoweredOn(5_000);
  let stop: () => void = () => undefined;
  try {
    return await new Promise<Device>((resolve, reject) => {
      const missing = preferId ? "Robot not found nearby" : "No Acemate found nearby";
      const timer = setTimeout(() => reject(new Error(missing)), timeoutMs);
      const finish = (settle: () => void) => (clearTimeout(timer), settle());
      stop = startScan(
        (device) => {
          if (!preferId || device.id === preferId) finish(() => resolve(device));
        },
        (error) => finish(() => reject(error)),
      );
    });
  } finally {
    stop();
  }
}

/**
 * Reports every advertisement from nearby robots, with live RSSI, until the returned stop is called.
 * Stopping before Bluetooth is ready cancels the scan before it starts.
 */
export function scanRobots(onDevice: (robot: SeenRobot) => void, onError: (error: Error) => void): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;
  waitForPoweredOn(5_000).then(
    () => {
      if (cancelled) return;
      stop = startScan((device) => onDevice({ id: device.id, name: deviceName(device), rssi: device.rssi }), onError, true);
    },
    (error: Error) => {
      if (!cancelled) onError(error);
    },
  );
  return () => {
    cancelled = true;
    stop?.();
  };
}

export async function connectRobot(found: Device): Promise<ByteChannel> {
  const ble = bleManager();
  await ble.connectToDevice(found.id);
  await ble.requestMTUForDevice(found.id, WANTED_MTU).catch(() => found);
  await ble.discoverAllServicesAndCharacteristicsForDevice(found.id);
  return {
    name: deviceName(found),
    async write(data, withResponse) {
      const value = data.toString("base64");
      if (withResponse) await ble.writeCharacteristicWithResponseForDevice(found.id, SERVICE, WRITE, value);
      else await ble.writeCharacteristicWithoutResponseForDevice(found.id, SERVICE, WRITE, value);
    },
    onData(listener) {
      const subscription = ble.monitorCharacteristicForDevice(found.id, SERVICE, NOTIFY, (error, characteristic) => {
        if (!error && characteristic?.value) listener(Buffer.from(characteristic.value, "base64"));
      });
      return () => subscription.remove();
    },
    onDisconnect(listener) {
      const subscription = ble.onDeviceDisconnected(found.id, () => listener());
      return () => subscription.remove();
    },
    async close() {
      await ble.cancelDeviceConnection(found.id).catch(() => undefined);
    },
  };
}
