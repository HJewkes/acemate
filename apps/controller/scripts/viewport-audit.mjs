// Loaded into the page by check-viewports.mjs: finds text and controls that are ellipsized, cut off, off screen, under
// a safe-area inset, or overlapping. Controls are focusable Pressables and gesture surfaces tagged with a testID.
const SLACK = 1;
const CONTROLS = '[tabindex="0"], [data-testid], input';

const isShown = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
const ownText = (el) =>
  [...el.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join("")
    .trim();
const describe = (el) =>
  (el.getAttribute("aria-label") || el.getAttribute("data-testid") || el.textContent)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
const box = (rect) => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });

/** Where the text paints: its own box when it clips its overflow, else the extent of its glyphs. */
function textRect(el) {
  if (getComputedStyle(el).overflowX !== "visible") return el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect();
}

/** The open modal's subtree when there is one, since everything under it is covered. */
function scope() {
  const dialogs = [...document.querySelectorAll('[aria-modal="true"], [role="dialog"]')].filter(isShown);
  return dialogs.at(-1) ?? document.body;
}

function scrollParent(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const scrolls = /(auto|scroll)/.test(style.overflowX + style.overflowY);
    if (scrolls && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) return node;
  }
  return null;
}

/** The visible part of the page after every clipping ancestor. */
function clipRect(el) {
  let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.overflowX === "visible" && style.overflowY === "visible") continue;
    const rect = node.getBoundingClientRect();
    clip = {
      left: Math.max(clip.left, rect.left),
      top: Math.max(clip.top, rect.top),
      right: Math.min(clip.right, rect.right),
      bottom: Math.min(clip.bottom, rect.bottom),
    };
  }
  return clip;
}

const outside = (rect, clip) =>
  rect.left < clip.left - SLACK ||
  rect.top < clip.top - SLACK ||
  rect.right > clip.right + SLACK ||
  rect.bottom > clip.bottom + SLACK;

function overflowIssue(el) {
  const style = getComputedStyle(el);
  const wide = el.scrollWidth > el.clientWidth + SLACK;
  const tall = el.scrollHeight > el.clientHeight + SLACK;
  if (style.textOverflow === "ellipsis" && wide) return "ellipsized";
  if (style.webkitLineClamp !== "none" && tall) return "ellipsized";
  if (style.overflowX !== "visible" && wide) return "clipped";
  return null;
}

function textIssues(el) {
  const issues = [];
  const overflow = overflowIssue(el);
  if (overflow) issues.push(overflow);
  if (!scrollParent(el) && outside(textRect(el), clipRect(el))) issues.push("cut off");
  return issues;
}

function unsafe(rect, insets) {
  const safe = {
    left: insets.left,
    top: insets.top,
    right: innerWidth - insets.right,
    bottom: innerHeight - insets.bottom,
  };
  return outside(rect, safe);
}

function overlaps(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > SLACK && height > SLACK;
}

function overlapIssues(elements, kind, rectOf) {
  const issues = [];
  elements.forEach((a, i) => {
    for (const b of elements.slice(i + 1)) {
      if (a.contains(b) || b.contains(a) || !overlaps(rectOf(a), rectOf(b))) continue;
      issues.push({ kind, text: `${describe(a)} / ${describe(b)}`, rect: box(rectOf(a)) });
    }
  });
  return issues;
}

/** The nearest ancestor that paints a background or border: the panel, chip or button the element sits on. */
function paintedParent(el) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    const filled = style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent";
    if (filled || parseFloat(style.borderTopWidth) > 0) return node;
  }
  return null;
}

function placementIssues(el, rect, insets) {
  if (scrollParent(el)) return [];
  const panel = paintedParent(el);
  if (panel && outside(rect, panel.getBoundingClientRect())) return ["spills out of its panel"];
  if (outside(rect, { left: 0, top: 0, right: innerWidth, bottom: innerHeight })) return ["off screen"];
  return unsafe(rect, insets) ? ["under a safe-area inset"] : [];
}

/** Any painted box, such as a panel's edge, that runs off the screen. Reports the outermost one only. */
function boxIssues(root) {
  const screen = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const off = [...root.querySelectorAll("*")].filter(
    (el) => isShown(el) && !scrollParent(el) && outside(el.getBoundingClientRect(), screen),
  );
  const outermost = off.filter((el) => !off.some((other) => other !== el && other.contains(el)));
  return outermost.map((el) => ({ kind: "box off screen", text: describe(el), rect: box(el.getBoundingClientRect()) }));
}

/** Every problem in the current view, as { kind, text, rect }. */
function auditViewport(insets) {
  const root = scope();
  const texts = [...root.querySelectorAll("*")].filter((el) => ownText(el) && isShown(el));
  const controls = [...root.querySelectorAll(CONTROLS)].filter(isShown);
  const issues = [];
  for (const el of texts) {
    const kinds = [...textIssues(el), ...placementIssues(el, textRect(el), insets)];
    for (const kind of kinds) issues.push({ kind, text: describe(el), rect: box(el.getBoundingClientRect()) });
  }
  for (const el of controls) {
    const rect = el.getBoundingClientRect();
    for (const kind of placementIssues(el, rect, insets)) issues.push({ kind, text: describe(el), rect: box(rect) });
  }
  issues.push(...boxIssues(root));
  const unscrolled = (el) => !scrollParent(el);
  issues.push(...overlapIssues(controls.filter(unscrolled), "controls overlap", (el) => el.getBoundingClientRect()));
  issues.push(...overlapIssues(texts.filter(unscrolled), "text overlaps", textRect));
  return issues;
}

window.auditViewport = auditViewport;
