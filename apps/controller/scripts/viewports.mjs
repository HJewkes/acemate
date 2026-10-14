// The screens the drive screen and device menu must fit, in CSS pixels, with each one's safe-area insets.
// Insets are Apple's published values: the Dynamic Island or notch on the sides in landscape and on top in portrait,
// the home indicator at the bottom. A browser that letterboxes the page (Bluefy without viewport-fit) reports none.
// `strict: false` reports problems without failing the check: portrait stays report-only until it has its own layout.

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };
const island = (side, bottom) => ({ top: 0, right: side, bottom, left: side });
const islandPortrait = (top) => ({ top, right: 0, bottom: 34, left: 0 });

const touch = (name, width, height, insets = NONE) => ({ name, width, height, insets, touch: true, strict: true });
const laptop = (name, width, height) => ({ name, width, height, insets: NONE, touch: false, strict: true });
const portrait = (name, width, height, insets = NONE) => ({ ...touch(name, width, height, insets), strict: false });

export const VIEWPORTS = [
  touch("iPhone SE", 667, 375),
  touch("iPhone 13 mini", 812, 375, island(50, 21)),
  touch("iPhone 15", 852, 393, island(59, 21)),
  touch("iPhone 16 Pro", 874, 402, island(62, 20)),
  touch("iPhone 15 Plus", 932, 430, island(59, 21)),
  touch("iPhone 17 Pro Max", 956, 440, island(62, 20)),
  // Bluefy's toolbar takes height; it may letterbox the page or, honouring viewport-fit=cover, run edge to edge.
  touch("Bluefy SE", 667, 320),
  touch("Bluefy 15 letterboxed", 734, 340),
  touch("Bluefy 17 Pro Max letterboxed", 833, 360),
  touch("Bluefy 17 Pro Max edge-to-edge", 956, 360, island(62, 0)),
  touch("Android Chrome small", 732, 320),
  touch("Android Chrome", 860, 360),
  touch("iPad mini", 1133, 744, { ...NONE, bottom: 20 }),
  touch("iPad Pro 12.9", 1366, 1024, { ...NONE, bottom: 20 }),
  laptop("Laptop 1024", 1024, 640),
  laptop("Laptop 1280", 1280, 720),
  laptop("Laptop 1440", 1440, 900),
  portrait("Portrait iPhone SE", 375, 667),
  portrait("Portrait iPhone 15", 393, 852, islandPortrait(59)),
  portrait("Portrait iPhone 17 Pro Max", 440, 956, islandPortrait(62)),
  portrait("Portrait Android", 360, 780),
  portrait("Portrait iPad mini", 744, 1133, { ...NONE, bottom: 20 }),
];
