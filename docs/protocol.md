# Acemate S10 protocol

Sources: jadx output of app 2.2.0, the T-3 review (`tennis/sources/T-3-sdk-review.md` §3.1), and live tests with `tools/drive-probe`.
**[HW]** marks facts confirmed on hardware (robot `ACEMATE-XXXXX`, firmware `v2.1.3_install`, 2026-10-11). Everything else is static analysis.

## Transport

- BLE Nordic UART Service. The robot advertises service `6e400001-b5a3-f393-e0a9-e50e24dcca9e` with local name `ACEMATE-<5 hex>`. Write to `6e400002-...`, subscribe to notifications on `6e400003-...`. **[HW]**
- There is no pairing, bonding, authentication or encryption. A fresh central can connect and drive straight away. **[HW]**
- **Outbound:** compact UTF-8 JSON plus `\r\n` (`bluetooth/BleCommandSender.java:55`), sent as a single write with response (Android writeType 2). The app keeps one write in flight and spaces plain commands at least **200 ms** apart (`BleCommandSender.java:39`).
- **Inbound:** messages end with `+==ACE==+`, not a newline (`bluetooth/BluetoothService.java:101`). The app strips control characters, drops `AT+EXIT`, splits on the marker, and keeps the text from the first `{` to the last `}`. **[HW]**
- KCP (ikcp: mtu 248, wnd 32/32) runs over the same characteristics for `set_mode` when it is enabled, and for file transfer with Zstd. Writes without response. Driving doesn't need it.

## Session

1. Connect, subscribe, send `{"type":"ask_init_data"}`. **[HW]** Reply:
   ```json
   {"type":"rsp_init_data","data":{"robot_id":"<robot-id>","rk_software_version":"v2.1.3_install","mode":"hdr","used_gb":15.53,"free_gb":40.55,"fire_music_volume":5,"servo_offsets":[10,14,0,10,130,22,0,90,61],"ble_mac":"<ble-mac>"}}
   ```
2. Poll `{"type":"ask_heartbeat"}` periodically. The app skips heartbeats while moving. **[HW]** Reply:
   ```json
   {"type":"rsp_heartbeat","data":{"car_state":{"car_loc_status":0,"time_is_set":false,"mode":"rally","running":false,"train_id":null,"runner_state":0,"bat":0}}}
   ```
   If `time_is_set` is false, the app sends `set_time` (epoch seconds, timezone id, country code). Meaning of `bat: 0` is unknown.

## Manual drive

```json
{"type":"motion_control","data":{"motion":"turn_left","shot_switch":"off"}}
```

- `motion` is one of: `go_front`, `go_back`, `go_left`, `go_right` (strafe), `turn_left`, `turn_right`, `stop`.
- `turn_left` sent 3 times at about 250 ms intervals, then `stop`, turns the robot. It works without `set_mode` or KCP, and the robot sends no reply. **[HW]**
- **The firmware has a dead-man stop.** One `turn_left` followed by 2.26 s of silence gave a brief turn that stopped by itself, well before our `stop`. **[HW]** The exact timeout lies somewhere between about 250 ms (continuous motion at that resend rate) and 2 s. It is probably tuned to the app's 500 ms resend.
- There is no speed or analog field. Each command is a discrete direction.
- While a button is held, the stock app resends every **500 ms** (`ui/device/DeviceFragment.java:93-103`) and sends `stop` on release. It blocks motion while a training run is active (`ui/device/DeviceViewModel.java:905-913`).
- `shot_switch` is carried by the same message. `serveRequestJson` sends `motion:""` with only `shot_switch`, so it probably arms or fires the launcher.
- `set_mode` `{"mode":"motion_control"}` is defined (`model/BluetoothData.java:73`) but has no callers.

- **Rate:** the robot accepts `motion_control` every **50 ms** written without response, which is 4 times the app's 200 ms spacing. A write with response costs about 40-60 ms of round trip. **[HW]**
- **No blending:** alternating two motions does not combine them. **[HW]**
  - `go_front`/`turn_left` 1:1 at about 240 ms or 150 ms juddered.
  - The same 1:1 at 50 ms was smooth but almost went straight.
  - A 1:2 ratio at 50 ms went forward briefly, then mostly turned in place.
  - The firmware behaves like a smoothed choice of one motion mode (the dominant recent command wins), not additive velocities. True move-and-turn needs a different command, if one exists robot-side.

### Implications for a dual-thumbstick controller

- The stock app is slow mostly because of its 500 ms cadence. The protocol floor is about 200 ms between plain commands.
- With only discrete directions, a thumbstick has to be quantized to the nearest of 7 commands. Blended translate+rotate needs an undocumented command or firmware access.

## Other message types

Requests seen: `ask_init_data`, `ask_heartbeat`, `kcp_handshake`, `set_mode`, `run_start`, `run_pause`, `run_stop`, `set_time`, `set_fire_music_volume`, `cross_app_feature`, `launcher_pitch_user_offset`, `camera_calib`.

Responses and pushes (`bluetooth/BluetoothMessageType.java`): `run_start`, `run_pause`, `rsp_heartbeat`, `rsp_set_time`, `rsp_set_mode`, `versionInfo`, `wifiHotspot`, `rsp_init_data`, `rsp_kcp_handshake`, `rsp_switch_camera_mode`, `rsp_stop_wifiHotspot`, `rsp_wifi_datareport`, `rsp_file_packing_result`, `rsp_camera_calibration_data`, `cross_app_feature`, `ble_speed_test`, `mcu_ota_result`, `rsp_court_profile`, `rsp_set_court_profile`, `alert`.

## Open questions

1. What is the exact dead-man timeout? Bisect with `pulse turn_left 1 --coast <ms>`.
3. What is the full `set_mode` payload for ball machine, drills and rally (speed, spin, placement)? Being surveyed in `tennis/sources/capabilities-survey.md`.
4. What runs on the Wi-Fi hotspot (ports and protocol for camera data)?
5. What does `bat` mean in the heartbeat?
