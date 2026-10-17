# Cidade Dorme — UX LAN Immersiva Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o Cidade Dorme à experiência LAN imersiva do Galerows sem repetir o lobby ao iniciar, mantendo ações noturnas privadas, votação individual e a mesma Room entre partidas.

**Architecture:** Reutilizar exclusivamente os contratos autoritativos de `cidadeDormeLanGame` e os snapshots filtrados por participante de `persistentRoom`. Substituir apenas a camada de apresentação de `CidadeDormeLanRound` por uma tela imersiva independente; preservar lógica do jogo de 1 celular. Todo comando continua enviado por `onGameCommand`, sem backend externo.

**Tech Stack:** React 19, TypeScript, Capacitor 8 Android, Vitest, Testing Library, native LAN WebSocket.

**Spec:** `docs/superpowers/reviews/2026-10-14-impostor-final-closeout-city-handoff.md` (seção Cidade Dorme), `docs/superpowers/reviews/2026-10-14-cidade-dorme-traitor-jester-design.md` (novos papéis e questões em aberto) e `src/features/cidade-dorme/cidadeDorme.types.ts` / `src/features/multiplayer/cidadeDormeLanGame.ts` (regras existentes).

## Global Constraints

- Preservar branch `feat/ux-hub-header-brand` até decisão separada sobre branch de Cidade Dorme; não alterar `main`.
- O Impostor foi fechado no commit `2b5d20d`; **não** reabrir suas regras ou arquivos nesta fase.
- Nenhum matchmaking público, backend online, senha para entrar na mesma LAN ou instalação de novas dependências.
- Início a partir da mesma Room: host configura Cidade Dorme → todos READY → START_GAME → papel secreto individual, sem outro lobby.
- Os papéis, ações e investigação do detetive jamais aparecem nos snapshots públicos antes do resultado autorizado.
- Não inventar novas regras de coringa, médico, detetive ou contagem de assassinos; reutilizar `cidadeDorme.rules.ts` e `cidadeDormeLanGame.ts`.
- Ao iniciar ou sair da fase, esconder o papel; ao perder conexão/foco, ocultar imediatamente. O usuário pode consultar seu papel novamente enquanto a fase permitir.
- Uma nova GameSession na mesma Room preserva nomes e placar, com segredos reembaralhados e nenhuma ação atrasada aceita.
- Não concluir homologação física sem executar teste real. Uso de emulador deve ser rotulado como tal.

---

### Task 1 — Contratos e riscos do Cidade Dorme

**Files:**
- Read: `src/features/multiplayer/cidadeDormeLanGame.ts`
- Read: `src/features/cidade-dorme/cidadeDorme.rules.ts`
- Read: `src/features/multiplayer/lan/lobby/CidadeDormeLanRound.tsx`
- Test: `src/features/multiplayer/cidadeDormeLanGame.test.ts`

**Interfaces:**
- Consumes: `CidadeDormeLanStep`, `CidadeDormeLanPublic`, `CidadeDormeLanPrivate`.
- Produces: documented authorized actions for each step in the City UX acceptance checklist.

- [ ] **Step 1:** Catalogar as fases presentes: `reveal → killer-turn → doctor-turn → detective-turn → morning → discussion → voting → vote-result/summary`. Registrar fases opcionais, transições antecipadas por vitória e quem pode comandar cada ação.
- [ ] **Step 2:** Executar os contratos existentes:
  ```bash
  npx vitest run src/features/multiplayer/cidadeDormeLanGame.test.ts src/features/multiplayer/lan/lobby/CidadeDormeLanRound.test.tsx
  ```
- [ ] **Step 3:** Decidir antes da UX se um único assassino representante faz `KILL` mesmo com vários assassinos (comportamento atual), sem modificar o core por suposição; registrar a decisão de produto se houver mudança.

### Task 2 — UI de identidade privada e início direto

**Files:**
- Create: `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.tsx`
- Create: `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.test.tsx`
- Modify: `src/features/multiplayer/lan/lobby/LobbyRoomView.tsx`

**Interfaces:**
- Consumes: `RoomSnapshotV2`, `onGameCommand(type,payload)`, `onEnd`, `onBackToLobby`, `onReplay`.
- Produces: isolated City immersive UI, mounted by GameSession ID/round/step/connectivity.

- [ ] **Step 1 (RED):** Testar que `START_GAME` abre a carta secreta sem apresentar `Sala da galera` ou novo lobby; impedir que papel e nome de assassinos sejam exibidos em modo de espera.
- [ ] **Step 2:** Rodar o teste para provar falha:
  ```bash
  npx vitest run src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.test.tsx
  ```
- [ ] **Step 3 (GREEN):** Criar o componente imersivo e substituir renderização in-lobby somente quando `selectedGameId==='cidade-dorme'` e fase `playing/results`. Implementar `ACK_ROLE` ao confirmar papel; ocultar papel ao sair, ir para outra fase, perder foco ou conexão. Reutilizar `roleLabels`.
- [ ] **Step 4:** Reexecutar teste e TypeScript. Commit isolado do novo fluxo de identidade.

### Task 3 — Noite privada e amanhecer sem vazamentos

**Files:**
- Modify: `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.tsx`
- Test: `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.test.tsx`

**Interfaces:** `KILL`, `PROTECT`, `INVESTIGATE`, `START_NIGHT`, `START_DISCUSSION`.

- [ ] **Step 1 (RED):** Testar que apenas o papel autorizado recebe ações, que não existem botões para participantes mortos ou cidadãos, e que uma investigação só é exibida no snapshot privado do detetive.
- [ ] **Step 2 (GREEN):** Renderizar instruções distintas para jogador com ação e jogador aguardando; remover a repetição de telas do lobby nas transições; exibir o resultado da noite e botão do host para a discussão.
- [ ] **Step 3:** Validar com Vitest que estados atrasados, transições antecipadas e reconexão não mostram segredo anterior; usar fluxo determinístico do core.

### Task 4 — Votação, resultados e próxima noite

**Files:**
- Modify: `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.tsx`
- Test: `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.test.tsx`

**Interfaces:** `START_VOTE`, `CAST_VOTE`, `RESOLVE_VOTE`, `NEXT_NIGHT`.

- [ ] **Step 1 (RED):** Cobrir voto individual confirmado uma única vez, contagem sem revelar votos antes da apuração, participantes eliminados sem voto, empate sem eliminado e salto ao resultado em caso de vitória.
- [ ] **Step 2 (GREEN):** Mostrar discussão presencial, votação individual e apuração comandada pelo host; contemplar cidade, assassinos e coringa no resultado.
- [ ] **Step 3:** Rodar testes e verificar que os limites de frame e projeções privadas do core permanecem intactos.

### Task 5 — Retorno à Room, placar e replay

**Files:**
- Modify: `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.tsx`
- Test: `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.test.tsx`
- Test: `src/features/multiplayer/impostorLanStability.test.ts` (somente referência; não modificar sem necessidade).

**Interfaces:** `END_GAME`, `REPLAY_GAME`, `RETURN_TO_LOBBY`.

- [ ] **Step 1 (RED):** Após resultado, host pode registrar placar uma vez, jogar novamente na mesma Room com nova GameSession ou voltar ao lobby sem recriar a sala.
- [ ] **Step 2 (GREEN):** Acrescentar dois botões distintos com estados de rede e `busy`; manter nomes personalizados; ocultar dados do jogo anterior.
- [ ] **Step 3:** Rodar regressão `npm test`, `npm run typecheck`, `npm run lint`, build LAN com flags e `git diff --check`; registrar gates.
- [ ] **Step 4:** Commit apenas City UX + testes; não publicar nem declarar homologação física.

## Critérios mínimos de saída

- Sala persistente de 4–12 jogadores, host inicia uma única partida sem segundo lobby.
- Nenhum vazamento de papel/alvo ou investigação entre aparelhos.
- Todas as transições `reveal → noite → manhã → discussão → votação → resultado` podem ser concluídas sem decisões manuais ocultas na UI.
- Votos individuais, eliminados e empate preservam as regras atuais.
- Replay na mesma Room e retorno ao lobby convivem.
- Gates automatizados PASS; teste físico marcado como PENDING até ser realizado.
