// Captures the README screenshots from a web export in mock mode (?mock=1), so no robot is needed.
// Usage: node scripts/capture-screenshots.mjs <dist dir> <output dir>
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { SETTINGS_KEY, closeMenu, connectMock, launchBrowser, serve, settle } from "./web-harness.mjs";

// The iPhone 17 Pro Max in landscape; too small for the laptop frame, so the drive screen fills it.
const VIEWPORT = { width: 956, height: 440 };
const HOLD_SNAPSHOT_MS = 350;

async function openApp(browser, url, theme) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await context.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [SETTINGS_KEY, JSON.stringify({ theme })],
  );
  const page = await context.newPage();
  await page.goto(`${url}?mock=1`);
  await connectMock(page);
  return page;
}

async function capture(browser, url, out) {
  const shot = async (page, name) => {
    await settle(page);
    await page.screenshot({ path: join(out, `${name}.png`) });
  };
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
const browser = await launchBrowser();
try {
  await capture(browser, `http://127.0.0.1:${server.address().port}/`, out);
} finally {
  await browser.close();
  server.close();
}
