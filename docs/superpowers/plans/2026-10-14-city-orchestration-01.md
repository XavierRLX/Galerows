# Cidade Dorme — CITY-ORCHESTRATION-01 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Host-authoritative, replay-safe phases and thematic offline narration for the LAN Cidade Dorme, with one intentional voice source and synchronized subtitles.

**Architecture:** Keep existing Room V2 authority and game transitions, without changing the generic protocol. Add host-stamped phase metadata (`phaseRevision`, `phaseEventId`, `phaseStartedAt`) to the City public projection only. The host game reducer allocates the new event ID whenever the canonical phase or round changes. All clients render the same phase and captions; only the host in `automatic` mode may play an offline prerecorded voice clip, gated by explicit playback activation to meet mobile autoplay policies. Human mayor remains manual narration (no two simultaneous voice sources). Snapshot recovery reads current phase; client never queues/catches up old narration.

**Tech Stack:** React, TypeScript, Vitest, Capacitor/WebView audio playback, Vite static public assets, host LAN Room V2.

**Spec:** `docs/superpowers/designs/2026-10-14-cidade-dorme-prefeito-traitor-jester.md` and `docs/superpowers/reviews/2026-10-14-city-settings-01-parity.md`.

## Global Constraints

- Work only in `/Users/renanxavier/Documents/GitHub/galerows-city-core`, branch `feat/cidade-dorme-core-01`, preserve other worktree and Vite Live on 4182.
- One authoritative host; no phase timers that can independently advance state or kill.
- Audio files embedded in the app, never streamed. No client choice changes host decisions.
- Do not expose role/targets in public narration, captions, or telemetry.
- Voice only on host in automatic mode, strictly opt-in for mobile playback. Mayor mode uses human narration by default.
- Keep existing 777+ passing tests and legacy `conductionMode` optional schemas.
- Do not claim physical validation without physical multi-device tests. No push, production deployment, or APK changes.

## Task 1 — Phase contract with TDD

- [x] Write failing tests for canonical phase metadata on start/reveal/night/doctor/detective/morning/discussion/voting/results/next night and reconnect snapshots.
- [x] Verify RED failure.
- [x] Add stable `phaseRevision`, `phaseEventId`, `phaseStartedAt` to City state/public projection; increment only on real phase changes, never ordinary role acknowledgments/votes or moderator consultation.
- [x] Verify GREEN, TypeScript and current multiplayer suite.
- [x] Check privacy and secret invariants.

## Task 2 — Static offline narrator with TDD

- [x] Write failing tests for one host audio source, unique event cue and local fallback.
- [x] Generate explicit Portuguese pt-BR voice clips using locally available system voice, convert to browser-compatible embedded format; keep source scripts next to manifest.
- [x] Implement media controller/hook that only plays in `automatic` on host, after deliberate user activation, once per distinct event ID; don't play previous event upon reconnect.
- [x] Keep public subtitles identical across every device from phase metadata; mayor does not auto-play.
- [x] Tests for repeated snapshots, reconnect and disconnection.

## Task 3 — Immersive phase UI (bounded)

- [x] Write RED tests verifying separate appearance for night/day, subtitles and audio opt-in controls.
- [x] Render thematic phase content with no duplicate lobby, accessible live region and phase-specific styling.
- [x] Verify GREEN plus mobile constraints where possible.

## Task 4 — Release gate

- [x] `npm test`; `npm run typecheck`; `npm run lint`; `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`; `git diff --check`.
- [x] Review behavior gaps, room authority and privacy; do not misrepresent realtime physical sync as proven.
- [x] Write review report with evidence and limitations, commit only in isolation.

## Explicit follow-on

Full cinematic timing with phase-bound acknowledgments, ambient sound mix, clock skew instrumentation, host suspension/reconnect policies and physical LAN latency tests are separate verified follow-on gates. An event-aligned UI alone does **not** establish synchronized audio playback to millisecond precision.

**Escopo entregue neste marco:** CITY-ORCHESTRATION-01A, ver `docs/superpowers/reviews/2026-10-14-city-orchestration-01a-phase-narration.md`. O gate de campo/latência/ack de todos os dispositivos permanece explicitamente em CITY-ORCHESTRATION-01B, não homologado por este marco.
