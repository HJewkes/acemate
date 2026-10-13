# drive-probe

Purpose: a laptop CLI for scanning, listening to and driving the robot, and for aimed launches. Commands: `scan`, `listen`, `drive`, `pulse`, `launch`. Keep a hand near the power switch and read the Safety sections below before sending anything.

Laptop probe for confirming the Acemate S10 BLE link and manual-drive commands from `docs/protocol.md`.
The real SDK replaces it (T-3/T-4); keep it only as long as it answers questions.

## Run (macOS laptop, robot powered on, stock app closed)

```sh
npm install
npm run scan            # lists NUS devices; no connection
npm run listen          # connects, sends ask_init_data, polls heartbeat, logs everything
npm run drive           # keyboard drive; add -- --remote-mode to send set_mode first
```

The first run prompts for Bluetooth permission for your terminal (System Settings > Privacy & Security > Bluetooth).
Only one central can hold the robot, so force-quit the Acemate app on your phone first.

## Safety

- Clear space around the robot and keep a hand near the power switch.
- Terminals never report key-up, so release is inferred from key-repeat going quiet. Once repeat is running, `stop` goes out
  `--repeat-hold` ms (default 90) after the last repeat. A single tap waits `--initial-hold` ms (default 300) to cover the OS's
  initial repeat delay (225 ms on this Mac). A held direction is resent every `--interval` ms (default 200, the app's minimum
  command spacing). New directions and stops go out on the next `--tick` (default 20 ms).
- `space` stops immediately, and quitting sends `stop` before disconnecting. The session ends itself after `--max-seconds` (default 120).
- An unexpected disconnect exits without a final stop. Whether the robot stops on its own when commands lapse is an open question, so test that at low stakes first.

## Aimed launch (on court only)

`npm run launch` builds a launcher routine (`set_mode` then `run_start`; see `src/launch.ts`). **It is a dry run by default.**
It prints the exact JSON it would send and connects to nothing. Only `--fire` touches the robot.

```sh
npm run launch -- single --dir 0 --speed 1 --spin 0 --elev 20            # dry run: print the JSON
npm run launch -- single --dir 0 --speed 1 --spin 0 --elev 20 --fire     # one ball
npm run launch -- sequence --ball 0,2,0,20 --ball 5,2,0,20 --interval 5  # short ball_machine sequence
npm run launch -- target --x 0 --z 16 --height-level 3 --spin 0          # drill shot at a court point (metres)
```

With `--fire` it sends `ask_init_data`, then checks that the heartbeat shows `running:false`. Next it sends `set_mode` and
waits `--timeout` ms (default 5000) for `rsp_set_mode`. If the reply never arrives it aborts without `run_start`.
After `run_start` it polls the heartbeat for up to `--watch` s (default 20). Ctrl-C, any error, and a normal finish all send
`run_stop` before disconnecting. Every tx/rx goes to `--log` (default `launch.jsonl`).

S10 limits are enforced, and anything outside them is rejected rather than clamped: direction -15..15, speed 1..10, spin -3..3,
elevation 10..40, interval 1..15 s in 0.5 s steps, height level 1..10, and target |x| ≤ 4.115 with z 7..23. The probe also
caps a routine at 10 balls.

### Safety

- Sending `set_mode` over plain BLE (without KCP) has **never been tried on hardware**. The robot may ignore it, reject it,
  or behave unexpectedly.
- An unexpected disconnect cannot send `run_stop`. Keep a hand near the power switch.
- Direction is in the app's UI convention, and the payload negates it as the app does. Which way positive points is
  unconfirmed, so prove it with dir 0 first.
- The robot fires from wherever it stands. `ball_machine` sends no position.

### First-shot checklist

1. Be on a court with nobody in front of the robot or within the launcher's arc, and the net bag in place.
2. Close the Acemate app on your phone (only one central can connect). Run the dry run and read the JSON.
3. Use the lowest speed, dir 0, spin 0 and elev 20: `single --dir 0 --speed 1 --spin 0 --elev 20 --fire`.
4. Stand behind the robot. Be ready to Ctrl-C or hit the power switch.
5. Afterwards keep `launch.jsonl` and note whether `rsp_set_mode` arrived and whether a ball came out.

## Questions this should answer

1. Does the robot accept motion commands with no pairing or auth beyond `ask_init_data`?
2. Is `set_mode: motion_control` (`--remote-mode`) needed? The app defines it but never calls it.
3. Does the firmware stop on its own when `motion_control` resends stop arriving? After how long?
4. How fast a resend rate does it accept, and does a faster rate make movement smoother?
5. What do `rsp_init_data` and `rsp_heartbeat` contain? They're captured in `drive-probe.jsonl`.
