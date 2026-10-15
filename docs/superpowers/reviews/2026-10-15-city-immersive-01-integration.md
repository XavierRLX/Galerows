# CITY-IMMERSIVE-01 — Adapt visual prototype to approved LAN game flow

Date: 2026-10-15. Branch: `feat/cidade-dorme-immersive-integration-01`.
Working directory: `/Users/renanxavier/Documents/GitHub/galerows-city-core` (linked Git worktree).
Starting core: `c34509d`, preserving `feat/cidade-dorme-core-01` and live `feat/ux-hub-header-brand`.

## Scope / routing

- After `START_GAME`, the authoritative Room's `playing` phase directly renders `CidadeDormeImmersiveRound` for players. No second lobby, no duplicate game selection/configuration or ready state.
- Human mayor host (when `selectedConfig.conductionMode === 'mayor'`) instead sees the confidential moderator panel, never a personal role card, throughout playing/results; guest players use immersive game scenes.
- The existing lobby is unchanged before START_GAME. Results remain in game until an explicit `REPLAY_GAME` or `RETURN_TO_LOBBY`. Mayor panel now offers these actions after `END_GAME`/points.
- The only copied files from the live branch were `CidadeDormeImmersiveRound.tsx`, `cidadeDormeImmersive.css`, and the original component tests. No demo/preview Room, prototype lobby, five-second mock countdown, routes, simulated actors, Impostor changes, or old game reducer were brought in.

## Adapted to approved core

- Traidor role names/description, succession and night action: `privateState.activeKiller` authorizes action independent of the role label, while server `canAct` must be true. Allies are excluded from selectable kills. Legacy projection fallback applies only when `activeKiller` is absent.
- Doctor uses private `doctorEligibleTargetIds` (rather than outdated `eligibleTargetIds`), including self-protection when server-authorized and excluding disallowed repeat targets. Guest cannot obtain others' private target lists.
- Jester, Detective, voting and win/results use canonical Room snapshots; identity is explicitly revealed and hidden on blur/disconnect/phase re-entry. Reconnect requires fresh authorized private projection.
- Public canonical phase/subtitle from `CidadeDormeAtmosphere` is inserted compactly into each immersive chapter; only the automatic host can enable the bundled offline audio. Narrator gate persists across intentionally remounted private scenes, preventing duplicate old cues and repeated tap to enable for each phase. Each GameSession starts with a distinct gate.
- The mayor's PAUSE_CITY overlay disables game commands, and the separate moderator panel handles pause/resume, confidential consultation, results, replay and explicit lobby return. Mayor's secret consultation remains server-gated/expiring as implemented in CITY-MAYOR-02.
- CSS keeps visual viewport height, Android safe-area insets, target/result pagination at short heights and prefers-reduced-motion. Short-screen native visual inspection is not claimed.

## Superpowers / TDD evidence

- RED: Original 6 immersive tests failed without the component/route (`/tmp/city-immersive01-red-route.log`).
- GREEN: Original six tests passed after isolated import and routing (`/tmp/city-immersive01-initial-green.log`).
- RED: Five of six new rules/flow tests initially failed (Traidor, Médico, offline subtitles, authoritative pause, role results); one mayor routing test already passed because authority was preserved (`/tmp/city-immersive01-rules-red.log`).
- GREEN: All 12 original/new UI tests passed (`/tmp/city-immersive01-rules-green1.log`).
- RED: Narrator activation was lost on phase remount (`/tmp/city-immersive-narrator-red.log`). GREEN: persisted narrator gate, 17/17 directed tests (`/tmp/city-immersive-narrator-green.log`).
- RED: Mayor had no replay/return after results (`/tmp/city-immersive-mayor-replay-red.log`). GREEN: 21/21 tests (`/tmp/city-immersive-mayor-replay-green.log`).
- A previously valid test expected the removed `Ver meu papel` button from the old game; it was updated to assert immersive entry, `Meu papel` and absence of the lobby instead of weakening gameplay assertions.
- Final fresh gates: `npm test` **806/806 in 136 files PASS** (`/tmp/city-immersive01-release-tests.log`); `npm run typecheck` PASS (`/tmp/city-immersive01-release-type.log`); `npm run lint` PASS without warnings (`/tmp/city-immersive01-release-lint.log`); `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` PASS (`/tmp/city-immersive01-release-build.log`); `git diff --check` PASS. Verdict 0/0/0/0/0.

## Explicit limits / next gate

- This is game-flow visual integration, not implementation of prototype demo lobby or its mock 5-second countdown.
- In automatic mode, host advances the current approved Room phase controls. Full automatic timing and phase acknowledgments remain CITY-ORCHESTRATION-01B.
- No physical Android/WebView or two-phone LAN execution was performed, and no measured display clock/audio synchronization is claimed. Next step: physical tests for at least 4 players, host disruption, reconnection, role privacy, audio and screen sizes 320px/393px; human mayor + 4 players requires 5 devices.
- No modifications to Impostor sources, no Vite Live update, no push, merge, deployment, Capacitor sync or APK installation. The live worktree's tracked/untracked files were left unchanged.
