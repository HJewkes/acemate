# Acemate Drive (iPhone controller)

An Expo (SDK 55) app that drives the Acemate S10 over BLE with one on-screen thumbstick, and aims and fires the launcher from the same screen. It speaks the hardware-confirmed protocol in [docs/protocol.md](../../docs/protocol.md): Nordic UART, JSON lines, one `motion_control` motion at a time, written without response every 50 ms.

The app is pinned to SDK 55 because Xcode 26.2 cannot build SDK 56 or later.

## Install on a device

You need a Mac with Xcode, an iPhone and a cable for the first install. This is a development build, not Expo Go, because BLE needs native code. Node 24 is required.

1. On the iPhone, turn on Developer Mode: Settings → Privacy & Security → Developer Mode, then restart.
2. Build and install:

   ```sh
   cd apps/controller
   npm install
   npx expo prebuild --platform ios --clean
   npx expo run:ios --device
   ```

   Pick your iPhone from the list. This builds, installs and starts Metro.

3. Signing: if Xcode reports a signing error, open `ios/AcemateDrive.xcworkspace`, go to the target → Signing & Capabilities, tick "Automatically manage signing" and choose your Personal Team. A free Apple ID works, with limits: apps expire after 7 days (rebuild to renew) and a free account can have only 3 apps installed at once. If the bundle id is taken, change `ios.bundleIdentifier` in `app.json` and prebuild again.
4. Trust the developer profile on the phone: Settings → General → VPN & Device Management → your Apple ID → Trust.
5. The first launch asks for Bluetooth permission; allow it.
6. Later, with the app installed, run Metro with `npm start`. The dev client reloads on save.

## Web build (preview)

The same app builds for the browser with react-native-web. Pages serves it at `/acemate/next/`; the classic `apps/web` controller stays at `/acemate/`. Metro picks `src/robot/ble-channel.web.ts` for the web, which connects over Web Bluetooth (`src/robot/web-bluetooth.ts`), so react-native-ble-plx never reaches the web bundle. It needs HTTPS and Chrome or Edge on desktop or Android, or Bluefy on iPhone.

- **Connect**: open the device menu and tap **Choose robot…**. The browser's chooser is the scan list. The web never connects on its own, because the chooser needs a tap; after a reload, **Reconnect <name>** opens the chooser for the saved robot only.
- **Writes**: the same rules as native, through `RobotSession`. Each request is one write, without response up to 180 bytes and with response above that, serialised, with a 1 s timeout.
- **Max write without response** (device menu → debug log, web only): if Android keeps a 23-byte MTU, a motion line written without response may be cut short. Pick 20 B to send motion with response.
- **`?probe=1`**: a panel that lists the secure context, `navigator.bluetooth`, `getDevices`, `requestLEScan`, `writeValueWithoutResponse` and the user agent.
- Hiding the tab stops the robot and drops the link, as backgrounding does on native.

```sh
npm run web                                       # dev server at the root
EXPO_BASE_URL=/acemate/next npm run export:web    # static export to dist/
EXPO_BASE_URL=/acemate/next npm run check:web     # asset prefixes, no ble-plx, renders in happy-dom
```

`EXPO_BASE_URL` sets `experiments.baseUrl` in `app.config.ts`; native builds never set it.

## Driving

1. Force-quit the stock Acemate app on every phone nearby. The robot takes one BLE connection.
2. Power on the robot and open Acemate Drive. It auto-connects to the last robot (see below); otherwise open the device menu and tap a robot.
3. Drive with the stick. The big label shows the motion being sent.

## Screen guide

- **Stick**: up/down is `go_front`/`go_back`. Sideways is strafe (`go_left`/`go_right`) or turn (`turn_left`/`turn_right`), chosen by the **↔ Strafe / ↻ Turn** toggle under the stick. The firmware does not blend motions, so one wins: a turn past 0.5 beats forward/back, otherwise the dominant translate axis past a 0.25 deadzone, otherwise a gentle turn.
- **STOP** latches: the robot stays stopped until the stick is released, then a new push drives again.
- **Device menu**: lists nearby robots (`ACEMATE-XXXXX`) with a connect or disconnect control, the debug log with a Clear button, and settings: theme and "Allow driving during runs". Close it with the large ✕.
- **Launcher panel** (right of the stick): spin (slice, flat, topspin), a speed slider (1..10), a full-width square aim pad (across is direction −15..15, up is elevation 10..40), a shot readout, and the fire bar.
- **Hold to fire**: hold the bar for 600 ms and it fills and fires one ball; letting go early cancels, and one hold fires once. It is greyed out, with the reason shown, while disconnected, while driving, while a `set_mode` waits for its reply, and while a run is active. The stick, pad and sliders never move the robot except the stick.
- **Run chip**: appears in the top bar while a run is active or starting, showing the mode (Ball machine, Drill) and elapsed time as mm:ss (`--:--` until `run_start` goes out). **Stop run** sits beside the last launch report while a run is active.
- **Top bar**: link status, battery from `car_state.bat`, and the run chip.
- **Themes**: dark (default) and light, switched in the device menu.

## Settings and auto-connect

Settings persist in AsyncStorage under one key: stick mode (Strafe or Turn), the last shot (direction, elevation, speed, spin), the last connected robot, the theme, and the driving-during-runs option. Anything missing or malformed falls back to defaults field by field.

On launch, and on returning to the app, it auto-connects to the saved robot with a short scan. An explicit Disconnect pauses auto-connect until the next launch or until you connect from the device menu.

## Layout

The drive screen is sized from the window. Both side columns (the stick and the launcher panel) share one width, chosen from the available height and width and clamped to 130-260 pt; the centre keeps at least 200 pt. Horizontal padding is larger on wide screens and clears the Dynamic Island in landscape. It fits landscape phones and tablets.

## Safety

- Clear the court and keep the robot in sight. Stay out of the launcher's arc.
- Lifting your thumb stops the robot at once. **STOP** sends `stop` immediately, then twice more.
- Leaving the app (home swipe, app switcher, lock, a call, Control Centre) stops the robot and disconnects; it reconnects on return unless you disconnected yourself.
- If the phone or link dies, the firmware stops on its own in under 2 s.
- Every drive command sends `shot_switch: "off"`; the launcher is reached only through the launcher panel.

## Troubleshooting

- **Robot ignores messages sent in chunks.** The robot parses one BLE write as one message, so splitting a JSON line across writes is ignored. Each message must go out as a single write.
- **Connects but motion is ignored.** The robot sometimes needs a power cycle. Power it off and on, force-quit the stock app, and reconnect.
- **Robot not found.** Another phone (or the stock app) holds the connection. Force-quit it everywhere.
- **`destroy is not a function`.** A `useEffect` callback returned a value that is not a cleanup function (for example an arrow function with an expression body). Effects must return nothing or a function; use a block body.
- **Expo SDK 56 or 57 will not build.** Xcode 26.2 cannot build them, so the app stays on SDK 55. Do not upgrade Expo until Xcode is updated.
- **Tests fail on Node 25.** Node 25's global `localStorage` breaks the happy-dom tests. Use Node 24.
- **App stops working after a week.** A free Apple ID signature expires after 7 days. Rebuild with `npx expo run:ios --device`.

## Development

```sh
npm test          # vitest: stick mapping, deadzones, e-stop latch, drive loop, session, settings, layout
npm run typecheck
```

`src/shared.ts` imports the drive rules, drive loop, protocol and `LaunchController` from `tools/web-drive` and `tools/drive-probe`, and the launcher's pure mappings and hold-to-fire from `apps/web/src/launcher-ui`, instead of copying them. `metro.config.js` watches both and maps their NodeNext `./x.js` specifiers to the `.ts` files; `src/polyfills.ts` installs `Buffer`, which the protocol module uses and Hermes lacks.

Source: `src/control` (sticks and e-stop latch), `src/robot` (session over a `ByteChannel`, the ble-plx channel, `useRobot`), `src/launcher` (fire lock, hold-to-fire, run chip), `src/storage` (settings), `src/ui` (stick, drive screen, launcher panel, device menu, theme, layout). Gestures use react-native-gesture-handler with JS-thread callbacks, because driving and aiming need simultaneous touches.
