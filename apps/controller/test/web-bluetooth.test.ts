import { afterEach, describe, expect, it, vi } from "vitest";
import { openRobot } from "../src/robot/ble-channel.web";
import { RobotSession, type RobotMessage } from "../src/robot/session";
import {
  NUS,
  openChannel,
  requestRobot,
  type BleCharacteristic,
  type BleDevice,
  type BluetoothLike,
} from "../src/robot/web-bluetooth";
import { encodeLine, requests } from "../src/shared";
import { flush } from "./harness";

const END = "+==ACE==+";
// A drill set_mode is ~335 bytes, past the 180-byte unacked limit.
const targetShot = { kind: "target", x: 3.2, z: 21, heightLevel: 4, spin: 1 } as const;

type Write = { mode: "with" | "without"; text: string };

// Adapted from apps/web/test/ble-link.test.ts: a GATT characteristic whose writes the test can hold open.
class FakeCharacteristic extends EventTarget implements BleCharacteristic {
  value: DataView | null = null;
  writes: Write[] = [];
  inFlight = 0;
  maxInFlight = 0;
  failNotifications = false;
  /** Each write waits on the next entry, if any, so tests control when GATT operations finish. */
  gates: Promise<void>[] = [];

  writeValueWithResponse = (value: Uint8Array) => this.write("with", value);
  writeValueWithoutResponse = (value: Uint8Array) => this.write("without", value);

  async startNotifications(): Promise<unknown> {
    if (this.failNotifications) throw new Error("notifications refused");
    return this;
  }

  notify(text: string): void {
    // Hand over a view into a larger buffer, as browsers may, so a byteOffset bug would show.
    const bytes = new TextEncoder().encode(text);
    const backing = new Uint8Array(bytes.length + 8);
    backing.set(bytes, 4);
    this.value = new DataView(backing.buffer, 4, bytes.length);
    this.dispatchEvent(new Event("characteristicvaluechanged"));
  }

  private async write(mode: Write["mode"], value: Uint8Array): Promise<void> {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      await (this.gates.shift() ?? Promise.resolve());
      this.writes.push({ mode, text: new TextDecoder().decode(value) });
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
      return {
        getCharacteristic: async (c: string) => chars[c] ?? Promise.reject(new Error(`no characteristic ${c}`)),
      };
    },
  };
  const device: BleDevice = Object.assign(new EventTarget(), { id: "dev-1", name: "ACEMATE-XXXXX", gatt: server });
  const requestDevice = vi.fn(async () => device);
  const bluetooth: BluetoothLike = { requestDevice };
  return { bluetooth, requestDevice, device, writer, notifier, disconnect };
}

async function connected(maxUnackedWrite?: number) {
  const fake = fakeBluetooth();
  const channel = await openChannel(await requestRobot(fake.bluetooth));
  channel.maxUnackedWrite = maxUnackedWrite;
  const messages: RobotMessage[] = [];
  const session = new RobotSession(channel, (message) => messages.push(message));
  await flush();
  return { ...fake, channel, session, messages };
}

const motionWrites = (writes: Write[]) => writes.filter((write) => write.text.includes('"motion_control"'));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("choosing a robot", () => {
  it("opens the chooser for NUS robots, in Web Bluetooth's dashed UUID form", async () => {
    const { bluetooth, requestDevice } = fakeBluetooth();

    await requestRobot(bluetooth);

    expect(NUS.service).toBe("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ services: [NUS.service] }],
      optionalServices: [NUS.service],
    });
  });

  it("narrows the chooser to the saved robot's name when reconnecting", async () => {
    const { bluetooth, requestDevice } = fakeBluetooth();

    await requestRobot(bluetooth, "ACEMATE-XXXXX");

    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ services: [NUS.service], name: "ACEMATE-XXXXX" }],
      optionalServices: [NUS.service],
    });
  });

  it("calls requestDevice before anything is awaited, so the tap still counts as a user gesture", async () => {
    const { bluetooth, requestDevice } = fakeBluetooth();
    vi.stubGlobal("navigator", { bluetooth });
    const onFound = vi.fn();

    const opening = openRobot(null, onFound);
    const calledSynchronously = requestDevice.mock.calls.length;
    const opened = await opening;

    expect(calledSynchronously).toBe(1);
    expect(onFound).toHaveBeenCalledTimes(1);
    expect(opened.id).toBe("dev-1");
    expect(opened.channel.name).toBe("ACEMATE-XXXXX");
  });

  it("explains a browser without Web Bluetooth instead of throwing a TypeError", async () => {
    vi.stubGlobal("navigator", {});

    await expect(openRobot(null, () => undefined)).rejects.toThrow("no Web Bluetooth");
  });

  it("disconnects again when subscribing to notifications fails", async () => {
    const { bluetooth, notifier, disconnect } = fakeBluetooth();
    notifier.failNotifications = true;

    await expect(openChannel(await requestRobot(bluetooth))).rejects.toThrow("notifications refused");
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("write policy, shared with native through RobotSession", () => {
  it("writes a motion line whole, in one write without response", async () => {
    const { session, writer } = await connected();

    session.drive("go_front");
    await flush();

    const line = encodeLine(requests.motion("go_front")).toString("utf8");
    expect(line.length).toBeGreaterThan(20);
    expect(line.length).toBeLessThanOrEqual(180);
    expect(motionWrites(writer.writes)).toEqual([{ mode: "without", text: line }]);
  });

  it("writes a line past 180 bytes whole, in one write with response", async () => {
    const { session, writer } = await connected();

    void session.launch.handle(targetShot);
    await flush();

    const setMode = writer.writes.filter((write) => write.text.includes('"set_mode"'));
    expect(setMode).toHaveLength(1);
    expect(setMode[0]?.mode).toBe("with");
    expect(setMode[0]?.text.length).toBeGreaterThan(180);
  });

  it("sends motion with response when the channel's limit is below the line, as for a 23-byte MTU", async () => {
    const { session, writer } = await connected(20);

    session.drive("go_front");
    await flush();

    expect(motionWrites(writer.writes).map((write) => write.mode)).toEqual(["with"]);
  });

  it("never starts a GATT write while another is in flight", async () => {
    const { session, writer } = await connected();
    const held = deferred();
    writer.gates.push(held.promise);

    session.drive("go_front");
    session.drive("stop");
    await flush();
    held.resolve();
    await flush();

    expect(writer.maxInFlight).toBe(1);
    expect(motionWrites(writer.writes)).toHaveLength(2);
  });

  it("gives up on a hung write after 1 s and sends the next one", async () => {
    const { session, writer } = await connected();
    vi.useFakeTimers();
    writer.gates.push(new Promise<void>(() => undefined));

    session.drive("go_front");
    session.drive("stop");
    await vi.advanceTimersByTimeAsync(999);
    const beforeTimeout = motionWrites(writer.writes).length;
    await vi.advanceTimersByTimeAsync(1);

    expect(beforeTimeout).toBe(0);
    expect(motionWrites(writer.writes).map((write) => write.text)).toEqual([
      encodeLine(requests.motion("stop")).toString("utf8"),
    ]);
  });
});

describe("notifications and disconnect", () => {
  it("decodes one message from a notification split inside the +==ACE==+ delimiter", async () => {
    const { notifier, messages } = await connected();

    notifier.notify(`{"type":"rsp_init_data","data":{}}${END.slice(0, 4)}`);
    const afterFirstChunk = messages.length;
    notifier.notify(END.slice(4));

    expect(afterFirstChunk).toBe(0);
    expect(messages).toEqual([{ type: "rsp_init_data", data: {} }]);
  });

  it("reports a dropped link and rejects later writes without touching GATT", async () => {
    const { channel, device, writer } = await connected();
    const dropped = vi.fn();
    channel.onDisconnect(dropped);
    const writesBefore = writer.writes.length;

    device.dispatchEvent(new Event("gattserverdisconnected"));

    expect(dropped).toHaveBeenCalledTimes(1);
    await expect(channel.write(Buffer.from("x"), false)).rejects.toThrow("disconnected");
    expect(writer.writes).toHaveLength(writesBefore);
  });

  it("disconnects GATT on close", async () => {
    const { channel, disconnect } = await connected();

    await channel.close();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
