# Galerows G8A — Three-game LAN Room integration + iOS Bonjour discovery gate

Date: 2026-10-13
Repo: /Users/renanxavier/Documents/GitHub/galerows
Branch: feat/multiplayer-lan-task1-wss
HEAD: fd8cc5c, main fbfb342 (untouched)
User approval: proceed correctly after G7, including integration audit and iOS work.
Restrictions upheld: do not commit/push/merge/deploy/install/alter native devices, preserve existing edits/untracked, no additional npm package.

## A. G8A integration: PASS

New integration fixture: `src/features/multiplayer/threeGamesRoomIntegration.test.ts`.

1. Four authenticated Room members remain the same in a single Room across three consecutive **real** LAN game adapter GameSessions: Impostor → Pista Única → Cidade Dorme, with the matching room config and each ready barrier.
2. Impostor group win 3 points across the 3 innocent members; Pista Única one correct guess for each of 4 participants = 4 total; Cidade Dorme city team win 2 points for each of 3 citizens = 6 total; **13 total authoritative points**. `completedGames=3`, each `played=3`. `END_GAME` is counted only once per GameSession.
3. After each results → lobby, `privateState=null` and `gamePublicState=null` for every player. New game session IDs are distinct; stale commands from the old game are rejected with `stale_game_session`.
4. All members see the same public competition and membership, no score allocation payload allowed and game cannot be ended before summary. Host-only `FINISH_SESSION` preserves scoreboard and prevents starting another match.
5. Every snapshot stays under the v2 frame cap. Existing per-game security tests retained.
6. One integration test initially failed due to **incorrect test math** (expected 11, actual 13 = 3+4+6); corrected expected total. Both integration tests pass.

## B. iOS discovery — source stage ONLY, not native runtime validated

**Created:** `ios/App/App/GalerowsRoomDiscoveryPlugin.swift`.
- Implements Capacitor 8 `GalerowsRoomDiscovery` interface (`startScan`, `stopScan`, `lanRoomDiscovery` events) using native `NetServiceBrowser` for Android DNS-SD service `_galerows._tcp.`.
- Treats Bonjour as **untrusted**: validates app `galerows`, protocol `v=2`, six-digit code, roomId pattern, 64-hex certificate fingerprint, private IPv4, port, bounded room name; no credentials, private keys, invite capabilities or role projections are advertised via discovery.
- Manages search resolution, stop, loss and cleanup; 48-resolution cap. Produces `found/lost/error` to the existing TypeScript `lanRoomDiscovery.ts`.
- Registers plugin instance using a custom `GalerowsBridgeViewController` set as the native storyboard root. Adds Swift file to Xcode project sources. Adds iOS `NSLocalNetworkUsageDescription`, `NSBonjourServices: _galerows._tcp`, and `NSCameraUsageDescription` for user-triggered QR scanning.

**Verified:** `xcrun swiftc -frontend -parse` Swift source PASS; `plutil -lint` project/plist PASS; `xmllint` storyboard PASS; `git diff --check` PASS.

**BLOCKED:** iOS full native `xcodebuild` Debug simulator compilation has NOT completed: Xcode/SwiftPM stalled over 3 minutes while checking out dependencies for existing AdMob/RevenueCat and Capacitor Swift packages, before reaching compilation. Owned Xcode audit process was terminated gracefully; output: `/tmp/galerows-ios-lan-audit-build.log`. The new Swift plugin has **not** been typechecked/linked against Capacitor in the native build. Do not label it compiled, tested, or production-ready.

**NOT IMPLEMENTED:** iOS equivalent of `GalerowsLanSecureClient` with pinned certificate + Keychain durable resume credentials; iOS equivalent of `GalerowsLanServer` with ephemeral TLS identity, versioned WSS host, local address; discovery advertisement from iOS host; iPhone↔Android network/physical tests. The Android WSS certificate fingerprint is SHA-256 of DER-encoded self-signed TLS leaf certificate, never a DNS TXT authentication token. Cross-platform acceptance cannot proceed until native work.

## C. iOS user-facing safety gate

Added `src/features/multiplayer/lan/lanPlatform.ts`, `lanPlatform.test.ts`:
- `lanNativeMvpAvailable() = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'`.
- Used in `src/app/App.tsx` LAN provider lazy-loading, `src/app/routes.tsx` native LAN routes, `src/features/players/PlayersScreen.tsx` room entry UI. Updated existing Android test fixture to set `Capacitor.getPlatform()='android'`.
- Result: incomplete iOS transport **does not** show Create/Join LAN buttons, while iOS offline/pass-the-phone game modes remain untouched. LAN experimental on Android still supported. Remove this temporary gate ONLY after iOS host + guest pass native and physical security gates.
- Three native-platform test cases cover Android allowed, iOS blocked, browser blocked.

## D. Regression gates

- `npm test`: **648/648 PASS in 107/107 test files**, log `/tmp/galerows-g8-integration-test.log`.
- `npm run typecheck`: PASS, `/tmp/galerows-g8-ts.log`.
- `npm run lint`: PASS after correcting an unused local test variable, `/tmp/galerows-g8-lint-final.log`.
- `npm run build` default: PASS, `/tmp/galerows-g8-default-build.log`.
- Default JS + existing Android assets bundle guard: PASS — no LAN commands/imports exposed. `/tmp/galerows-g8-default-bundle-leak.log`.
- Experimental build with `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1`: PASS, `/tmp/galerows-g8-experimental-build.log`. Commands of all three LAN games found in experimental bundles.
- `git diff --check`: PASS; required branch + main SHA preserved.
- iOS `xcodebuild`: **NOT VERIFIED / BLOCKED at SwiftPM**, as documented above.

## E. Next tasks, in order

1. G8B — Resolve Xcode package checkout in isolated derived-data/cache with no changes to production; complete full iOS simulator build and fix genuine Swift type errors. Audit iOS simulator runtime discovery (best effort, Bonjour mDNS network limitations).
2. G8C — Implement **pinned native WSS iOS secure guest** plus **Keychain versioned resume vault** with immutable fingerprint verification, no security bypass and no plaintext persistence; JS bridge parity & tests.
3. G8D — Implement **iOS host** (`GalerowsLanServer`): ephemeral trusted certificate identity, per-Room secure WSS, framed protocol v2, DNS-SD advertisement, authenticated peers and lifecycle; unit tests and Xcode build.
4. G8E — Android ↔ iPhone physical tests, Wi-Fi/hotspot, mDNS, QR/6-digit enrollment, 4+ client Cidade Dorme, role secrecy, reconnection, background, loss-of-host and session scoring.
5. G9 — native release, signing, privacy, stores. Never market iOS multiplayer before all preceding gates pass.

**Outcome:** G8A integration PASS; iOS discovery in source/provisional stage, simulator compile blocked, full iOS multiplayer still a release blocker. No commit/push/merge/deploy/installation executed.
