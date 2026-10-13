import {
  LineDecoder,
  NUS_NOTIFY,
  NUS_SERVICE,
  NUS_WRITE,
  lineText,
  type Request,
} from "../../../tools/drive-probe/src/protocol.js";
import { writeModeFor, type Link } from "./link.js";

// The slice of Web Bluetooth this uses, so tests can pass a fake navigator.bluetooth.
export interface BleCharacteristic extends EventTarget {
  readonly value?: DataView | null;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
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

export interface BluetoothLike {
  requestDevice(options: { filters: { services: string[] }[]; optionalServices: string[] }): Promise<BleDevice>;
}

/** protocol.ts holds noble-style hex; Web Bluetooth only accepts the dashed lowercase form. */
export function dashedUuid(hex: string): string {
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5").toLowerCase();
}

export const NUS = {
  service: dashedUuid(NUS_SERVICE),
  write: dashedUuid(NUS_WRITE),
  notify: dashedUuid(NUS_NOTIFY),
};

export function bluetoothOf(nav: Navigator): BluetoothLike | null {
  return (nav as Navigator & { bluetooth?: BluetoothLike }).bluetooth ?? null;
}

/** Opens the browser's device chooser, so it must run inside a user gesture (the Connect click). */
export async function requestBleLink(bluetooth: BluetoothLike): Promise<BrowserBleLink> {
  const device = await bluetooth.requestDevice({
    filters: [{ services: [NUS.service] }],
    optionalServices: [NUS.service],
  });
  if (!device.gatt) throw new Error("This device has no GATT server");
  const server = await device.gatt.connect();
  try {
    const service = await server.getPrimaryService(NUS.service);
    const writer = await service.getCharacteristic(NUS.write);
    const notifier = await service.getCharacteristic(NUS.notify);
    await notifier.startNotifications();
    return new BrowserBleLink(device, writer, notifier);
  } catch (error) {
    server.disconnect();
    throw error;
  }
}

export class BrowserBleLink implements Link {
  readonly name: string;
  private readonly decoder = new LineDecoder();
  private readonly encoder = new TextEncoder();
  // GATT allows one operation at a time; overlapping writes reject with "GATT operation already in progress".
  private queue: Promise<void> = Promise.resolve();
  private connected = true;

  constructor(
    private readonly device: BleDevice,
    private readonly writer: BleCharacteristic,
    private readonly notifier: BleCharacteristic,
  ) {
    this.name = device.name ?? device.id;
    device.addEventListener("gattserverdisconnected", () => (this.connected = false));
  }

  send(request: Request): Promise<void> {
    if (!this.connected) return Promise.reject(new Error("Robot is disconnected"));
    const bytes = this.encoder.encode(lineText(request));
    const mode = writeModeFor(request);
    // A failed write must not jam the queue: the next motion resend follows 50 ms later.
    const write = this.queue
      .catch(() => undefined)
      .then(() =>
        mode === "withResponse"
          ? this.writer.writeValueWithResponse(bytes)
          : this.writer.writeValueWithoutResponse(bytes),
      );
    this.queue = write;
    return write;
  }

  onLine(listener: (line: string) => void): void {
    this.notifier.addEventListener("characteristicvaluechanged", (event) => {
      const value = (event.target as BleCharacteristic).value;
      if (value) this.decoder.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).forEach(listener);
    });
  }

  onDisconnect(listener: () => void): void {
    this.device.addEventListener("gattserverdisconnected", () => listener());
  }

  async close(): Promise<void> {
    this.connected = false;
    this.device.gatt?.disconnect();
  }
}
