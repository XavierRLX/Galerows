# Galerows — PL-02A review + PL-02B etapa isolada de wire v2 (11/10/2026)

**Estado:** PL-02A revisado e aprovado no núcleo TypeScript. PL-02B **PARCIAL**: codec de envelopes v2 isolado, sem integração LAN/nativo/UI. **Não** é aprovação de PL-02B ou release. Execução por Remote Desktop Commander sem consumir Codex.

## Revisão PL-02A

- Branch obrigatória `feat/multiplayer-lan-task1-wss`, HEAD histórico `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`, worktree e untracked anteriores preservados.
- Revisados `persistentRoom.ts`, `persistentProtocol.ts`, `persistentReplica.ts`, `multiplayerGames.ts`, `multiplayerGames.synthetic.ts`, `persistentRoom.test.ts`, `docs/lan-pl02a-core-evidence.md`.
- Arquitetura B confirmada: `RoomLifecycleAdapter` fixo, `AuthoritativeRoomRuntimeV2` persistente, `RoomCoordinatorV2` com fila, membership e revision únicos, jogo A→resultado→lobby→jogo B, snapshots privados distintos, coerência de `clientSeq`, guardas de host, preflight de tamanho e sem commit parcial. **O núcleo não foi conectado à LAN nesta revisão**.
- Regressão antes da edição do codec: **446/446 Vitest**, 70 arquivos, typecheck, ESLint e `npm run build` PASS. **Nenhum Gradle ou ensaio físico repetido**, pois a ponte nativa não mudou.

## Incremento PL-02B via Remote Desktop Commander

Arquivos **novos**, isolados de LAN v1:
- `src/features/multiplayer/lan/lanPersistentWire.ts`
- `src/features/multiplayer/lan/lanPersistentWire.test.ts`

Entregue um codec estrito para os envelopes de aplicação de v2 **após ingresso autenticado**:
- `commandV2`, `commandResultV2`, `eventV2`, `snapshotV2`, `resyncV2`.
- Envelope com `protocolVersion=2`, validação estrutural de comandos/resultados/snapshots/projeção/markers, checagem de `gameSessionId` e barras por sessão, rejeição explícita de versão v1, tamanho UTF-8 máximo 16 KiB (entrada/saída), recusa de dados não JSON. Não foram criadas credenciais nem incluídas informações secretas em logs.
- O parser v1 `lanWire.ts` não foi modificado e continua interpretando só seu contrato anterior. Os dois codecs não foram roteados para o mesmo socket; a seleção segura de protocolo e o Android nativo ainda ficam para PL-02B posterior.

## TDD e resultados

1. Testes vermelhos inicialmente porque `lanPersistentWire.ts` ainda não existia, depois verde com 9/9.
2. Adicionados teste real de snapshot `toy` durante partida/lobby, verificando que segredos distintos de host/guest não aparecem no pacote do outro; passou.
3. Teste adversarial de barreira atribuída a outra GameSession passou **vermelho primeiro** (decoder aceitava) e verde após incluir guarda `barrier.gameSessionId === currentGameSessionId` e rejeitar barreiras no lobby.
4. **11/11 testes focados verdes**, TypeScript e ESLint focado passaram.
5. Regressão completa após codec: **457/457 Vitest, 71 arquivos**, ESLint global PASS; build Vite padrão executado e conferido na revisão final.

## Pendente antes do PL-02B físico

- Seleção de versão para a **sala inteira** e handshake nativo `hello/resumeHello` v2: `LanHelloAuthenticator.java` exige atualmente `protocolVersion==1`; nunca aumentar a constante global v1 isoladamente.
- Convite v2 e admission seguro com `admitted → armazenamento → admissionAck → admissionConfirmed`, chaves de sessão, TTL e pinning; preservar PL-01 leave/revogação.
- Host/client transport v2 que utilize `RoomCoordinatorV2` para serializar comandos, join, presence, disconnect/reassociate/resync/leave e frames, com teste de separação v1↔v2, replays e reconnect.
- UI **somente de diagnóstico** sob feature flag que prove `toy A→results→lobby→counter B` em S23/S25 FE sem WAN (PL-03 lobby comercial continua separado).
- Regressão JVM, builds secureProbe/Release e teste físico **somente depois que houver aplicação LAN v2 realmente integrada**.

## Governança

- Nenhum commit, merge, push, reset, clean, alteração da `main`, modificação em Android Java ou LAN v1 nesta etapa.
- Codex permanece opcional: próximo bloco pode ser executado pelo Commander, com TDD e revisão separada; reservar Codex apenas se um problema de engenharia realmente exigir uma segunda ferramenta.
- Não marcar PL-02B completo, PL-03, descoberta ou Task 7 como iniciados/concluídos.

## Addendum: transporte nativo v2

O subgate posterior de handshake WSS + credenciais v2 **foi implementado e validado fisicamente**, mantendo LAN v1 operacional. Fonte: `docs/lan-pl02b-native-version-evidence.md`. O status neste relatório, que cobria somente o codec, é histórico; **PL-02B integral continua aberto** por falta de admission/coordinator/session v2 e troca de GameSessions.
