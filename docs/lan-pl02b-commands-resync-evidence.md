# Galerows — PL-02B: comandos autorizados e resync de Room v2

**Data:** 11/10/2026. **Gate:** integração de comandos host/guest e sincronização v2 em transporte simulado. **PL-02B final: ABERTO**.

## Base e limites

- Branch obrigatória: `feat/multiplayer-lan-task1-wss`, HEAD preservado `c284ff8`, sem upstream.
- O subgate anterior (`docs/lan-pl02b-admission-v2-evidence.md`) permanece sem commit, preservado integralmente.
- Execução: Remote Desktop Commander, TDD vermelho/verde focado, sem Codex.
- Não alterados: wire LAN v1, descoberta automática, PL-03, Task 7, jogos comerciais ou UI Android.
- Não executados: merge, push, commit, reset ou clean.
- O WSS nativo v2, TLS pinning e handshake físico pertencem ao gate de transporte anterior; **não** se deve interpretá-los como prova física de duas GameSessions.

## Contratos implementados

1. **Host** (`lanPersistentRoomHost.ts`): após a confirmação da admissão, aceita somente `commandV2` e `resyncV2` originados do `peerId` com binding atual `peerId ↔ connectionId ↔ playerId`. Confere `roomId` e `playerId` anunciados antes de chamar o runtime. Peer sem binding, identidade forjada, comando antes do ACK e resync para outro jogador levam a fechamento terminal, sem consumir `clientSeq`. A execução usa o `RoomCoordinatorV2`, que serializa comandos com ingresso/presença. Envia `commandResultV2` ao emissor, e eventos privados de projeção somente à conexão do destinatário.
2. **Comandos locais de host**: `processLocalCommand(command, hostConnectionId)` usa a mesma fila de eventos do host, exige conexão local vinculada ao `hostPlayerId` e distribui as projeções de revisão aos convidados. Não é entrada via socket.
3. **Resync**: `RoomCoordinatorV2.snapshotFor(playerId, connectionId)` serializa a leitura da projeção privada do membro vinculado, sem confiar nos IDs do frame. `snapshotV2` pode ser emitido somente para o peer que passou pelo binding. Snapshot não avança revision.
4. **Guest** (`lanPersistentGuestAdmission.ts`): depois do ACK, mantém `ClientReplicaV2` e o próximo `clientSeq`, um comando pendente por vez, monta `commandId` de forma estável enquanto aguarda resultado, aplica eventos sequenciais e automaticamente solicita `resyncV2` quando detecta gap. A replica oculta `privateState` durante o gap e substitui o estado após snapshot autorizado. Resultado perdido bloqueia novo comando até resync, em vez de adivinhar sequência.
5. **Preflight de 16 KiB** (`persistentRoom.ts`): aplica o limite ao envelope real `snapshotV2` e `eventV2`, incluindo `kind` e `protocolVersion`. Projeção que ultrapassa o frame completo é recusada antes de qualquer alteração de estado/revision/cursor de sequência. Não aumenta o teto TLS/WebSocket existente.

## Prova simulada: duas GameSessions, mesma Room

Fixture TDD `lanPersistentCommandResync.test.ts` usa chamadas nativas simuladas, `LanPersistentRoomHost`, `LanPersistentGuestAdmission`, `RoomCoordinatorV2` e `AuthoritativeRoomRuntimeV2` reais. Ordem executada:

1. Convite v2 → código presencial → `admittedV2` → credencial persistida → ACK → confirmação.
2. `SELECT_GAME(toy)`, `CONFIGURE_GAME`, ambos `READY`, `START_GAME`: Room em `playing`, host/guest recebem segredos distintos.
3. `END_GAME` → `RETURN_TO_LOBBY`: estado público/privado de partida removido no cliente.
4. `SELECT_GAME(counter)` → `CONFIGURE_GAME` → ambos `READY` → `START_GAME`: nova `gameSessionId`, mesmo `roomId` e mesmos `playerId`.
5. Guest envia `INCREMENT` na GameSession B; estado público avança sem carregar o segredo de A.

A mesma suíte cobre binding forjado, replay de `commandId/clientSeq` (um efeito), falha de entrega de resultado com resync obrigatório, resync para outro `playerId`, conexão host local inválida, gap de revisões e snapshot privado isolado. `lanPersistentEnvelopePreflight.test.ts` cobre projeção que cabe isoladamente, mas ultrapassa 16 KiB no envelope.

**IMPORTANTE:** teste JavaScript com transporte mockado **não prova** o ciclo em WebSocket nativo real, hotspot ou dispositivos físicos. Nenhuma rota experimental foi habilitada.

## Regressão final confirmada

| Verificação | Resultado |
| --- | --- |
| `npm test` | **485/485 Vitest** em 78 arquivos (baseline anterior 476) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` padrão | PASS; sem habilitar `VITE_LAN_ROOM_UI` |
| `cap copy android` | PASS após build padrão |
| `:app:testSecureProbeUnitTest` | **34/34 JVM**; 8 suites, 0 erros/falhas/skips |
| `:app:assembleRelease --offline` | BUILD SUCCESSFUL |
| SHA-256 APK Release | `349a06fa013b409317609f577fa8070ceef82097be3f1f41f1ff2ee59ec4b0d4` (igual ao baseline) |
| Rota `__lan-room` nos chunks normais | 0 ocorrências |
| `git diff --check` | PASS |
| Git | Branch e HEAD `c284ff8` preservados, arquivos alterados ainda sem commit |

A suíte inclui **um teste integrado de duas GameSessions sintéticas** em transporte controlado; não foi realizado teste ADB de partida física neste gate, pois resume/leave v2 e a probe Android ainda faltam.

## Critério de parada e próximos subgates

- Gate de comandos v2 / resync / duas GameSessions **simuladas**: pronto para revisão após testes.
- **Ainda faltam:** resume v2 com reassociação, token rotativo e peer antigo revogado; `LEAVE_ROOM` v2 com revogação terminal e ACK; políticas para confirmação perdida/stop; resiliência de rede e sessão longa; probe diagnóstica sob flag; validação física S23 ↔ S25 FE com hotspot e duas GameSessions sem reconexão.
- Recomendação de sequência: (1) TDD resume e peer antigo, (2) TDD leave/ACK perdido/falha de revogação, (3) UI probe somente sintéticos, (4) Android SecureProbe e ensaio físico sem WAN, (5) build normal/Release e auditoria final. Não iniciar PL-03, discovery ou jogos reais.
- O documento de admissão v2 é registro **histórico** do gate anterior; este registro não modifica aquele resultado.
- Espera de autorização específica para novo commit, push ou merge.
