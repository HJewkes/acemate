// Renders a web export in mock mode at every viewport in viewports.mjs, with the device's safe-area insets emulated,
// and fails when text is ellipsized or cut off, or a control sits off screen, under an inset or on another control, or
// when the stick sits under 60 px below Fire.
// Writes a screenshot per viewport and state, issues outlined in red and insets shaded, plus index.html and report.json.
// Usage: node scripts/check-viewports.mjs <dist dir> [output dir] [viewport name filter]
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeMenu, closePopover, connectMock, launchBrowser, openChip, serve, settle } from "./web-harness.mjs";
import { VIEWPORTS } from "./viewports.mjs";

const AUDIT = fileURLToPath(new URL("./viewport-audit.mjs", import.meta.url));
// Each state changes what the screen shows: Fire's lock text, the device chip, the device menu, the launcher chips'
// popovers, and Fire's "HOLD · 3 BALLS" label once Balls is closed again at 3. A popover is a dialog, so the audit
// checks it alone, not the pad it covers.
const STATES = [
  { name: "drive", enter: async () => {} },
  { name: "menu", enter: connectMock },
  { name: "connected", enter: closeMenu },
  { name: "spin-open", enter: (page) => openChip(page, "Spin") },
  { name: "balls-open", enter: openBallsAtThree },
  { name: "balls-3", enter: closePopover },
];

/** Opens Balls at 3, so the Every slider is live and Fire behind it reads "HOLD · 3 BALLS". */
async function openBallsAtThree(page) {
  await closePopover(page);
  await openChip(page, "Balls");
  for (let i = 0; i < 2; i += 1) await page.getByLabel("More balls").click({ timeout: 5_000 });
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

async function openViewport(browser, url, viewport) {
  const { width, height, touch } = viewport;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: viewport.insets });
  await page.goto(`${url}?mock=1`);
  await page.getByLabel("Open device menu").waitFor();
  await page.addScriptTag({ path: AUDIT, type: "module" });
  await page.waitForFunction(() => typeof window.auditViewport === "function");
  return page;
}

/** Shades the insets and outlines each issue, for the screenshot; returns a function that removes the overlay. */
async function drawOverlay(page, insets, issues) {
  await page.evaluate(
    ([insets, issues]) => {
      const layer = document.createElement("div");
      layer.id = "viewport-audit-overlay";
      layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
      const add = (css) =>
        layer.appendChild(Object.assign(document.createElement("div"), { style: `position:absolute;${css}` }));
      const shade = "background:rgba(236,72,153,0.25)";
      add(`left:0;top:0;bottom:0;width:${insets.left}px;${shade}`);
      add(`right:0;top:0;bottom:0;width:${insets.right}px;${shade}`);
      add(`left:0;right:0;top:0;height:${insets.top}px;${shade}`);
      add(`left:0;right:0;bottom:0;height:${insets.bottom}px;${shade}`);
      for (const { rect } of issues)
        add(`left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;outline:2px solid red`);
      document.body.appendChild(layer);
    },
    [insets, issues],
  );
  return () => page.evaluate(() => document.getElementById("viewport-audit-overlay")?.remove());
}

// Fire and the stick sit one above the other in the portrait column; the Strafe / Turn switch must keep them apart.
const MIN_FIRE_GAP = 60;

/** The gap between the bottom of the Fire bar and the top of the stick, or null when they are not stacked. */
async function fireClearanceIssues(page) {
  return page.evaluate((minGap) => {
    const rectOf = (id) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
    const fire = rectOf("fire-bar");
    const stick = rectOf("drive-stick");
    const stacked = fire && stick && Math.min(fire.right, stick.right) - Math.max(fire.left, stick.left) > 0;
    if (!stacked) return [];
    const gap = stick.top - fire.bottom;
    if (gap >= minGap) return [];
    const rect = { x: fire.left, y: fire.bottom, width: fire.width, height: Math.max(gap, 0) };
    return [{ kind: "stick too close to Fire", text: `${Math.round(gap)}px gap, under ${minGap}px`, rect }];
  }, MIN_FIRE_GAP);
}

async function auditState(page, viewport, state, out) {
  const file = `${slug(viewport.name)}-${state.name}.png`;
  const result = { viewport: viewport.name, state: state.name, strict: viewport.strict, file, issues: [] };
  try {
    await state.enter(page);
  } catch (error) {
    // A control the user cannot tap is itself a layout failure, such as a close button covered by another view.
    result.issues.push({
      kind: "unreachable",
      text: error.message.split("\n")[0],
      rect: { x: 0, y: 0, width: 0, height: 0 },
    });
    await page.screenshot({ path: join(out, file) });
    return result;
  }
  await settle(page);
  result.issues = await page.evaluate((insets) => window.auditViewport(insets), viewport.insets);
  result.issues.push(...(await fireClearanceIssues(page)));
  const removeOverlay = await drawOverlay(page, viewport.insets, result.issues);
  await page.screenshot({ path: join(out, file) });
  await removeOverlay();
  return result;
}

async function auditViewport(browser, url, viewport, out) {
  const page = await openViewport(browser, url, viewport);
  try {
    const results = [];
    for (const state of STATES) {
      const result = await auditState(page, viewport, state, out);
      results.push(result);
      if (result.issues.some((issue) => issue.kind === "unreachable")) break;
    }
    return results;
  } finally {
    await page.context().close();
  }
}

const escape = (text) => text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function contactSheet(results) {
  const cards = results.map(({ viewport, state, strict, file, issues }) => {
    const list = issues.map((issue) => `<li>${escape(issue.kind)}: ${escape(issue.text)}</li>`).join("");
    const status = issues.length === 0 ? "ok" : strict ? "fail" : "report-only";
    return `<figure class="${status}"><img src="${file}" loading="lazy"><figcaption><b>${escape(viewport)}</b> · ${state} · ${status}<ul>${list}</ul></figcaption></figure>`;
  });
  const style =
    "body{font:14px system-ui;background:#111;color:#ddd;margin:16px}figure{margin:0 0 24px}img{max-width:100%;border:1px solid #333}.fail b{color:#f66}.ok b{color:#6c6}.report-only b{color:#fc6}";
  return `<!doctype html><meta charset="utf-8"><title>Viewport check</title><style>${style}</style>${cards.join("")}`;
}

function summarize(results) {
  let failed = 0;
  for (const { viewport, state, strict, issues } of results) {
    if (issues.length === 0) continue;
    if (strict) failed += 1;
    console.log(`${strict ? "FAIL" : "note"} ${viewport} · ${state}`);
    for (const issue of issues) console.log(`     ${issue.kind}: ${issue.text}`);
  }
  console.log(`${results.length} views checked, ${failed} failing.`);
  return failed;
}

async function run(dist, out, filter) {
  await mkdir(out, { recursive: true });
  const viewports = VIEWPORTS.filter(
    (viewport) => !filter || viewport.name.toLowerCase().includes(filter.toLowerCase()),
  );
  const server = await serve(dist);
  const browser = await launchBrowser();
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    const results = [];
    for (const viewport of viewports) results.push(...(await auditViewport(browser, url, viewport, out)));
    await writeFile(join(out, "report.json"), JSON.stringify(results, null, 2));
    await writeFile(join(out, "index.html"), contactSheet(results));
    return summarize(results);
  } finally {
    await browser.close();
    server.close();
  }
}

const [dist, out = "viewport-report", filter] = process.argv.slice(2);
if (!dist) throw new Error("Usage: node scripts/check-viewports.mjs <dist dir> [output dir] [viewport name filter]");
const failed = await run(resolve(dist), resolve(out), filter);
process.exitCode = failed > 0 ? 1 : 0;
