# G2 — RoomSessionProvider above routes: TDD execution plan (2026-10-12)

**Approved:** user approved G1 and authorized progression to G2. Baseline `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`, all pre-existing G0/G1 edits/untracked files preserved. **No reset, no main, no commit/push/deploy by default.**

## Goal
A single in-memory provider must outlive route screens on Android experimental builds. Returning from a live Room to `/` and back must not stop the native host, disconnect a guest, revoke credentials, or lose public/private-revision synchronization; explicit leave/close must still be terminal. Nothing should expose privileged state to another participant. Keep games-first home.

## Scope and TDD

1. **RED:** Integration test from native Room entry -> join/create host -> active -> home -> live Room asserts host never stopped during route transition, Room state/revision unchanged, banner appears only while active, explicit close stops and removes banner. Guest path must retain connection, snapshot and secure resume capability; tests for provider-unmount cleanup and a non-active session.
2. **GREEN:** Extract controller hook into `RoomSessionProvider` with one persistent host/runtime/guest owner and shared context, mounted above `AppRoutes`, gated by both experimental flags and Capacitor native. Route view consumes context and only allocates UI state. Standalone test render may inject local provider to preserve original PL-03 unit regressions. Poll/callback actions and snapshot ownership remain in provider; lifecycle cleanup only provider teardown and explicit terminal calls.
3. **RED/GREEN:** Home shows `Voltar à sala` with room identity/status if and only if provider has an active Room, while keeping `/` all games and no active-room CTA otherwise. Room UI exposes `Ver jogos` without calling `leaveRoom`/`stop`; clear card reveal state upon route unmount.
4. **Boundary regression:** Changing route neither resets room sequence nor `RoomCoordinatorV2`/guest admission. Keep guest resume via Keystore after transport failure. No persistence over full OS process kill for host (requires external design/gate). Ensure guest disconnect scrubs private projection; no keys/tokens in ad card/links/storage.
5. **Verify:** focused tests, full `npm test`, `typecheck`, lint, standard and gated builds, source guard no experimental code in regular build, `git diff --check`, Android JUnit if available, any physical limitations clearly reported.
6. **STOP:** save a G2 gate report and stop before G3 (NSD discovery) / G4 (security) / G5 (real adapters).

Constraints: TLS 1.3 WSS pin, host fingerprint check, capability envelope, admission/ack, Keystore resume stay unchanged. No 6-digit code as sole authentication. No new dependencies.
