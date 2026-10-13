import { describe, expect, it, vi } from "vitest";
import { lineText, requests } from "../../../tools/drive-probe/src/protocol.js";
import { runRequests } from "../../../tools/drive-probe/src/launch.js";
import { NUS, dashedUuid, requestBleLink, type BleCharacteristic, type BleDevice, type BluetoothLike } from "../src/ble-link.js";

type Write = { mode: "with" | "without"; text: string };

class FakeCharacteristic extends EventTarget implements BleCharacteristic {
  value: DataView | null = null;
  writes: Write[] = [];
  inFlight = 0;
  maxInFlight = 0;
  notifying = false;
  /** Each write waits on the next entry, if any, so tests control when GATT operations finish. */
  gates: Promise<void>[] = [];

  writeValueWithResponse = (value: BufferSource) => this.write("with", value);
  writeValueWithoutResponse = (value: BufferSource) => this.write("without", value);

  async startNotifications(): Promise<unknown> {
    this.notifying = true;
    return this;
  }

  notify(bytes: Uint8Array): void {
    // Hand over a view into a larger buffer, as browsers may, so a byteOffset bug would show.
    const backing = new Uint8Array(bytes.length + 8);
    backing.set(bytes, 4);
    this.value = new DataView(backing.buffer, 4, bytes.length);
    this.dispatchEvent(new Event("characteristicvaluechanged"));
  }

  private async write(mode: Write["mode"], value: BufferSource): Promise<void> {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      await (this.gates.shift() ?? Promise.resolve());
      this.writes.push({ mode, text: new TextDecoder().decode(value as Uint8Array) });
    } finally {
      this.inFlight--;
    }
  }
}

function fakeBluetooth() {
  const writer = new FakeCharacteristic();
  const notifier = new FakeCharacteristic();
  const disconnect = vi.fn();
  const chars: Record<string, FakeCharacteristic> = { [NUS.write]: writer, [NUS.notify]: notifier };
  const server = {
    connect: async () => server,
    disconnect,
    getPrimaryService: async (uuid: string) => {
      if (uuid !== NUS.service) throw new Error(`no service ${uuid}`);
      return { getCharacteristic: async (c: string) => chars[c] ?? Promise.reject(new Error(`no characteristic ${c}`)) };
    },
  };
  const device = Object.assign(new EventTarget(), { id: "dev-1", name: "ACEMATE-XXXXX", gatt: server }) as BleDevice;
  const requestDevice = vi.fn(async () => device);
  const bluetooth: BluetoothLike = { requestDevice };
  return { bluetooth, requestDevice, device, writer, notifier, disconnect, chars };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("connecting", () => {
  it("asks for NUS devices in Web Bluetooth's dashed UUID form and subscribes to notifications", async () => {
    const fake = fakeBluetooth();

    const link = await requestBleLink(fake.bluetooth);

    expect(fake.requestDevice).toHaveBeenCalledWith({
      filters: [{ services: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"] }],
      optionalServices: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"],
    });
    expect(fake.notifier.notifying).toBe(true);
    expect(link.name).toBe("ACEMATE-XXXXX");
  });

  it("drops the GATT connection if the robot lacks a characteristic", async () => {
    const fake = fakeBluetooth();
    delete fake.chars[NUS.notify];

    await expect(requestBleLink(fake.bluetooth)).rejects.toThrow(/no characteristic/);
    expect(fake.disconnect).toHaveBeenCalled();
  });

  it("converts noble hex UUIDs to the dashed form", () => {
    expect(dashedUuid("6E400002B5A3F393E0A9E50E24DCCA9E")).toBe("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
  });
});

describe("writing", () => {
  it("never starts a GATT write while another is in flight, and keeps order", async () => {
    const fake = fakeBluetooth();
    const link = await requestBleLink(fake.bluetooth);
    const slow = deferred();
    fake.writer.gates.push(slow.promise);

    const sends = [link.send(runRequests.start()), link.send(requests.motion("go_front")), link.send(requests.heartbeat())];
    await Promise.resolve();
    slow.resolve();
    await Promise.all(sends);

    expect(fake.writer.maxInFlight).toBe(1);
    expect(fake.writer.writes.map((w) => JSON.parse(w.text).type)).toEqual(["run_start", "motion_control", "ask_heartbeat"]);
  });

  it("sends motion without response and launcher, time and init commands with response", async () => {
    const fake = fakeBluetooth();
    const link = await requestBleLink(fake.bluetooth);
    const setTime = { type: "set_time", data: { unix_timestamp: 1 } };

    for (const request of [requests.motion("stop"), runRequests.stop(), setTime, requests.askInit()]) await link.send(request);

    expect(fake.writer.writes.map((w) => w.mode)).toEqual(["without", "with", "with", "with"]);
    expect(fake.writer.writes[0]?.text).toBe(lineText(requests.motion("stop")));
  });

  it("keeps writing after one write fails", async () => {
    const fake = fakeBluetooth();
    const link = await requestBleLink(fake.bluetooth);
    fake.writer.gates.push(Promise.reject(new Error("GATT operation failed")));

    const failed = link.send(requests.motion("go_front"));
    const next = link.send(requests.motion("stop"));

    await expect(failed).rejects.toThrow("GATT operation failed");
    await next;
    expect(fake.writer.writes.map((w) => JSON.parse(w.text).data.motion)).toEqual(["stop"]);
  });
});

describe("notifications", () => {
  it("reassembles robot messages split across notifications on the +==ACE==+ marker", async () => {
    const fake = fakeBluetooth();
    const link = await requestBleLink(fake.bluetooth);
    const lines: string[] = [];
    link.onLine((line) => lines.push(line));
    const encode = (text: string) => new TextEncoder().encode(text);

    fake.notifier.notify(encode('{"type":"rsp_init_data","data":{"ro'));
    fake.notifier.notify(encode('bot_id":"X"}}+==AC'));
    fake.notifier.notify(encode('E==+{"type":"rsp_heartbeat"}+==ACE==+'));

    expect(lines).toEqual(['{"type":"rsp_init_data","data":{"robot_id":"X"}}', '{"type":"rsp_heartbeat"}']);
  });
});

describe("disconnect", () => {
  it("calls back when the GATT server drops, and refuses further writes", async () => {
    const fake = fakeBluetooth();
    const link = await requestBleLink(fake.bluetooth);
    const onDisconnect = vi.fn();
    link.onDisconnect(onDisconnect);

    fake.device.dispatchEvent(new Event("gattserverdisconnected"));

    expect(onDisconnect).toHaveBeenCalledOnce();
    await expect(link.send(requests.motion("go_front"))).rejects.toThrow(/disconnected/);
    expect(fake.writer.writes).toEqual([]);
  });

  it("disconnects GATT on close", async () => {
    const fake = fakeBluetooth();
    const link = await requestBleLink(fake.bluetooth);

    await link.close();

    expect(fake.disconnect).toHaveBeenCalledOnce();
  });
});
