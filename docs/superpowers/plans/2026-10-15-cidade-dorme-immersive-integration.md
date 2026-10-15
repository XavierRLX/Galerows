# CITY-IMMERSIVE-01 — Game-session-only prototype integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the Cidade Dorme prototype's cinematic in-game screen **only after START_GAME**, without changing the shared lobby or any Impostor flow.

**Architecture:** Start from CITY-ORCHESTRATION-01A core (`c34509d`) in an isolated linked worktree. Read-only copy the two new untracked immersive visual files from the older live worktree. Route City playing/results to the immersive player component, except the dedicated human mayor, who retains a dedicated confidential moderation panel. Public canonical phase events feed a shared offline narration/visual banner in the player screen; private snapshots alone control identities and actions. Never copy old game engine or development-only preview routes.

**Tech Stack:** React 19 + TypeScript + Vitest + CSS + host-authoritative RoomV2 LAN + bundled offline audio.

**Spec:** `docs/superpowers/designs/2026-10-14-cidade-dorme-prefeito-traitor-jester.md`; `docs/superpowers/reviews/2026-10-14-city-orchestration-01a-phase-narration.md`.

## Hard boundaries
- Do not touch `/Users/renanxavier/Documents/GitHub/galerows`, which has numerous tracked/untracked changes including Impostor work; copy only the visual files into the isolated worktree.
- Do not copy or implement the prototype's demo lobby, 5-second countdown, simulated participant tools, local fake Room, or development preview routes.
- Do not alter Impostor code or existing room/transport semantics. No main branch, Vite Live server, deployment, APK, merge or push.
- Respect mayor authority, Traidor active succession, doctor self-protection, Coringa rules, reconnection, privacy and authoritative phase cues.

## Task 1 — Route in-game only (TDD)
- [x] Add failing tests: `START_GAME` immediately renders immersive identity (not lobby) and results/replay remain inside game; host mayor instead renders moderator panel and guest uses immersion.
- [x] Validate RED before edits.
- [x] Adapt visual components to core types and integrate in `LobbyRoomView.tsx`, without changing the lobby sections or Impostor.
- [x] Validate GREEN.

## Task 2 — Private role and action correctness (TDD)
- [x] Add failing tests for promoted Traidor's night attack, team roster, doctor self protection, disallowed doctor targets, absent unauthorized buttons, vote privacy, reconnect/blur secrets and pause.
- [x] Validate RED, update visuals to private authoritative fields (`activeKiller`, `doctorEligibleTargetIds`, `canAct`) and no role-name assumptions.
- [x] Validate GREEN.

## Task 3 — Narration and lifecycle (TDD)
- [x] Add tests that canonical phase subtitles display for guest/host, only automatic host has optional audio, mayor has human narrative, snapshots don't replay stale clips.
- [x] Add `CidadeDormeAtmosphere` to immersive game, preserve unique event ID and no stale audio.
- [x] Validate GREEN; inspect responsive CSS and `prefers-reduced-motion`. Physical short-screen visual validation is a later gate.

## Task 4 — Review and release gate
- [x] Run focused Vitest, full `npm test`, TypeScript, ESLint, LAN build, `git diff --check`.
- [x] Write review evidence and gaps, commit isolated feature. Physical LAN verification remains separate.
