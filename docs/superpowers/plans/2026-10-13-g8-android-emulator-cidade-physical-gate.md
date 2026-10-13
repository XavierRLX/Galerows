# Galerows — Android emulator + 3 real Androids: Cidade Dorme LAN physical gate (13/10/2026)

## Authorization and source preservation
User explicitly authorized downloading/configuring an Android virtual device and testing with existing real phones. Galerows code `main` was not changed, no commit, push, merge, deploy, new physical APK install, app uninstallation, or data reset in this stage. Experimental branch `feat/multiplayer-lan-task1-wss` HEAD `fd8cc5c`, `main` `fbfb342`; `git diff --check`: PASS.

## Mac tools / AVD
- Host: Mac mini M1 arm64, 8 GiB RAM; ~75 GB free before image download.
- Installed official Android CLI command-line tools `commandlinetools-mac_arm64-15859902_latest.zip` into `~/Library/Android/sdk/cmdline-tools/latest`, matching SHA-256 `835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e`.
- With `sdkmanager` installed stable `system-images;android-33;default;arm64-v8a`, official Android 13 ARM64 default, revision 2.
- Created persisted AVD `Galerows_LAN_4`, Android 13/API33, ARM64, 1536 MB RAM, 2 CPU cores, 4 GB logical data partition, no camera and no Google Play image. First cold boot `sys.boot_completed=1`, emulator serial `emulator-5554`, Android Emulator 36.5.11. Starts headlessly with `-no-window -no-audio -no-snapshot -no-boot-anim -gpu host -memory 1536 -cores 2 -port 5554`. Emulator PID at gate 71153 (process IDs change).
- Official image uses ~4.2 GB under `~/Library/Android/sdk/system-images/android-33/default/arm64-v8a`; AVD grew to ~469 MB at gate under `~/.android/avd/Galerows_LAN_4.avd`.
- Boot initially showed an emulator temporary QEMU hang warning and offline ADB before recovering. Ultimately ADB online, RAM free system-wide ~39%, no fatal process exceptions in sampled logcat.
- Emulated network NAT `10.0.2.15` / virtual Wi-Fi; outgoing ping to Samsung host `192.168.0.89`: **2/2 replies**, ~75–113ms. The emulated guest **did not see DNS-SD/NSD multicast advertisements**; this is a limitation, not proof of broken actual network discovery.

## Four players
| Device | IP / transport | Android | Role |
| --- | --- | --- | --- |
| Samsung SM-S731B | Wi-Fi 192.168.0.89 | 16 | Host |
| Samsung S23 SM-S911B | Wi-Fi 192.168.0.90 | 16 | Guest |
| Motorola Moto G6 | Wi-Fi 192.168.0.91 | 9 | Guest |
| Android Emulator `Galerows_LAN_4` | NAT 10.0.2.15 (outbound to 192.168.0.89) | 13 | Guest |

- Installed previously prepared *isolated testing app* `com.galerows.app.lanpilot` to emulator **only**, ~11MB APK from `/tmp/galerows-physical-20261013/android/app/build/outputs/apk/debug/app-debug.apk`; app launched and WebView loaded.
- Created fresh Room from existing experimental app UI on Samsung host. Physical guests joined via automatic LAN discovery list. Emulator joined using full signed WSS invitation and verification code read directly from host UI **only in in-memory test orchestration**. Sensitive invitation, verification code, TLS fingerprint and secret role mapping were not logged or saved.
- Four devices synchronized one Room state, four members and active connection, without application error.
- Test automation used UI clicks and inputs through Chrome DevTools Protocol connected to the real Android WebViews over USB/ADB, **not direct calls to the game reducer**.

## Cidade Dorme LAN full round — PASS
1. Host selected Cidade Dorme and saved default roles (killer, doctor and detective enabled; jester disabled).
2. All 4 connected members marked ready. Host began game; every client's private role was concealed until deliberate local reveal.
3. All 4 acknowledged the personal role. Host started night; role-specific private info remained available locally, not in the public round projection.
4. Killer submitted kill against a citizen, doctor protected the same citizen (night ended with **no elimination**), detective investigated killer, and the four clients converged on morning.
5. Host opened discussion then voting. **4/4 separate UI votes** were submitted; 3 voted for killer, 1 for another player. Host resolved votes; all four received final game summary.
6. Host finalized the game; all four clients displayed `1 partida pontuada` and identical **ranked** score sequence `2, 2, 2, 0`, reflecting three members of the city's winning side. Ranking order was sorted; **not a 1-to-1 mapping of score by physical phone order**.
7. Host returned to the same lobby; all four members and ranking persisted; host ended the competition. All four displayed `Campeões da galera!` with 3 tied winners. No horizontal overflow in these views, no alert errors.
8. Sampled Android logcat: 0 `FATAL EXCEPTION` lines for testing package on all four devices. The four app processes remained alive in final audit.

**Gate result: PASS for one complete 4-participant LAN Cidade Dorme game with Android virtual 4th guest.** This complements the separate 3-physical-Android Impostor and Pista Única physical gate `2026-10-13-three-android-physical-gate.md`.

## Findings and caveats
- The emulated guest uses NAT, so automatic discovery not homologated for emulator. Manual WSS/pinned invite worked.
- There is a UI sequencing limitation: once a player taps `Confirmar meu papel`, the secret reveal button is disabled until the next phase, when the round component remounts. This was observed during automation; consider UX review, not classified as security failure.
- Asynchronous screen updates sometimes lagged under ~1s on physical guests/emulator. UI automation must wait for host-authoritative next phase; an early detective action was initially blocked until the emulated WebView received the updated phase. Retried after convergence and succeeded; no game engine fault asserted.
- Emulated fourth device is not equivalent to a fourth real Android for Wi-Fi multicast, battery, camera, wake locks, sleep/Doze, thermal and accessibility. **Four physical smartphones** remain desirable for final release gate.
- Physical QR camera scan, Wi-Fi drop/resume during City Dorme, hotspot, long-run stress, Doze, TalkBack/accessibility, multiple role combinations, adversarial WSS, host app close, and iOS client/server parity all remain pending.
- iOS LAN still disabled until native secure WebSocket host/client and full iOS build are validated. This Android outcome must not be presented as App Store approval.
- Emulator remains running headlessly after the gate, with game lobby showing final winners; can stop explicitly to release memory, AVD configuration persists.

## Installation footprint and commands
- `~/Library/Android/sdk/cmdline-tools/latest`: official SDK CLI added.
- `~/Library/Android/sdk/system-images/android-33/default/arm64-v8a`: official stable system image installed.
- `~/.android/avd/Galerows_LAN_4.avd` + `Galerows_LAN_4.ini`: isolated AVD.
- ADB serial: `emulator-5554`. To start again use `~/Library/Android/sdk/emulator/emulator -avd Galerows_LAN_4` (prefer GUI when testing manually; do not start a second concurrent instance).
- Existing real Androids' application/data untouched during this test stage.
