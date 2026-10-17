# Pista Única — browser verification

Actual local preview VITE_APP_PREVIEW=1 on localhost:5180, no platform/private-state injection. CUA browser6/tab4. Native LAN physical run remains pending.

## Completed real local flow
- Created Ana/Bia/Caio guests via setup, selected words.
- R1 target Avião; Bia Asas and Caio Aeroporto. Writer cards concealed before reveal, pass between people, private review pages, guess only valid cards. Correct result Ana+2/Bia+1/Caio+1.
- R2 target Robô; Máquina / MAQUINA both labeled repeated, zero valid count, explicit confirmation to conclude, result0.
- R3 target Dinossauro; reloaded while writer private card open; resumed concealed until explicit reveal. Jurássico/Extinto; manually removed first clue, label and valid count updated. Guess only Extinto; pass result0.
- Ranking totals Ana2/Bia1/Caio1 after all rounds. Nova partida returns setup.
- New setup12 guests: three players/page, pagination reachable, categories separate screen.

## Viewports
- Guess, round result, ranking: 320x568 /375x667 /430x932 all document width/height match viewport, no internally overflowing auto regions. See viewport-metrics.json.
- Pass-clue/writer: 320x568 match viewport, no internal overflow.
- Review initial37px internal overflow reported and corrected; final 320x568 no internal overflow, button+target/count visible. pista-revisao-320.jpg.
- Setup12 participants and categories: 320x568 no overflow, all actions visible. pista-categorias-320.jpg.
- Browser console error/warn query empty after full flow.

## Screenshots
- pista-cartas-375.jpg
- pista-pontos-320.jpg
- pista-revisao-320.jpg
- pista-categorias-320.jpg

## Remaining
- LAN authorized projection harness responsive check if supplied; no physical multi-device/reconnect claim.
- Automated gates/reviews in progress.

## LAN visual verification (development harness, simulated transport)
Harness imports real AuthoritativeRoomRuntimeV2 and adapter and obtains only snapshotFor(role). No production route, platform spoof or UI private-state injection. Files ignored in evidence directory.
- 12-player writer revealed, review revealed, guesser, round-result, summary/results: final320x568 all fit with no document/internal scrolling. 375x667 and430x932 writer/review/guess/result/final also fit. lan-viewport-metrics.json.
- Initial320 internal overflow41–107px fixed: exit moves header, compact spacing, 2 award rows/page. All award recipients still reachable.
- Offline reviewer sees concealed state. Reconectar (simulated) returns closed card until explicit reveal. Manual review removal updates authorized runtime projection count11→10.
- Exit confirm focus starts cancel; Shift+Tab stays within dialog to confirm; Escape cancels and focus returns header. Private review hidden before exit dialog.
- pista-lan-revisao-320.jpg screenshot saved.
- Physical LAN, native keyboard/safearea on real devices, OS screen reader and actual radio reconnect remain pending. CSS reduced-motion rule checked in source (not OS setting changed).
