# Galerows G1 — Games-first Implementation Plan

> **For agentic workers:** Use Superpowers test-driven-development and verification-before-completion. This is an execution plan with review stop before G2.

**Goal:** Preserve game catalog at `/` with all games discoverable, truthful supported-mode labels, and experimental Entrar/Criar LAN shortcuts without implementing discovery, persistent Room ownership, or real LAN GameAdapters.

**Architecture:** Keep `HubScreen`, `GameCard`, game-local routes, favorites/ads and PL-03 WSS unchanged in functionality. Put mode capability metadata in a pure registry; dynamically import experimental LAN entry actions only with a dedicated opt-in flag plus pre-existing native PL-03 flag; initial PL-03 join page consumes a safe UI-only query. No `Voltar à sala` until G2 owns the connection above routes.

**Tech Stack:** React 19, TypeScript, Vite 8, Vitest RTL, React Router 7, Capacitor 8.

**Spec:** `docs/superpowers/specs/2026-10-12-games-first-g0-ux-architecture.md`
**Security:** `docs/superpowers/specs/2026-10-12-g0-lan-discovery-security-review.md`

## Global constraints

- Branch: `feat/multiplayer-lan-task1-wss`; initial HEAD `fd8cc5c`, working tree contains two **preserved untracked G0 specs**.
- No main modification, push, merge, deploy, reset, package installation, native/WSS/NSD changes, or game LAN integration.
- Only host/guest synthetic PL-03 is usable under its existing experimental flag; no host identity weakening.
- Browser/default Release must not include experimental PL-03/lobby route or assets.
- No claim that Adedonha QR of categories is synchronized LAN; no active LAN buttons per real game.
- No active-room return button in G1 until G2 refactor of lifecycle.
- No new tests claimed passed before actually executed.

## Task 1 — Pure supported game capabilities (TDD)

**Files:** Create `src/features/games/gameModes.registry.ts` and `gameModes.registry.test.ts`.

- [ ] RED: tests assert Impostor shared-device and LAN planned; Adedonha personal sheet and LAN planned; all others remain existing-device/local only, coming-soon games do not offer actions; all registry IDs resolve.
- [ ] Run targeted test and inspect expected missing-module failure.
- [ ] GREEN: explicit tagged local modes, immutable/small registry, typed resolver; distinguish planned from available and forbid false LAN availability.
- [ ] Run targeted test; confirm pass.

## Task 2 — Catalog/game cards and explainability (TDD)

**Files:** Modify `GameCard.tsx`, `HubScreen.tsx`; add/update `GameCard.test.tsx` or `src/app/routes.test.tsx`.

- [ ] RED: user can view every game on `/`; game card shows current mode and explicit `LAN em preparação` only for the two planned games; card gives a keyboard-usable `Conhecer jogo` path to existing description/rules; favorites/usage and disabled game routes unaffected.
- [ ] Run tests for expected failures.
- [ ] GREEN: use resolver labels; small accessible action; do not create redundant mode-choice modal while no game supports two genuinely available options.
- [ ] Re-run targeted tests.

## Task 3 — Optional LAN home actions and route preservation (TDD)

**Files:** Create `src/features/hub/HomeRoomActions.tsx` and test; modify `HubScreen.tsx`, `routes.tsx`, UI-only `LanPersistentLobbyScreen.tsx` initial mode; update routes/PL-03 unit tests.

- [ ] RED: `/` stays Hub; opt-in native+PL-03 flag shows Entrar/Criar; default build does not expose it. Entrar opens legacy PL-03 join view; Criar opens legacy PL-03 create view; no dummy `Voltar à sala`.
- [ ] Run tests to observe RED.
- [ ] GREEN: lazy import HomeRoomActions behind `VITE_GAMES_FIRST_LAN_ENTRY=1` **and** `VITE_LAN_PERSISTENT_LOBBY_UI=1` **and** native; expose existing route with UI-only `entry` query; do not create/join automatically.
- [ ] Run targeted test, typecheck, lint and test suite.

## Task 4 — Gate review / validation

- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` without flags; inspect assets for `__lan-lobby-v2`, `LanPersistentLobbyScreen` or `pl03-entry` leakage.
- [ ] Run `git diff --check`, verify branch/main/changed files and no native modifications.
- [ ] Run Android native/JUnit only if justified by changed native code; otherwise explicitly state not re-run and retain historical PL-03 evidence.
- [ ] Write concise `docs/superpowers/plans/2026-10-12-g1-gate-report.md` with evidence, limitations, next gate G2 and STOP. No commit or push unless explicitly requested.

**STOP after G1.** G2 must move SessionManager ownership outside route BEFORE any functional active-room banner; G3/G4 may not be started implicitly.
