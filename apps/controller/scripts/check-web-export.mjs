// Checks a web export: assets carry the Pages base URL, no native-only module was bundled, and the bundle
// renders the drive screen in happy-dom. Usage: node scripts/check-web-export.mjs <dist> <base-url>
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Window } from "happy-dom";

const NATIVE_ONLY = ["react-native-ble-plx", "BleManager"];
const RENDER_WAIT_MS = 1_000;
const PLACEHOLDER = "Web Bluetooth link coming next";

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

// The drive screen must render, and the device menu must show the placeholder rather than crash on a missing BLE stack.
async function checkScreens(document) {
  const text = document.body.textContent ?? "";
  const menu = document.querySelector('[aria-label="Open device menu"]');
  if (!text.includes("ACEMATE") || !menu) throw new Error(`drive screen did not render: "${text.slice(0, 200)}"`);
  menu.click();
  await settle();
  if (!document.body.textContent.includes(PLACEHOLDER)) throw new Error(`device menu lacks "${PLACEHOLDER}"`);
}

async function renderDriveScreen(baseUrl, bundles) {
  const window = new Window({ url: `https://example.test${baseUrl}/`, width: 844, height: 390 });
  const errors = [];
  window.addEventListener("error", (event) => errors.push(event.error ?? event.message));
  window.document.body.innerHTML = '<div id="root"></div>';
  try {
    for (const file of bundles) window.eval(readFileSync(file, "utf8"));
    await settle();
    await checkScreens(window.document);
    if (errors.length > 0) throw new Error(`bundle threw: ${errors.map(String).join("; ")}`);
  } finally {
    await window.happyDOM.close();
  }
}

async function main([dist, baseUrl]) {
  if (!dist || !baseUrl) throw new Error("usage: check-web-export.mjs <dist> <base-url>");
  const html = readFileSync(path.join(dist, "index.html"), "utf8");
  const bundles = checkAssets(dist, baseUrl, html);
  checkNativeOnly(bundles);
  await renderDriveScreen(baseUrl, bundles);
  console.log(`web export OK: ${bundles.length} bundle(s) under ${baseUrl}/, drive screen rendered`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`web export check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
