# Galerows — evidência PL-02A: núcleo de sala persistente

Data: 11/10/2026. Branch: `feat/multiplayer-lan-task1-wss`. Escopo: somente TypeScript autoritativo e testes focados. O runtime LAN v1 e o protocolo global `PROTOCOL_VERSION = 1` não foram alterados por esta etapa. Nenhuma ponte WSS/Java, UI, jogo real, build Android ou validação física integra esta evidência.

## Contrato entregue

- `persistentProtocol.ts` define envelopes isolados v2 (`scope`, `roomId`, `playerId`, `commandId`, `clientSeq` e `gameSessionId` obrigatório para comandos de jogo), resultados com próxima sequência e snapshots/eventos por destinatário. O limite de cada envelope projetado é 16 KiB em UTF-8.
- `RoomLifecycleAdapter` é fixo durante a vida de `AuthoritativeRoomRuntimeV2`. Ele delega somente comandos `scope=game` ao adapter da GameSession atual. O catálogo multiplayer é separado do catálogo solo e registra `toy` (segredo distinto por jogador, clock/RNG injetados) e `counter` (estado público).
- Uma Room mantém `roomId`, host explícito, membership único, fase e revisão monotônica. Cada `START_GAME` cria um `gameSessionId` novo e congela participantes; ingresso durante jogo/resultados fica `waiting` e sem projeção privada. `RETURN_TO_LOBBY` descarta estado da sessão e barreiras, mantém apenas resultado público mínimo e projeta estados de jogo público/privado como `null`.
- O binding `playerId`/`connectionId` é verificado antes de role e reducer. Ações de host são restritas. Sequência futura aguarda a esperada; comando válido rejeitado consome sequência. Retry exato da última sequência devolve o mesmo resultado sem reexecutar; reuso conflitante de ID em janela recente de 64 comandos ou comando antigo é rejeitado. Comando de GameSession anterior não entra no adapter atual.
- Toda transição candidata é pré-projetada para todos os membros antes de commit. Uma falha de projeção, valor não serializável ou frame acima de 16 KiB não altera estado, revisão, sequência ou deduplicação e não produz entregas parciais. A projeção recebe cópia do estado canônico. `ClientReplicaV2` detecta gap, apaga projeções de jogo e aceita apenas snapshot da Room correta com revisão atual ou mais nova; cópias impedem mutação por consumidor.
- `RoomCoordinatorV2` oferece uma fila única para ingressos, saída, desconexão, reassociação e comandos, além de `runExclusive` para a futura coordenação de efeitos externos. Credenciais e sockets pertencem ao PL-02B.

## TDD vermelho → verde

Os testes foram escritos primeiro em `persistentRoom.test.ts` e executados com `npx vitest run src/features/multiplayer/persistentRoom.test.ts` ou `-t <caso>` durante os ciclos. Falhas comportamentais observadas antes das correções:

| Caso vermelho | Falha observada | Correção verde |
| --- | --- | --- |
| Configuração sintética válida `null` | `START_GAME` retornava `invalid_phase`; depois a primeira configuração não avançava a revisão (`3` em vez de `4`) | Flag canônica `configured` e revisão da primeira configuração válida |
| Retry com payload JSON de chaves reordenadas | `command_conflict` indevido | Comparação estrutural de intenção |
| Gap de revisão na réplica | Estado público antigo continuava visível | Estado público e privado de jogo viram `null` até resync |
| Projector devolve valor não JSON | Transição era aceita | Validação JSON de todas as projeções antes de commit |
| `commandId` malformado | Resultado devolvia string vazia | Parser retorna erro com `commandId=null` |
| ID recente reutilizado com nova sequência | Comando era aceito | Histórico limitado de 64 IDs por membro |
| Clock falso no adapter `toy` | `startedAt` ausente | Estado inicial usa `context.clock.now()` |
| Projector público muta seu argumento | Valor canônico/privado virava `999` | Cópias independentes passadas aos projectors |
| Snapshot de configuração mutado pelo consumidor | Jogo iniciava com `rounds=5` em vez de `2` | Cópia da config na projeção |
| Resultado de retry mutado pelo consumidor | Retry devolvia o resultado falsificado | Cópia ao armazenar e ao devolver recibo |
| Estado da réplica mutado pelo consumidor | `playerId` interno passava a `forged` | Cópia na entrada e saída da réplica |

Asserções adicionais cobrem sequência completa `toy A → results → lobby → counter B`, participantes preservados, revisões consecutivas, host/guest, min/max de adapter e teto de 12 membros, segredo isolado entre três projeções, `waiting`, retry de `START_GAME`, comando atrasado de A, barreira descartada, presença/reassociação, snapshot autenticado, falha no segundo projector privado sem entrega parcial e tamanho UTF-8 da entrada e da saída.

## Verificação final desta etapa

| Comando | Resultado |
| --- | --- |
| `npx vitest run src/features/multiplayer/persistentRoom.test.ts` | 1 arquivo, 26/26 testes passaram |
| `npx vitest run src/features/multiplayer/runtime.test.ts` | Regressão focada do runtime v1: 1 arquivo, 31/31 testes passaram |
| `npm run typecheck` | `tsc -b --pretty false` passou |
| `npx eslint` nos seis arquivos TypeScript novos | Passou sem diagnósticos |

O primeiro typecheck após adicionar o teste de mutabilidade apontou apenas um cast indevido de array `readonly` no próprio teste; o cast foi removido e o typecheck final passou. Nenhuma suíte completa, Gradle, APK ou prova física foi executada neste gate.

## Limites para a revisão

O núcleo v2 ainda não trafega na LAN. PL-02B deverá ligar a fila e os contratos ao transporte autenticado, resolver a entrega/ACK de envelopes v2 e validar `hello`/resume/versionamento nativo, preservando PL-01 e o wire v1 até a negociação segura. Esta evidência comprova somente o comportamento TypeScript isolado; continuidade de socket/TLS e prova S23/S25 FE ficam para o gate físico posterior.
