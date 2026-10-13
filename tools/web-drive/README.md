# web-drive

Browser drive controller for the Acemate S10. Unlike `drive-probe`, a browser sees real key-up events and gamepad sticks,
so release is exact rather than inferred from key-repeat. The real SDK and controllers (T-4, T-5) replace it.

## Run (macOS laptop, robot powered on)

```sh
cd tools/web-drive
npm install
npm start                    # first NUS device; or: npm start -- --name S10
```

Then open http://localhost:8765 and keep that tab focused.

- **Bluetooth permission:** the first run prompts for Bluetooth access for your terminal app (System Settings >
  Privacy & Security > Bluetooth). If scanning finds nothing, check that the terminal is allowed there.
- **Close the Acemate app on your phone first** (force-quit it). Only one central can hold the robot.
- `npm start -- --dry-run` serves the page with no robot, so you can try the keys and gamepad at a desk.
- Other flags: `--port 8765`, `--log web-drive.jsonl`, `--chunk 512`, `--heartbeat 3000`.


**Hot reload:** edits to `src/page/*` rebuild and reload open tabs without dropping the robot connection (a reload closes the control socket, which sends stop). Use `npm run dev` to also restart the server on server-side edits; that reconnects BLE.

## Controls

| Input | Action |
| --- | --- |
| `W` / `S` or `↑` / `↓` | forward / back |
| `A` / `D` or `←` / `→` | turn left / right |
| `Q` / `E` | strafe left / right |
| `Space`, gamepad B / circle | emergency stop |
| Gamepad left stick | translate |
| Gamepad right stick (horizontal) | turn |

After an emergency stop the page stays stopped until every input is neutral: release the sticks and press keys afresh.

## Priority rule

The firmware does not blend motions, so exactly one is active. Keyboard and gamepad merge per axis (the stronger push wins).
Then `resolveMotion` in `src/motion.ts` applies the rule, whose settings live in `MOTION_RULE`:

1. If |turn| > `rotateThreshold` (0.5), turn. Rotation beats any translation, so `W`+`Q` turns left.
2. Otherwise, if the larger of |forward| and |strafe| > `deadzone` (0.25), drive along it. Forward/back wins a tie.
3. Otherwise, if |turn| > `deadzone`, turn, so a gentle twist of the right stick still rotates.
4. Otherwise, stop.

Set `priority: "translate"` to skip step 1, so any translation wins over rotation.

## Safety

- The server owns the send loop. It resends the current motion every 50 ms (written without response) and sends `stop` at
  once on release, then twice more 50 ms apart in case a write is dropped.
- The page heartbeats every 50 ms. The server stops if it hears nothing for 300 ms. A background tab is throttled well past
  that, so it stops too.
- The page sends `stop` on window blur or when the tab is hidden. Closing the tab stops the robot, and so do Ctrl-C and
  SIGTERM on the server.
- Only one page may drive. A second tab is refused.
- If BLE drops, the server exits without a final stop. The firmware's own dead-man stop halts the robot within 2 s.
- Every tx/rx line and page connect/close goes to `web-drive.jsonl`.

## Layout

- `src/motion.ts`: `resolveMotion` and `MOTION_RULE`. This is pure code, shared by the page and the tests.
- `src/input.ts`: the held-key set, gamepad axes and the e-stop latch. Also pure.
- `src/drive-loop.ts`: the send loop. Its clock and link are injected.
- `src/server.ts`: BLE, HTTP, the WebSocket and the esbuild bundle of `src/page/main.ts`.
- `src/link.ts`: copied from `drive-probe` (see the header for why). `protocol.ts` is imported from `../drive-probe/src`.
