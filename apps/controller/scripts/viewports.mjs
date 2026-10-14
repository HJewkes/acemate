// The screens the drive screen and device menu must fit, in CSS pixels, with each one's safe-area insets.
// Insets are Apple's published values: the Dynamic Island or notch on the sides in landscape and on top in portrait,
// the home indicator at the bottom. A browser that letterboxes the page (Bluefy without viewport-fit) reports none.

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };
const island = (side, bottom) => ({ top: 0, right: side, bottom, left: side });
const islandPortrait = (top) => ({ top, right: 0, bottom: 34, left: 0 });

const touch = (name, width, height, insets = NONE) => ({ name, width, height, insets, touch: true, strict: true });
const laptop = (name, width, height) => ({ name, width, height, insets: NONE, touch: false, strict: true });
const portrait = touch;

export const VIEWPORTS = [
  // The owner's phone first, so it leads the contact sheet. The letterboxed Bluefy size is measured from a
  // screenshot of the app in Bluefy on it: the page spans 833×360 between Bluefy's side bars and toolbar.
  touch("iPhone 17 Pro Max", 956, 440, island(62, 20)),
  touch("Bluefy 17 Pro Max letterboxed", 833, 360),
  touch("Bluefy 17 Pro Max edge-to-edge", 956, 360, island(62, 0)),
  portrait("Portrait iPhone 17 Pro Max", 440, 956, islandPortrait(62)),
  touch("iPhone SE", 667, 375),
  touch("iPhone 13 mini", 812, 375, island(50, 21)),
  touch("iPhone 15", 852, 393, island(59, 21)),
  touch("iPhone 16 Pro", 874, 402, island(62, 20)),
  touch("iPhone 15 Plus", 932, 430, island(59, 21)),
  // Bluefy's toolbar takes height; it may letterbox the page or, honouring viewport-fit=cover, run edge to edge.
  touch("Bluefy SE", 667, 320),
  touch("Bluefy 15 letterboxed", 734, 340),
  touch("Android Chrome small", 732, 320),
  touch("Android Chrome", 860, 360),
  touch("iPad mini", 1133, 744, { ...NONE, bottom: 20 }),
  touch("iPad Pro 12.9", 1366, 1024, { ...NONE, bottom: 20 }),
  laptop("Laptop 1024", 1024, 640),
  laptop("Laptop 1280", 1280, 720),
  laptop("Laptop 1440", 1440, 900),
  portrait("Portrait iPhone SE", 375, 667),
  portrait("Portrait iPhone 15", 393, 852, islandPortrait(59)),
  portrait("Portrait Android", 360, 780, { top: 32, right: 0, bottom: 24, left: 0 }),
  portrait("Portrait Pixel", 412, 915, { top: 32, right: 0, bottom: 24, left: 0 }),
  // Browser toolbars take height in portrait too; these use the compact launcher or a smaller stacked one.
  portrait("Portrait Bluefy 17 Pro Max", 440, 790),
  portrait("Portrait Safari iPhone 15", 393, 659),
  portrait("Portrait Safari SE", 375, 548),
  portrait("Portrait Android Chrome", 360, 640),
  // Portrait iPads keep the landscape row; Split View narrows a window to a phone-like column.
  portrait("Portrait iPad mini", 744, 1133, { ...NONE, bottom: 20 }),
  portrait("iPad Split View", 375, 1133, { ...NONE, bottom: 20 }),
];
