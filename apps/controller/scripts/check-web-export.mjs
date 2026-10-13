// Checks a web export: assets carry the Pages base URL, no native-only module was bundled, and the bundle
// renders the drive screen in happy-dom, framed beside the side panel on a laptop window and full-window on a phone. Usage: node scripts/check-web-export.mjs <dist> <base-url>
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Window } from "happy-dom";

const NATIVE_ONLY = ["react-native-ble-plx", "BleManager"];
const RENDER_WAIT_MS = 1_000;
const CHOOSER = "Choose robot…";
const PROBE = "WEB BLUETOOTH PROBE";

function assetUrls(html) {
  return [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
}

function checkAssets(dist, baseUrl, html) {
  const urls = assetUrls(html);
  if (!urls.some((url) => url.endsWith(".js"))) throw new Error("index.html loads no script");
  for (const url of urls) {
    if (!url.startsWith(`${baseUrl}/`)) throw new Error(`${url} does not start with ${baseUrl}/`);
    if (!existsSync(path.join(dist, url.slice(baseUrl.length)))) throw new Error(`${url} is missing from ${dist}`);
  }
  return urls.filter((url) => url.endsWith(".js")).map((url) => path.join(dist, url.slice(baseUrl.length)));
}

function checkNativeOnly(bundles) {
  for (const file of bundles) {
    const found = NATIVE_ONLY.filter((name) => readFileSync(file, "utf8").includes(name));
    if (found.length > 0) throw new Error(`${path.basename(file)} bundles ${found.join(", ")}`);
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, RENDER_WAIT_MS));

// The drive screen and the ?probe=1 panel must render, and the device menu must offer the chooser rather than crash on
// a browser without navigator.bluetooth.
async function checkScreens(document) {
  const text = document.body.textContent ?? "";
  if (!text.includes(PROBE)) throw new Error("the ?probe=1 panel did not render");
  const menu = document.querySelector('[aria-label="Open device menu"]');
  if (!text.includes("ACEMATE") || !menu) throw new Error(`drive screen did not render: "${text.slice(0, 200)}"`);
  menu.click();
  await settle();
  if (!document.body.textContent.includes(CHOOSER)) throw new Error(`device menu lacks "${CHOOSER}"`);
}

// happy-dom reports a fine pointer (no touch points), so the window size alone picks the shell.
const KEYS_CHIP = "⌨ Keys";
const PANEL = ["KEYBOARD", "GAMEPAD", "LIVE", "DEBUG LOG"];

function checkShell(expected) {
  return async (document) => {
    const text = document.body.textContent ?? "";
    const panel = PANEL.every((heading) => text.includes(heading));
    const chip = text.includes(KEYS_CHIP);
    if (expected === "framed" && !panel) throw new Error("the laptop frame did not render its side panel");
    if (expected === "framed" && chip) throw new Error("the laptop frame still shows the Keys chip");
    if (expected === "phone" && text.includes("LIVE")) throw new Error("the phone layout rendered the side panel");
    if (expected === "phone" && !chip) throw new Error("the phone layout lost its Keys chip");
  };
}

async function render(baseUrl, bundles, { query = "", width, height }, check) {
  const window = new Window({ url: `https://example.test${baseUrl}/${query}`, width, height });
  // happy-dom does no layout (documentElement.clientWidth is 0), so react-native-web reads the size from here.
  window.visualViewport = { width, height, scale: 1, addEventListener: () => undefined };
  const errors = [];
  window.addEventListener("error", (event) => errors.push(event.error ?? event.message));
  window.document.body.innerHTML = '<div id="root"></div>';
  try {
    for (const file of bundles) window.eval(readFileSync(file, "utf8"));
    await settle();
    await check(window.document);
    if (errors.length > 0) throw new Error(`bundle threw: ${errors.map(String).join("; ")}`);
  } finally {
    await window.happyDOM.close();
  }
}

async function renderScreens(baseUrl, bundles) {
  await render(baseUrl, bundles, { query: "?probe=1", width: 844, height: 390 }, checkScreens);
  await render(baseUrl, bundles, { width: 1440, height: 900 }, checkShell("framed"));
  await render(baseUrl, bundles, { width: 390, height: 844 }, checkShell("phone"));
}

async function main([dist, baseUrl]) {
  if (!dist || !baseUrl) throw new Error("usage: check-web-export.mjs <dist> <base-url>");
  const html = readFileSync(path.join(dist, "index.html"), "utf8");
  const bundles = checkAssets(dist, baseUrl, html);
  checkNativeOnly(bundles);
  await renderScreens(baseUrl, bundles);
  console.log(
    `web export OK: ${bundles.length} bundle(s) under ${baseUrl}/, drive screen, laptop frame and phone rendered`,
  );
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`web export check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
