# CITY-NARRATION-MVP-01 — Lucas offline bundle and integration
Date: 2026-10-15
Branch: feat/cidade-dorme-auto-orchestration-01
Worktree: /Users/renanxavier/Documents/GitHub/galerows-city-orchestration

## Provenance and bounds
- ElevenLabs voice: Lucas – Deep & Profound Narrator, voice ID GIuLCSVfgJaUuh7hYOY8, model eleven_v4, pt-BR.
- The user approved the voice and all 15 phrases, including manually finishing four previously failed recordings.
- All 15 MP3 were read from existing ElevenLabs output or user's manual downloads; **no new speech generation or charges** during this integration.
- Local offline folder: public/assets/cidade-dorme/narracao-lucas/ (15 MP3, ~1.3 MB).
- Manifest: docs/voice/cidade-dorme-lucas-mvp-manifest.json. Each file has a SHA-256 and duration from afinfo.
- ZIP full source archive, outside repository: /Users/renanxavier/Documents/GitHub/galerows-city-narration-assets/galerows-cidade-dorme-lucas-COMPLETO-15.zip.

## Runtime changes
- Pure cue list: cidadeLucasNarration.ts maps authoritative phases and outcome to a sequence of one to three recordings.
- Host Audio element is reused across clips (Audio.play() after first user gesture); each clip end advances to the next; phase-complete callback only occurs after last audio.
- Server-host phase planner must observe the full phase-complete event before sending phase advance/unlock.
- Playback rejection and screen blur cause a narration interruption, requiring a user-gesture replay (the game should not auto-skip silently).
- Automatic narrator no longer invokes speechSynthesis for names; public player names remain in subtitles and result UI.
- Removed previous synthetic macOS narration M4As and generator script, avoiding bundling unused system-voice content.
- The game uses public LAN phase state; only host plays audio, all phones see captions. No network TTS during gameplay.

## Remaining release blockers / explicit NO-GO
1. **Physical end-to-end test** on S23 host, S26 FE, Moto G6, emulator has NOT been performed for this new voice; test audio unlock, consecutive cues, interruptions, role/vote synchronization, volume and latency.
2. **Commercial audio rights** must be proven for all existing ElevenLabs generations. Free-plan generations do not automatically become commercially licensed if the user later subscribes.
3. **Privacy role availability**: authoritative gameplay can skip doctor/detective turns if the roles are no longer alive. Players might infer role elimination from audio timing if roles are secret. Evaluate whether hidden-role configurations need dummy spoken transitions and pad timing before publishing.
4. **A/V and host failure recovery**: Android physical behavior after process loss, audio focus changes, route changes, and weak LAN still needs physical validation.
5. This is an isolated worktree only: no Live modifications, merges, pushes, deployments, Capacitor syncs or installations.

## Automated validation
- New tests for cue mapping, clip ordering, interruption, rejection, no system TTS and SHA-256 manifest.
- Existing audio/UI tests updated for approved spoken text, keeping mayor mode human-narrated.
- Final verification outputs: /tmp/city-lucas-full-final.log, /tmp/city-lucas-type-final.log, /tmp/city-lucas-lint.log, /tmp/city-lucas-build.log.

## Suggested next gate
CITY-AUTOPILOT-PHYSICAL-01: preserve existing live room and servers; test a fresh isolated build/port, never claim release-ready without passing device QA and resolving commercial rights.
