# Task 1 — Pista Única immersive workshop delivery

Status: DONE. Local commit `cf509ad` — `feat(pista-unica): create immersive workshop card experience`.
Worktree `/Users/renanxavier/Documents/GitHub/galerows-pista-visual-codex`, branch `feat/pista-unica-immersive-codex-01`, baseline `af3bf6e`. No merge, push, deployment, dependency installation or native installation.

## Implementation

- Unified presentational workshop shell for local setup/play/result and LAN. Petrol tabletop texture, lime/lavender paper cards with offset paper edges, tape, stamps, sealed backs, deal/reveal motion and award receipts; no repeated brand logo. Reduced-motion disables animations/transitions.
- Responsive fixed viewport shell avoids outer safe-area double padding. Content fits normal 320×568, 375×667 and 430×932; vertical overflow remains available for keyboard/font enlargement rather than clipping inaccessible content. Short-height refinements compact the LAN review/result. Existing global theme and other-game styles untouched.
- One-card clue/review pagination, two-award receipt pagination, three-row player/ranking pagination. Local review drafts survive page switches; validity reflects edited values using existing normalization/filter functions. Automatic/manual exclusion has explicit visible stamps. No rule mutation.
- Local setup has compact players/categories steps; all local phases use shared visual primitives. Resumed author/review screens require a deliberate reveal; blur/visibility loss removes private contents from the DOM while preserving the current draft. Save buttons block repeat clicks while pending; local save errors offer retry. Zero-clue completion requires confirmation. Result shows +2 guesser and each credited +1 author; old saves lacking creditedPlayerIds explicitly show unavailable historical credits without inventing authors.
- LAN retains real snapshot and action boundaries. Writer, guesser, assigned reviewer and waiting nonreviewer surfaces are distinct. Reviewer cards require reveal and conceal on blur/background. Reconnection remounts private UI. Received-count progress is accessible. Offline/busy state blocks actions; reconnect, back, exit/close confirmation and errors use existing callbacks.
- Narrow LobbyRoomView presentation branch renders Pista directly for playing/results (no extra lobby). END_GAME confirmation retains existing scoring semantics. Final totals use public.scores. After scoring, host gets existing replay/room callbacks; guests wait for host. No new transport or room state.
- Existing Portuguese Pista instructional translations corrected from obsolete +1/duplicate-dedup copy to approved +2/+1 and all duplicate clues removed; unified entry layout untouched. Pista continues its existing Portuguese fallback convention.

## TDD evidence

Read Superpowers test-driven-development SKILL.md, writing-good-tests.md and implementer-prompt.md before edits. Read required domain, interface, plan, entry, visual/brand references and inspected existing art. No subagents dispatched by implementer.

1. **RED**: `npm test -- src/features/pista-unica/PistaUnicaWorkshop.test.tsx src/features/multiplayer/lan/lobby/PistaUnicaLanRound.test.tsx` — **8 failed, 6 passed** (`red-1.log`). Expected missing behavior: resumed secret initially exposed, no local private-review gate/status pages, no zero-clue confirmation, no individual receipt/legacy warning, no paged totals, no received progress, no private-review concealment/pages, no end confirmation.
2. **RED**: local test file plus `LobbyRoomView.test.tsx` — **3 failed, 21 passed** (`red-2.log`). Expected missing compact setup step/accessibility and still-rendered lobby during gameplay; final classification also not implemented yet. Already completed local phases passed.
3. Existing LAN regressions updated for new explicit reveal and confirmation interaction; award assertion now scopes the actual author receipt instead of requiring contiguous paragraph text. No privacy assertions removed.
4. **RED integration finding**: `npm test -- src/features/multiplayer/lan/lobby/PistaUnicaProjection.test.tsx` — **1 failed, 2 passed** (`red-3.log`). Real authoritative room projections exposed a host-only back-to-lobby button to guest after END_GAME. UI corrected to show the host action only and waiting state for guest; runtime unchanged.
5. **GREEN**: four focused files (Workshop, LanRound, Projection, LobbyRoomView) — **36/36 tests, 4/4 files PASS** (`green-2.log`, final after viewport refinement `green-final.log`). No warnings. Real LocalPreferences/store/domain flow; real AuthoritativeRoomRuntimeV2 projections test host-guesser, guest reviewer, next-round host reviewer, nonreviewer privacy, 12 players and all 11 review cards, offline/busy/reconnect, +2/+1 scores, duplicate-only zero rounds and END_GAME staying in same room. Local coverage includes edited draft pagination, exact-answer/duplicate/manual stamps, zero confirmation, old save credits, ranking totals/replay and setup minimum category.

## Gates

| Gate | Exact result | Evidence |
| --- | --- | --- |
| `npm test` | **151 files passed; 949 tests passed**, 34.03s, exit 0 | `test-full.log` |
| Focused tests after final markup/CSS refinement | **4 files / 36 tests passed**, 1.74s, exit 0 | `green-final.log` |
| `npm run typecheck` | exit 0, no diagnostics | `typecheck.log` |
| `npm run lint` | exit 0, no diagnostics | `lint.log` |
| `npm run build` | content tests **26/26**, TypeScript and Vite PASS, final Vite build 380ms, exit 0 | `build-default.log` |
| `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` | content tests **26/26**, TypeScript and Vite PASS, Vite build 438ms, exit 0 | `build-lan.log` |
| `git diff --check`, `git diff --cached --check` | exit 0, no output | checked before commit |
| `git status --short` after commit | empty | clean committed source |

Full suite ran once; later changes were responsive presentation refinements and were covered by focused tests and final build/typecheck/lint. An initial lint pass discovered the ignored harness component needed an export for Fast Refresh; fixed harness and final lint is clean.

## Browser evidence (controller-run)

Controller owns browser checks and reports. At milestones the controller confirmed local pass/write/review/guess/result/ranking flow, +2/+1/+1 actual totals, duplicate Máquina/MAQUINA zero round, reload concealment, manual exclusion and pagination. An early 37px local review overflow and LAN overflow were corrected and retested.

Final controller message: LAN real-runtime harness all phases no-scroll PASS 320×568, 375×667, 430×932 (writing revealed, review revealed, guessing, round-result with 12 awards, results with 12 scores). Summary also passes 320. Metrics `lan-viewport-metrics.json` maintained by controller. Local screenshots include `pista-revisao-320.jpg` and other controller artifacts.

An ignored development-only `lan-preview.html` / `lan-preview.tsx` lives beside this report at controller request. It uses AuthoritativeRoomRuntimeV2 and genuine per-player snapshots, with simulated transport only; no platform spoofing, production route or permission mock. Harness excluded from commit/build. UTF-8 declared. Parameters: `phase`, `role`, `players`, `round`; `offline`, `busy`, `zero`, `wrong` flags.

## Files committed

- `src/features/pista-unica/PistaWorkshop.tsx` — shared presentation, deck pagination, cards, progress, awards, accessible confirmation.
- `src/features/pista-unica/pistaWorkshop.css` — entirely scoped workshop visuals/responsiveness/motion.
- `src/features/pista-unica/PistaUnicaPlayScreen.tsx` — local phase presentation/privacy/drafts.
- `src/features/pista-unica/PistaUnicaSetupScreen.tsx` — compact two-step setup.
- `src/features/pista-unica/PistaUnicaResultScreen.tsx` — final paged totals and replay.
- `src/features/pista-unica/PistaUnicaWorkshop.test.tsx` — six real local UI flows.
- `src/features/multiplayer/lan/lobby/PistaUnicaLanRound.tsx` — LAN immersion with existing contracts.
- `src/features/multiplayer/lan/lobby/PistaUnicaLanRound.test.tsx` — updated baseline plus new UI behavior.
- `src/features/multiplayer/lan/lobby/PistaUnicaProjection.test.tsx` — real room projection integration, 3 tests.
- `src/features/multiplayer/lan/lobby/LobbyRoomView.tsx` — narrow Pista presentation branch.
- `src/features/multiplayer/lan/lobby/LobbyRoomView.test.tsx` — direct entry/reconnect/back regression.
- `src/i18n/locales/pt-BR/pista-unica.json` — approved scoring/rules copy.

## Self-review and limitations

- Domain/runtime/scoring/session/persistent-room files, other-game rules/CSS, asset sources and unified entry source remain unchanged. No private snapshot is synthesized in production; all LAN private controls require the correct current session and assigned identity. Rendering IDs include player/session/round/phase/connection to conceal prior private views.
- React checklist applied: event listeners clean up, no conditional hooks, stable card keys, drafts owned above pagination, confirmation focus return and keyboard trap, semantically labeled inputs/actions, live pagination and progress. Small fixed participant count does not warrant memoization or new dependencies.
- Browser harness is simulated transport, **not physical LAN homologation**. Physical Android/keyboard/native back and actual multidevice LAN gate remain pending controller/user testing. Browser font zoom has scrolling fallback; no claim of exhaustive assistive-technology testing.
- No outstanding implementation concern found. Report/logs/harness remain in ignored `.superpowers` handoff directory as requested; source commit is clean.

## Ignored harness follow-up

Controller observed a development-only duplicate createRoot warning during HMR. The ignored `lan-preview.tsx` now retains its root and unmounts it in `import.meta.hot.dispose`, allowing module re-evaluation to mount a fresh root. Production source and commit `cf509ad` unchanged. Harness-only ESLint passed; browser retest remains with controller.

## Review fix 1 — provider-driven LAN action recovery

Commit `7ad3df5` — `fix(pista-unica): recover pending LAN actions after provider errors`.

Reviewer identified the production provider callback returns void and reports failures via busy/error props; the component's Promise catch could not clear `sent`. A failed CONFIRM_CLUES hid the review permanently until remount. Only `PistaUnicaLanRound.tsx` and its UI test changed; provider/domain/runtime remained untouched.

The component now tracks the previous provider busy/error inputs with a guarded render update. Once a changed provider status reports idle with error, the pending duplicate guard clears. The review stays concealed until the user deliberately reopens it. A new attempt with an unchanged prior error remains guarded; subsequent busy→idle releases another failure even when the error text repeats. The same UI guard serves clue/guess submission and now allows those failed submissions to retry with their draft intact.

- **RED:** `npm test -- src/features/multiplayer/lan/lobby/PistaUnicaLanRound.test.tsx` → **2 failed / 9 passed**; normal and zero-valid-card review both stayed disabled after the real void-callback / busy=true / busy=false+error prop sequence. `fix-1-red.log`.
- **GREEN:** `npm test -- src/features/multiplayer/lan/lobby/PistaUnicaLanRound.test.tsx src/features/multiplayer/lan/lobby/PistaUnicaProjection.test.tsx src/features/multiplayer/lan/lobby/LobbyRoomView.test.tsx` → **3 files / 34 tests passed**, 1.54s, exit 0. Covers normal and empty review retry, blocked pending action, unchanged old error after retry, repeated identical failure, and clue/guess draft preservation. `fix-1-green.log`.
- `npm run typecheck` → exit 0/no diagnostics (`fix-1-typecheck.log`).
- `npm run lint` → exit 0/no diagnostics (`fix-1-lint.log`).
- `git diff --check` → exit 0/no output; committed worktree clean.

An effect-based draft was rejected by the hooks lint rule; final guarded previous-input state avoids that effect and passes lint. Focused checks cover the amended UI; full suite/build evidence for the original delivery remains above. No visual/layout change in this fix; no new implementation concern.
