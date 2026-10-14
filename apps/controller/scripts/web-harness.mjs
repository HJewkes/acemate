// Shared by the screenshot and viewport scripts: serves a web export and opens it in Chromium in mock mode.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ttf": "font/ttf",
};
export const SETTINGS_KEY = "acemate.settings.v1";

/**
 * Serves `root` on a free local port, falling back to index.html for unknown paths. An export built with
 * EXPO_BASE_URL (as CI builds it for Pages) asks for its assets under that prefix, so the prefix is dropped.
 */
export function serve(root, base = process.env.EXPO_BASE_URL ?? "") {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://x").pathname);
    const path = join(root, base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname);
    const file = existsSync(path) && statSync(path).isFile() ? path : join(root, "index.html");
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

/** Chromium from Playwright, or from CHROMIUM_PATH when the installed browser is a different build. */
export function launchBrowser() {
  const executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(executablePath ? { executablePath } : {});
}

/** Connects the mock robot through the device menu and leaves the menu open. */
export async function connectMock(page) {
  await page.getByLabel("Open device menu").click({ timeout: 5_000 });
  await page.getByText("Choose robot…").click({ timeout: 5_000 });
  await page.getByText("Disconnect").waitFor();
}

export async function closeMenu(page) {
  await page.getByLabel("Close menu").click({ timeout: 5_000 });
  await page.getByText("DEVICE MENU").waitFor({ state: "hidden" });
}

/** Waits for fades and springs to finish so a screenshot or measurement sees the settled layout. */
export function settle(page) {
  return page.waitForFunction(() => document.getAnimations().length === 0);
}
