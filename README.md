# Acemate controller

An unofficial controller for the Acemate S10 tennis robot, built by reverse-engineering its Bluetooth Low Energy protocol for interoperability with the author's own device.

This project is not affiliated with, endorsed by, or supported by Acemate or SwitchBot. Names are used only to identify the hardware it works with.

## Safety

This software drives a physical machine that launches tennis balls and moves on wheels. Use it only in a clear, open area, keep people and animals away from the robot and its line of fire, and stay within reach of the robot's physical power switch. The protocol was worked out from one unit and one firmware version; behaviour on other hardware is untested. You use it at your own risk, with no warranty (see [LICENSE](LICENSE)).

## Layout

- `apps/web` - static Vite app: a Web Bluetooth controller with a launcher UI. Deployed to GitHub Pages.
- `tools/drive-probe` - Node CLI for scanning, listening and driving the robot over BLE.
- `tools/web-drive` - local server that drives the robot from a browser page and keyboard/gamepad input.
- `docs/` - protocol notes (`protocol.md`) and the analysis they came from (`apk-teardown.md`).

## Development

Use Node 24 (`.nvmrc`); Node 25's global `localStorage` breaks the happy-dom tests. In each package directory run `npm ci`, `npm run typecheck` and `npm test`.
