# Portrait plan: drive screen and device menu

Status: built. The decisions below took the recommended answers; change any of them in `src/ui/layout-portrait.ts` and the drive and menu components.

## Recommendation

One stacked screen in portrait, with no Drive / Launcher tabs. From top to bottom:

1. A header with the device chip, Keys (web) and the run chip.
2. A flexible spacer.
3. The launcher at full width, with Fire at its bottom.
4. A guard gap.
5. Strafe / Turn.
6. The stick, at the bottom where the thumb rests.

Tabs would hide the stick or the launcher and add mode state that leaving a tab must also clear. Putting the stick on top puts the safety-critical control out of thumb reach on a Pro Max.

Fire is already safe from the stick:

- Fire is locked while the robot moves ("Stop driving to fire").
- Fire needs a fresh 600 ms hold.
- The stick keeps a finger that slides off it.

The switch between Fire and the stick is the buffer: tapping it by accident does no harm. The gap from Fire to the stick is about 63 pt, and a unit test should hold it.

```
+---------------- 393 ----------------+
|        ( Dynamic Island )   top 59  |
| [* ACEMATE-1A2B Linked 87%] [Keys] [RUN 0:12 #] |
|            (spacer)                 |
| +-------- launcher, full width ---+ |
| | [  Slice  |  Flat  |  Top    ]  | |
| | [====================Speed 6 ]  | |
| |      +------ pad 245 -----+     | |
| |      |----------+----o----|     | |
| |      +--------------------+     | |
| |        R 2° · elev 25°          | |
| | [######   HOLD TO FIRE   ######]| |
| +---------------------------------+ |
|              guard 16               |
|        [ ↔ Strafe | ↻ Turn ]        |
|             ( stick 216 )           |
|      home indicator   bottom 34     |
+-------------------------------------+
```

On short browser windows (SE Safari, Bluefy), the launcher reuses the landscape "wide" shape: the pad beside spin, speed, readout and Fire, with the stick below. The stacked portrait needs about 598 pt of room; the compact one needs about 446.

The device menu in portrait is a full-screen sheet:

- a sticky header (title and ✕)
- one scroll view holding Devices, Settings and the Debug log (the log scrolls inside a fixed 240 pt box)
- a sticky Done button at the bottom, within one-handed reach

Landscape keeps today's three columns.

## Layout

- `chooseArrangement` returns `"column"` when the window is taller than wide and the row layout would leave each side under 180 pt; otherwise `"row"`.
  - Portrait iPads (744 pt and wider) keep the row.
  - Split View widths get the column.
  - `computeLayout` stays the row function, so the tuned iPhone 17 Pro Max landscape layout (stick 200) does not move.
- Add `computePortraitLayout` in `src/ui/layout-portrait.ts`, as pure functions with tests. With content width `W` and room `R` (the height less the insets):
  - Stacked: `share = R − 298`
    - `stick = clamp(min(share / 2, 0.6 W), 130, 220)`
    - `pad = min(share − stick, W − 24, 260)`
  - Compact, used when the stick or pad would go under 150:
    - `pad = W − 194`
    - the stick takes what is left
  - `stickWidth` is at least 180, so Strafe / Turn keep their words.
  - The readout gets 2 lines.

| Viewport (insets top/bottom)         | Shape   | Stick | Pad |
| ------------------------------------ | ------- | ----- | --- |
| iPhone SE 375×667 (0/0)              | stacked | 174   | 175 |
| iPhone 15 393×852 (59/34)            | stacked | 216   | 245 |
| iPhone 17 Pro Max 440×956 (62/34)    | stacked | 220   | 260 |
| Android 360×780 (32/24)              | stacked | 196   | 230 |
| SE Safari 375×548 (0/0)              | compact | 205   | 149 |
| Bluefy iPhone 15 about 393×600 (0/0) | compact | 216   | 167 |

## Phases

0. **Insets (done).** `react-native-safe-area-context` gives the app real insets on iPhone and Android. On web it reads `env(safe-area-inset-*)`, and `public/index.html` adds `viewport-fit=cover` so browsers report them. The laptop frame uses the iPhone 17 Pro Max's insets.
1. **Portrait layout functions and tests.** Make `DriveLayout` a union with `arrangement: "row" | "column"`, and have `useDriveLayout` dispatch between the two.
2. **No "…" (done for landscape).** `FitText` shrinks a label, then uses its icon, then wraps. Portrait adds two risks:
   - The header must fit the chip, Keys and the run chip in 343 pt on the SE, so the chip should flex.
   - Device rows are narrow.
3. **Portrait drive screen.**
   - Split `DriveScreen` into `RowDrive` (today's body), `PortraitDrive`, `PortraitHeader` and a shared `StickGroup`.
   - Change `app.json` `orientation` to `"default"`. This needs a native rebuild.
   - **Rotation safety:** rotating remounts the stick mid-gesture, and the release may never fire. So:
     - `Thumbstick` sends `CENTERED` when it unmounts.
     - `DriveScreen` calls `controller.emergencyStop()` when the arrangement changes, so a thumb still down cannot drive until it lifts.
4. **Portrait device menu.**
   - Set the Modal's `supportedOrientations` to portrait and landscape.
   - Add `MenuStack` for portrait; give `DeviceList` and `DebugLog` a stacked variant without nested scroll views.
5. **Checks and docs.**
   - Make the portrait viewports in `scripts/viewports.mjs` strict.
   - Add portrait screenshots and a README section.

## Open questions

1. Portrait iPads: keep the landscape-style row (recommended), or use the column?
2. Portrait sizes: stick up to 220 and pad up to 260, or cap the stick at the tuned 200?
3. Speed slider in portrait: it fills from the right because the panel sits on the right edge. Keep that, or fill from the left?
4. Wordmark in portrait: faint in the spare space on tall phones, or dropped?
5. Device menu in portrait: add a bottom Done button as well as the ✕?
6. Web zoom: set `maximum-scale=1` to stop double-tap zoom while driving? This costs accessibility zoom.
7. Smallest supported portrait size: 320×568 (first-generation SE) can't fit even the compact launcher sensibly. Should it be unsupported?
