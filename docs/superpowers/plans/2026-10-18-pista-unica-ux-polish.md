# Pista Única — UX Polish Implementation Plan

> **For agentic workers:** Apply Superpowers TDD, isolated worktree, verification and review in this branch. Execute tasks inline as requested; do not merge, push, deploy or install Android.

**Goal:** Add accurate round category above approved clue cards, horizontal swipe for workshop decks and scrollable bulk player selection without changing gameplay.

**Architecture:** Derive category from the current local target or the server-authorized LAN public projection; never expose target identifiers or unpublished clues. Keep deck paging ephemeral in the presentation component. Keep setup players and guests as separate collections with a total cap of 12.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite, Capacitor Android WebView.

**Spec:** User-approved task “Galerows — Ajustes de UX do Pista Única” (18 Oct 2026).

## Global constraints

- Baseline: `feat/mvp-app-completion-01` at `d218d28`; new isolated branch `feat/pista-unica-ux-polish-01`.
- Categories: `words`, `movies`, `series`, labels from `pista-unica` i18n.
- Do not change target selection, rules, scoring, privacy, LAN commands, visual identity, or other games.
- Swipe must not activate buttons/inputs, swallow vertical scroll, persist game state or emit LAN actions.
- Registered bulk selection reserves guest slots; guests remain separate.
- Commits per functionality; local only.

## Task 1: Publicly authorized category during guessing

**Files:** `src/features/multiplayer/pistaUnicaLanGame.ts`, `src/features/multiplayer/lan/lobby/PistaUnicaLanRound.tsx`, `src/features/pista-unica/PistaUnicaPlayScreen.tsx`, tests in the same feature directories.

- [x] RED: Test each category, missing category before approval, no `targetId` or secret in public/guesser snapshots, round advancement and snapshot recovery. Test visible localized category above clue deck in local and LAN screens.
- [x] Run `npm test -- src/features/multiplayer/pistaUnicaLanGame.test.ts src/features/multiplayer/lan/lobby/PistaUnicaLanRound.test.tsx src/features/pista-unica/PistaUnicaWorkshop.test.tsx`; inspect expected failures.
- [x] GREEN: Add `roundCategory: PistaUnicaCategory | null` to public projection, populated from current target only once clues are authorized. Render a compact component label using `t(\`categories.\${category}.name\`)` on the guessing screens.
- [x] Re-run focused tests, refactor for clarity, review projection privacy.
- [x] Commit `feat(pista): show current round category on clue cards`.

## Task 2: Swipe navigation in CardDeck

**Files:** `src/features/pista-unica/PistaWorkshop.tsx`, `pistaWorkshop.css`, `PistaWorkshop.swipe.test.tsx`.

- [x] RED: Test left/right, ends, short tap/drag, vertical scrolling, input/button-origin guard, grouped pages, arrow fallback and independent deck state.
- [x] Run `npm test -- src/features/pista-unica/PistaWorkshop.swipe.test.tsx` and observe missing behavior.
- [x] GREEN: Track only a touch/pen pointer start via React ref; navigate on pointer release only beyond threshold with dominant horizontal movement. Add `touch-action: pan-y`, preserve keyboard arrows, reduce-motion CSS and a first-page hint.
- [x] Re-run focused tests and review component behavior; commit `feat(pista): support swipe gestures in workshop decks`.

## Task 3: Scrollable player setup and select all

**Files:** `src/features/pista-unica/PistaUnicaSetupScreen.tsx`, `pistaWorkshop.css`, `PistaUnicaSetupScreen.test.tsx`.

- [x] RED: Test individual and bulk selection, contextual button, 5/12/>12 players, guests occupying slots and unaffected removal, count, minimum 3, duplicate names, scroll container and advance state.
- [x] Run `npm test -- src/features/pista-unica/PistaUnicaSetupScreen.test.tsx` and observe failures.
- [x] GREEN: Replace setup-only CardDeck with height-capped vertical scroll list; derive bulk capacity from guest count and select in stored order up to 12; keep manager, input, footer and guest behavior.
- [x] Re-run focused tests and review 320/375/430 layout; commit `feat(pista): add scrollable player selection and select all`.

## Task 4: Final verification and evidence

**Files:** `docs/superpowers/reviews/2026-10-18-pista-unica-ux-polish.md`.

- [x] Focused game and projection tests.
- [x] Complete `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, plus `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`.
- [x] Confirm `git diff --check`, clean worktree after commits, log exact SHA and test results.
- [x] Document baseline, file changes, behavior, privacy, visual/Android coverage and honest pending gates; commit documentation locally.
