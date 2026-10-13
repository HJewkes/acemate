# web: Acemate S10 browser controller

A static page that drives the Acemate S10 straight from the browser over Web Bluetooth. There is no server and nothing to
install: it talks to the robot's Nordic UART service directly (see `docs/protocol.md`).

## Run

```sh
cd apps/web
npm install
npm run dev                  # Vite on http://localhost:5173
```

- **Real robot:** open http://localhost:5173 in Chrome, tap **Connect** and pick the `ACEMATE-…` device.
  Force-quit the Acemate phone app first, because only one central can hold the robot.
- **Mock robot:** open http://localhost:5173/?mock=1. Connect uses a pretend S10 that answers init, heartbeat
  (battery 76%), set_time, set_mode and runs, so the whole UI works at a desk.
- `npm test` runs the unit tests and a happy-dom smoke test of mock mode. `npm run typecheck` runs tsc only.
- `npm run build` typechecks and writes a static `dist/` with relative URLs. `npm run preview` serves it.

Web Bluetooth only runs in a secure context. `localhost` counts; a LAN address like `http://192.168.1.5:5173` does
not, so a phone needs the HTTPS (GitHub Pages) build.

## Browser support

| Browser                                                   | Works                                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Chrome or Edge, desktop (macOS, Windows, Linux, ChromeOS) | yes                                                                                 |
| Chrome on Android                                         | yes                                                                                 |
| iPhone / iPad                                             | only in the Bluefy browser (App Store); Safari and iOS Chrome have no Web Bluetooth |
| Firefox, Safari                                           | no                                                                                  |

Without `navigator.bluetooth` the page says so and disables Connect. Mock mode still works.

## Controls

| Input                                                                  | Action                                      |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| Left touch stick, gamepad left stick, `W` `S` / `↑` `↓`, `Q` `E`       | forward/back, strafe                        |
| Right touch stick (horizontal), gamepad right stick, `A` `D` / `←` `→` | turn                                        |
| **STOP** button, `Space`, gamepad B / circle                           | emergency stop, which also sends `run_stop` |

Both touch sticks take a thumb each at the same time. The firmware runs one motion at a time, so the page picks a single
motion with the same rule as `tools/web-drive` (`MOTION_RULE`: a hard turn wins, otherwise the larger translation).

## Safety

- Nothing is sent to the robot until you tap Connect, and Connect is the only way to reconnect. The page never
  reconnects by itself.
- Switching tab or app, locking the phone, or the window losing focus stops the robot and drops every held key and
  stick. Closing the page sends stop and disconnects.
- After an emergency stop the page stays stopped until every input is back to neutral.
- Typing, dragging or holding a pointer down in the launcher never drives: keys, touch sticks and the gamepad are ignored
  while a launcher control has focus or a pointer is down on it. Space still stops from anywhere except the preset JSON
  box, where it types; the STOP button and gamepad B work there too. STOP, Space and gamepad B also cancel a Fire hold.
- While a launch run is active, drive input is held at stop. There is no arm toggle: **Fire** is press-and-hold. Holding it
  (pointer, or Enter while it has focus) fills a bar over `HOLD_MS` (1.2 s, `launcher-ui/hold-fire.ts`) and fires once.
  Releasing early, leaving the button, window blur, a tab switch or an e-stop cancels it with nothing sent; after a fire
  you must release before holding again. Fire is disabled while disconnected or while a run is active.
- If the page dies mid-drive, the firmware's dead-man stop (under about 2 s without a command) halts the robot.

## Launcher layouts

The launcher has four interchangeable layouts, for comparing which way of specifying a shot feels best. Pick one with
the switch at the top of the launcher or with `?launcher=a|b|c|d` (for example `/?mock=1&launcher=c`). The choice is
remembered. All four share the Fire (hold) / Pause / Stop bar and send through the same validated `LaunchController`.

|     | Layout                                                                                                                                                                                                                                         | Sends                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A   | **Controls**: a slider with − / + steppers for each parameter, plus slice / flat / topspin with a fine-tune.                                                                                                                                   | `ball_machine`       |
| B   | **Court map**: tap or drag on a top-down singles court; the target snaps to 0.1 m. In **Sequence** mode, up to 5 taps are numbered and each Fire hold sends the next one.                                                                      | `drill` (robot aims) |
| C   | **Aim pad**: drag a crosshair for direction × elevation, with a speed fader and side and top sketches.                                                                                                                                         | `ball_machine`       |
| D   | **Presets**: big buttons for named shots. In **Queue** mode, taps build a list of up to 10 that fires as one `ball_machine` run (`b:[…]` in order, `random_order:false`). Edit presets as JSON in the page or in `src/launcher-ui/presets.ts`. | either               |

Signs and origins are not confirmed on hardware yet. **Assumptions** in the launcher can flip the direction sign, flip
court x, and move the robot along z. All the guesses are listed in `src/launcher-ui/assumptions.ts`.

## How it fits together

The page reuses the tested logic in `tools/` rather than copying it: request builders and the `+==ACE==+` decoder
(`tools/drive-probe/src/protocol.ts`), launch payloads (`launch.ts`), `DriveLoop`, `resolveMotion`, the keyboard and
gamepad mapping, `LaunchController`, the launch status log and the battery meter (`tools/web-drive/src`).

New here:

- `src/ble-link.ts`: `BrowserBleLink`. It serialises GATT writes, sends `motion_control` without response and
  everything else with response, reassembles notifications, and reports `gattserverdisconnected`.
- `src/session.ts`: the browser version of web-drive's server glue. It sends `ask_init_data` on connect, a heartbeat
  every 3 s only while stopped, and `set_time` when the robot reports `time_is_set: false`. It forwards `car_state`
  to the page and the launcher.
- `src/sticks.ts` and `src/ui/thumbsticks.ts`: Pointer Events touch sticks with one owning pointer per stick.
- `src/mock-link.ts`: the pretend robot for `?mock=1`.
- `src/launcher-ui/`: the four launcher layouts (`controls.ts`, `court-map.ts`, `aim-pad.ts`, `preset-board.ts`) behind
  one `LauncherVariant` interface, the shared fire bar and switch (`shell.ts`), and the pure mappings they use
  (`court.ts`, `aim.ts`, `presets.ts`, `spin.ts`, `ranges.ts`, `assumptions.ts`).

## Publishing to GitHub Pages

The site is published at https://hjewkes.github.io/acemate/. The build uses `base: "./"`, so it works under a subpath, and Pages serves it over HTTPS, which Web Bluetooth requires. The `tools/` sources are imported at build time, so a build needs the whole repo checked out.
