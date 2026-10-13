# Acemate Tennis APK teardown

## Artifact

| Field        | Value                                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| Package      | `com.pku.acematetennis`                                                         |
| Version      | 2.2.0 (code 158), minSdk 24, targetSdk 36                                       |
| Source       | APKPure via `apkeep` 1.1.0, 2026-10-11 (Google Play needs credentials)          |
| XAPK sha256  | `796c1714b5551edb860a3fc7cc2bb840b30a129d49dc391089ea996d2634b6a6`              |
| Contents     | base APK + `config.arm64_v8a`, `config.en`, `config.mdpi` splits                |
| Split signer | `CN=Android, O=Google Inc.`, SHA-256 `06:E7:EA:36:...:ED:D4` (Play App Signing) |
| Base signer  | not read: no v1 signature; check the v2/v3 block with `apksigner`               |

APKPure has served tampered apps before. We only read this artifact statically; never install it.
Before trusting byte-level details, compare against an APK pulled from the owner's phone with `adb`.

## Where things live

- `~/re/acemate/apk/`: the downloaded XAPK
- `~/re/acemate/xapk/`: unpacked splits
- `~/re/acemate/jadx/`: jadx 1.5.x output (18,355 files; 325 methods failed to decompile, which is normal)
- Tools: `~/.local/opt/jdk21`, `~/.local/opt/jadx`, `~/.local/bin/apkeep`

## Stack

- Native Kotlin app (kotlinx.serialization, coroutines, Dagger/Hilt, Glide, Coil). No Flutter, React Native or Unity.
- App code: `com/pku/acematetennis/` (`bluetooth/`, `bluetooth/kcp/`, `ui/device/`, `ui/ballmachine/`, `model/`).
- Third-party: Umeng analytics, Alibaba OSS (file upload), WeChat SDK, Google PairIP (`com/pairip`, Play integrity/license check).
- Native libs (arm64-v8a): `libkcp.so` (KCP ARQ), Zstd (`ZstdNative`), `libdatastore_shared_counter.so` (androidx).

## Connectivity

- **BLE, Nordic UART Service.** Write `6e400002-b5a3-f393-e0a9-e50e24dcca9e`, notify `6e400003-b5a3-f393-e0a9-e50e24dcca9e`, CCCD `2902`, MTU 512 requested. See `bluetooth/BleManager.java:59-60` and `BleManager$gattCallback$1.java:157`.
- **KCP over BLE.** A KCP session (handshake `{"type":"kcp_handshake","data":{"conv_id":N}}`) carries file transfer and `set_mode`. See `bluetooth/kcp/BLEKCPTransport.java:42`.
- **Wi-Fi.** The app joins a robot hotspot via `WifiNetworkSpecifier` (`tool/WifiConnector.java`, `ui/device/calib/vm/CameraCalibrationVM.java`) for camera calibration and data reports. Likely the path for images and video.

See `protocol.md` for message formats.
