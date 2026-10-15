# CITY-AUTOPILOT-01 — Narração automática que conduz a partida

Approved 2026-10-15. Branch: feat/cidade-dorme-auto-orchestration-01, isolated worktree galerows-city-orchestration.

## Design constraints
- Existing four-device City lobby on port 4183 must remain untouched. No merge, deploy, APK, push, or updates to existing installations.
- Only the **automatic** conduction mode gets autonomous host commands. The dedicated human Mayor retains manual control.
- Host remains authoritative, including when the host has its own secret role. Other devices cannot issue phase transition commands, reveal secret targets, or become announcers.
- Server gates night decisions until the host finishes narration and minimum time elapses; no actor can skip narration by sending early commands.
- Only one voice, on automatic host. Arm the voice on the host's Start Game gesture; synchronize captions by canonical phaseRevision/eventId and stop voice on host blur/disconnect. If audio blocked, report fallback.
- Deliberate detective-result stage: result private to detective, with explicit acknowledgement. Never publish suspect/innocent to other players.
- Auto-advance all-ready roles, day intro, timed discussion, all-voted count, verdict and next night, avoiding duplicates. Never automate after host disconnect.
- Public during game: death/survival and vote verdict. Secret attempts, protection, investigation and ballots appear only in final historical recap.
- Doctor repeated protection allowed by default; separate limited self-protection.
- Use Superpowers TDD RED -> GREEN -> gates.

## Tasks
1. RED/Green server: authority, action gate, detective confirmation, result, history, winner-safe transitions.
2. RED/Green autopilot: pure planner, dwell, reconnect safety, host-only commands.
3. RED/Green audio/UI: start-gesture activation, contextual audio, detective result, complete recap.
4. Full test, TS, ESLint, build LAN, git diff; review and isolated commit.

## Default dwell
- Reveal ~5s; active role voice clip + ~1s; detective result stays until acknowledgement; morning ~7s; discussion ~35s; vote cue ~7s until all voted; verdict ~7s; summary ~7s.
- Host sends commands once per canonical phase revision, server validates phase and minimum time.

## Compatibility
Legacy configs without automatic conduction mode and dedicated mayor remain manual. No generic Room protocol changes. Physical tests pending.

## Implementation review

Implementation complete in isolated branch. See `docs/superpowers/reviews/2026-10-15-city-autopilot-01-implementation.md`. Physical LAN validation and authenticated pagination of exceptionally long histories remain future gates.
