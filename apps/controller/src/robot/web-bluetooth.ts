import { NUS_NOTIFY, NUS_SERVICE, NUS_WRITE } from "../shared";
import type { ByteChannel } from "./channel";
import { dashedUuid } from "./uuid";

// The slice of Web Bluetooth this uses, so tests can pass a fake navigator.bluetooth (as apps/web/src/ble-link.ts).
export interface BleCharacteristic extends EventTarget {
  readonly value?: DataView | null;
  writeValueWithResponse(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<unknown>;
}

export interface BleServer {
  connect(): Promise<BleServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BleCharacteristic> }>;
}

export interface BleDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BleServer;
}

export interface DeviceFilter {
  services: string[];
  name?: string;
}

export interface BluetoothLike {
  requestDevice(options: { filters: DeviceFilter[]; optionalServices: string[] }): Promise<BleDevice>;
  getDevices?: unknown;
  requestLEScan?: unknown;
}

export const NUS = {
  service: dashedUuid(NUS_SERVICE),
  write: dashedUuid(NUS_WRITE),
  notify: dashedUuid(NUS_NOTIFY),
};

export const NO_WEB_BLUETOOTH =
  "This browser has no Web Bluetooth. Use Chrome or Edge on desktop or Android, or Bluefy on iPhone.";

export function bluetoothOf(nav: object): BluetoothLike | null {
  const bluetooth = (nav as { bluetooth?: BluetoothLike }).bluetooth;
  return bluetooth ?? null;
}

/**
 * Opens the browser's chooser for NUS robots, or for the one named robot when reconnecting. It must be the first call
 * in a tap handler: an await before it loses the user gesture and Chrome rejects with a SecurityError.
 */
export function requestRobot(bluetooth: BluetoothLike, name?: string): Promise<BleDevice> {
  const filter: DeviceFilter = name ? { services: [NUS.service], name } : { services: [NUS.service] };
  return bluetooth.requestDevice({ filters: [filter], optionalServices: [NUS.service] });
}

async function characteristics(server: BleServer) {
  const service = await server.getPrimaryService(NUS.service);
  const writer = await service.getCharacteristic(NUS.write);
  const notifier = await service.getCharacteristic(NUS.notify);
  await notifier.startNotifications();
  return { writer, notifier };
}

/** Connects GATT and subscribes to NUS notifications; a failure part-way disconnects again. */
export async function openChannel(device: BleDevice): Promise<ByteChannel> {
  if (!device.gatt) throw new Error("This device has no GATT server");
  const server = await device.gatt.connect();
  try {
    const { writer, notifier } = await characteristics(server);
    return new WebBluetoothChannel(device, server, writer, notifier);
  } catch (error) {
    server.disconnect();
    throw error;
  }
}

/**
 * One whole request per GATT write, never chunked. RobotSession serialises the writes, picks the write type and
 * applies the 1 s timeout, exactly as on native.
 */
class WebBluetoothChannel implements ByteChannel {
  readonly name: string;
  maxUnackedWrite?: number;
  private connected = true;

  constructor(
    private readonly device: BleDevice,
    private readonly server: BleServer,
    private readonly writer: BleCharacteristic,
    private readonly notifier: BleCharacteristic,
  ) {
    this.name = device.name ?? device.id;
    device.addEventListener("gattserverdisconnected", () => (this.connected = false));
  }

  write(data: Buffer, withResponse: boolean): Promise<void> {
    if (!this.connected) return Promise.reject(new Error("Robot is disconnected"));
    return withResponse ? this.writer.writeValueWithResponse(data) : this.writer.writeValueWithoutResponse(data);
  }

  onData(listener: (data: Buffer) => void): () => void {
    const handle = () => {
      const value = this.notifier.value;
      if (value) listener(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    };
    this.notifier.addEventListener("characteristicvaluechanged", handle);
    return () => this.notifier.removeEventListener("characteristicvaluechanged", handle);
  }

  onDisconnect(listener: () => void): () => void {
    const handle = () => listener();
    this.device.addEventListener("gattserverdisconnected", handle);
    return () => this.device.removeEventListener("gattserverdisconnected", handle);
  }

  async close(): Promise<void> {
    this.connected = false;
    this.server.disconnect();
  }
}
