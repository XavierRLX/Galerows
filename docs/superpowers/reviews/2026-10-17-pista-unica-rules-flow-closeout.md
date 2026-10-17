# Galerows — Pista Única | Fechamento do fluxo e pontuação

Data: 17/10/2026. Worktree: `/Users/renanxavier/Documents/GitHub/galerows-pista-flow`; branch `feat/pista-unica-scoring-review-01`; baseline `81bf287`.

## Aceite de produto

Usuário aprovou regra A: +2 ao adivinhador certo, +1 a **cada** autor de pista válida e não excluída **somente no caso de acerto**; nenhum ponto em erro ou ausência de pistas. Dicas iguais normalizadas **todas** excluídas; uma dica exatamente igual à palavra secreta é excluída; revisão manual permitida por pessoa autorizada. O redesign visual será delegado ao Codex **após** completar o fluxo.

## Entregas realizadas

- **Modo 1 celular** (`pistaUnica.session.ts` e `PistaUnicaPlayScreen.tsx`): deduplicação simétrica entre todas as pistas, rejeição do texto igual à palavra secreta, revisão manual existente preservada, pontuação +2/+1, rodada sem pistas encerra sem bloquear, resultado traz `creditedPlayerIds?` opcional para compatibilidade com sessões legadas `schemaVersion:1`.
- **LAN** (`pistaUnicaLanGame.ts`): `writing → review → guessing → round-result → summary` com rotação do adivinhador e passagem de rodada pelo host. Se todas as pistas são inválidas, `round-result` direto, zero pontos. O host que estiver escrevendo revisa; se host for adivinhador, o primeiro escritor revisa. `SET_CLUE_INCLUDED` para remoção/reinclusão manuais de dicas elegíveis e `CONFIRM_CLUES` para liberar palpite. Dicas excluídas por repetição ou igualdade à palavra não podem ser reincluídas. Contribuições do autor chegam somente ao snapshot **privado** do revisor; público e adivinhador não recebem pistas antes de `guessing`.
- **UI LAN provisória funcional** (`PistaUnicaLanRound.tsx`): revisor autorizado vê e controla os itens privados, demais jogadores aguardam sem vazamento; acerto exibe +2 ao adivinhador e +1 aos contribuidores habilitados. O Codex fará a identidade visual imersiva.
- **Placar Room** (`persistentRoom.ts`): extensão estritamente condicionada a `gameId === 'pista-unica'` para permitir até `nParticipantes + 1` por jogador em uma partida completa; outros jogos mantêm teto de 0–2. A transferência ao placar acumulado ainda ocorre apenas em `END_GAME` autorizado. Não houve mudança em transporte, convites, credenciais ou replay.
- **Robustez:** pistas vazias após normalização (`!!!`) rejeitadas pelo host LAN.

## TDD / validação independente

- Baseline direcionado original: **13/13**.
- TDD RED das novas regras local e LAN, privacidade, revisão autorizada, score, limites de payload e sem pistas; GREEN e regressões três jogos.
- Após último ajuste: `npm test` — **149 arquivos, 936/936 testes PASS**; `npm run typecheck` — PASS; `npm run lint` — PASS; `npm run build` — PASS; `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` — PASS; `git diff --check` — PASS.
- Testes de `pistaUnicaLanGame`: 3–12, filtro duplicatas/acento/caixa, pista igual ao alvo, progressão e rotação, atribuição por autor, zero pontos quando incorreto, limite 16 KiB de projeção, revisão privada sem autorização de adivinhador/outro escritor, resultado da sala e integração contínua `Impostor → Pista Única → Cidade Dorme`.

## Próximo ciclo (Codex)

Handoff: `docs/superpowers/plans/2026-10-17-pista-unica-codex-immersive-handoff.md`. Implementar a interface imersiva com identidade própria (direção “Oficina das Pistas”), tanto 1 celular quanto LAN, sem alterar os contratos/testes de regra. Sem repetir logo global, preservar as entradas de modo já aprovadas. Novo worktree/branch Codex deverá partir do commit desta entrega.

## Pendências

- Nenhum teste físico LAN realizado nesta tarefa: instalador APK, reconexão real, hotspot e privacidade em aparelhos separados continuam **PENDENTES**.
- O worktree original com alterações/untracked foi preservado.
- Nenhum merge em `main`, push, deploy ou build Android instalável foi realizado. Sem homologação visual da nova interface, que pertence à entrega Codex.
