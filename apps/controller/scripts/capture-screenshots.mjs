// Captures the README screenshots from a web export, with a stubbed navigator.bluetooth standing in for the robot.
// Usage: node scripts/capture-screenshots.mjs <dist dir> <output dir>
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

// The iPhone 17 Pro Max in landscape; too small for the laptop frame, so the drive screen fills it.
const VIEWPORT = { width: 956, height: 440 };
const HOLD_SNAPSHOT_MS = 350;
const SETTINGS_KEY = "acemate.settings.v1";
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ttf": "font/ttf",
};

function serve(root) {
  const server = createServer((request, response) => {
    const path = join(root, decodeURIComponent(new URL(request.url, "http://x").pathname));
    const file = existsSync(path) && statSync(path).isFile() ? path : join(root, "index.html");
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

// Runs in the page: the NUS characteristic of a pretend S10 that answers like apps/web/src/mock-link.ts.
function installFakeLink() {
  const carState = { car_loc_status: 0, time_is_set: false, mode: "rally", running: false, bat: 76 };
  const replies = {
    ask_init_data: () => ({ type: "rsp_init_data", data: { robot_id: "MOCK", rk_software_version: "mock" } }),
    ask_heartbeat: () => ({ type: "rsp_heartbeat", data: { car_state: { ...carState } } }),
    set_time: () => ((carState.time_is_set = true), { type: "rsp_set_time", data: { result: "ok" } }),
    set_mode: (request) => ({ type: "rsp_set_mode", data: { mode: request.data?.mode, result: "ok" } }),
  };
  const link = new EventTarget();
  link.value = null;
  const emit = (message) => {
    const bytes = new TextEncoder().encode(`${JSON.stringify(message)}\r\n`);
    link.value = new DataView(bytes.buffer);
    link.dispatchEvent(new Event("characteristicvaluechanged"));
  };
  const write = async (data) => {
    for (const line of new TextDecoder().decode(data).split(/\r?\n/).filter(Boolean)) {
      const request = JSON.parse(line);
      const reply = replies[request.type]?.(request);
      if (reply) setTimeout(() => emit(reply), 30);
    }
  };
  link.writeValueWithResponse = write;
  link.writeValueWithoutResponse = write;
  link.startNotifications = async () => link;
  globalThis.fakeRobotLink = link;
}

// Runs in the page after installFakeLink: a navigator.bluetooth whose chooser always picks the pretend S10.
function installFakeBluetooth() {
  const link = globalThis.fakeRobotLink;
  const device = new EventTarget();
  const server = {
    connect: async () => server,
    disconnect: () => device.dispatchEvent(new Event("gattserverdisconnected")),
    getPrimaryService: async () => ({ getCharacteristic: async () => link }),
  };
  Object.assign(device, { id: "mock-s10", name: "ACEMATE-S10", gatt: server });
  Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: async () => device } });
}

async function openApp(browser, url, theme) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await context.addInitScript(installFakeLink);
  await context.addInitScript(installFakeBluetooth);
  await context.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [SETTINGS_KEY, JSON.stringify({ theme })],
  );
  const page = await context.newPage();
  await page.goto(url);
  await page.getByLabel("Open device menu").click();
  await page.getByText("Choose robot…").click();
  await page.getByText("Disconnect").waitFor();
  return page;
}

async function closeMenu(page) {
  await page.getByLabel("Close menu").click();
  await page.getByText("DEVICE MENU").waitFor({ state: "hidden" });
}

async function capture(browser, url, out) {
  const shot = (page, name) => page.screenshot({ path: join(out, `${name}.png`) });
  for (const theme of ["dark", "light"]) {
    const page = await openApp(browser, url, theme);
    if (theme === "dark") await shot(page, "device-menu");
    await closeMenu(page);
    await page.getByText("HOLD TO FIRE").waitFor();
    await shot(page, `drive-${theme}`);
    if (theme === "dark") await captureHold(page, shot);
    await page.context().close();
  }
}

async function captureHold(page, shot) {
  const box = await page.getByText("HOLD TO FIRE").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(HOLD_SNAPSHOT_MS);
  await shot(page, "hold-to-fire");
  await page.mouse.up();
}

const [dist, out] = process.argv.slice(2).map((path) => resolve(path));
if (!dist || !out) throw new Error("Usage: node scripts/capture-screenshots.mjs <dist dir> <output dir>");
await mkdir(out, { recursive: true });
const server = await serve(dist);
const browser = await chromium.launch();
try {
  await capture(browser, `http://127.0.0.1:${server.address().port}/`, out);
} finally {
  await browser.close();
  server.close();
}
