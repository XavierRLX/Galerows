# Galerows — G2.2 Background & UI Lifecycle Gate (12/10/2026)

**Status:** G2.2 **CODE/PREVIEW PASS**, **G2 PHYSICAL TWO-DEVICE PENDING**. No second device used. Do not advance G3, G4, G5 or production release from this result.

## Baseline

- Repository: `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch `feat/multiplayer-lan-task1-wss`; starting HEAD `fd8cc5c6f9f4a943cbeea214f3da2da58caf57dc`; `main` `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`.
- All pre-existing G0/G1/G2/G2.1 tracked and untracked work preserved. No reset, staging, commit, push, merge, deploy, dependency installation or native changes.
- Connected ADB device check at start: only Galaxy S23 (`SM_S911B`). The absent second device was not accessed.

## Investigated failure modes and TDD

1. **App foreground while JS timers have been suspended.** `RoomSessionProvider` previously refreshed authoritative guest/host state only through a 400 ms browser interval; an expired host could still appear as active immediately after foreground. A RED integration test reproduced the stale UI after native `room_expired` and foreground `visibilitychange`; GREEN added `visibilitychange` and `focus` listeners that call the existing `refreshSnapshot()` only when visible. Cleanup removes listeners. This also redacts a disconnected guest's private projection immediately on foreground instead of waiting for the interval, with integration coverage.
2. **Private card left revealed during background / app switching.** `LobbyRoomView` previously retained `revealedSessionId` during blur/hidden, making a deliberately exposed card still visible after returning. A RED React test reproduced it; GREEN resets the local reveal state on `window.blur` and document `visibilitychange` hidden. Separate tests cover both events. No host/guest WSS disconnect or Room reset and no change to the authoritative snapshot.
3. **Asynchronous QR update completes after Room teardown.** A RED integration test held a manual invite QR generation Promise, caused native host expiry, reset the UI, then rejected the outstanding QR task; the generic error overwrote the more important terminal-room message. GREEN adds a monotonically increasing **session epoch** to the provider. `run` only reports errors when the originating epoch is still active and provider mounted. The user-safe expiry reason remains on screen; stale operation results cannot override it. This does not change native invite/capability rotation.
4. **Additional regression coverage:** guest recovery event does not reopen leaked private state, and focus/visibility listeners preserve the session and do not send unsolicited WSS actions.

## Modified and added paths

- Modified: `src/features/multiplayer/lan/lobby/RoomSessionProvider.tsx`, `LobbyRoomView.tsx`, `RoomSessionProvider.test.tsx`, `LobbyRoomView.test.tsx`, `RoomSessionGuestNavigation.test.tsx`.
- Added: `docs/superpowers/plans/2026-10-12-g2-2-background-lifecycle.md` and this G2.2 gate report.
- Previous G2/G2.1 report and code retained.

## Verified checks

- `npm test`: **577/577 PASS (95 files)**. Previous baseline 572, +5 new tests; independently observed RED → GREEN in foreground, card privacy and stale QR error tests.
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- `npm run build` standard: **PASS**, compiled with normal flags only.
- Build opt-in: `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build -- --outDir /tmp/galerows-g2-2-experimental`: **PASS**; `RoomSessionProvider`, `LanPersistentLobbyScreen` and `HomeRoomActions` bundles present; experimental `/__lan-lobby-v2/entrar` and `/criar` routes present.
- Normal release guard: **PASS**, scanned `dist/assets` and the existing standard `android/app/src/main/assets/public/assets` for experimental paths/components — no contamination.
- Android native JUnit/Gradle not re-run because no native code changed; prior evidence remains historical, not claimed as new success.
- `git diff --check`, branch/main and status to be verified at final stop.

## Remaining limitations

- **No new physical test**: two-device `room → catalog → room` continuity and `counter` command after foreground are still pending. JSDOM visibility events establish code behavior, not OS/Android Doze, Bluetooth, network Wi-Fi link or WSS persistence under background suspension.
- Process death/reboot still ends the host's in-memory Room; no new recovery promise.
- This does **not** explain or claim to fix the previously observed first-attempt guest admission intermittent failure; sensitive tokens/pins stay private.
- G3 discovery, G4 simplified admission and G5 multiplayer game adapters remain unstarted. Before G4 any host identity UX change requires explicit security design approval.
- Stop before commit/push/deploy and do not enable any production LAN flags.

**Gate:** G2.2 CODE PASS; G2 PHYSICAL INCOMPLETE. Safe to continue non-physical G2 tests/hardening later.
