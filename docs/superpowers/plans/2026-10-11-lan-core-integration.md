# Galerows LAN Core Integration Implementation Plan — proposta para aprovação

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` task by task after explicit approval. This plan does not authorize implementation now. The user's no-commit instruction controls execution.

**Goal:** ligar uma sala LAN autenticada ao `AuthoritativeRoomRuntime`, `RoomTransport` e `ClientReplica`, em Android, sem integrar jogo real.

**Architecture:** o host mantém a autoridade na WebView e os sockets no plugin nativo; um coordenador mapeia peer nativo para `connectionId` autenticada. O convidado obtém ingresso/snapshot por uma sessão LAN, depois usa um `RoomTransport` para comandos, eventos e resync. A identidade do host e a confidencialidade do canal devem ser provadas em build semelhante ao Release antes de usar o fluxo em produção.

**Tech Stack:** TypeScript/Vitest, React apenas para o ingresso de sala, Capacitor 8, Android Java/JUnit/instrumentação, WebSocket nativo seguro a validar, JDK 21.

**Spec:** [fechamento e gate de Release](../../lan-4a-closeout-release-gate.md); [requisitos offline-first](../../multiplayer-offline-first-requirements.md); [arquitetura histórica com nota de escopo](../../multiplayer-architecture.md).

## Restrições globais

- Trabalhar em `feat/multiplayer-lan-4a` ou em branch sucessora aprovada; preservar working tree e arquivos untracked. Não alterar `main` nem criar commits automaticamente.
- Não adicionar Supabase, backend, Play Store como dependência de instalação, nem implementar jogo nesta sequência.
- `AuthoritativeRoomRuntime` é a única autoridade; não duplicar engine. Primeiro jogo posterior: **Impostor da Palavra**; segundo: **Adedonha**.
- Debug `allowMixedContent` e IP `10.245.112.98` são evidência de POC, não configuração de Release.
- Cada tarefa segue red → green → refactor e termina em um resultado revisável. Só avançar após aprovação do gate anterior.

## Mapa de arquivos proposto

| Unidade | Responsabilidade |
| --- | --- |
| `src/features/multiplayer/lan/lanWire.ts` | Envelopes versionados, limites e parsing do tráfego LAN. |
| `src/features/multiplayer/lan/lanInvite.ts` (novo) | Codificação/validação de convite QR e entrada manual, sem UI. |
| `src/features/multiplayer/lan/lanRoomHost.ts` (novo) | Admissão, vínculo `peerId`/`connectionId`/`playerId` e roteamento do runtime. |
| `src/features/multiplayer/lan/lanRoomSession.ts` (novo) | Bootstrap do convidado: canal verificado → ingresso/retomada → snapshot/transporte. |
| `src/features/multiplayer/lan/lanRoomTransport.ts` (novo) | Implementação concreta de `RoomTransport` após ingresso. |
| `android/app/src/main/java/com/galerows/app/` | Servidor e cliente nativos seguros por trás do Capacitor; TLS/pin sem confiar em certificado arbitrário. |
| `src/features/multiplayer/lan/*test.ts`, `android/app/src/test/`, `android/app/src/androidTest/` | Contratos, regressões de protocolo, segurança e instrumentação. |
| `src/features/multiplayer/lan/LanDiagnosticScreen.tsx` | Sonda Debug existente; manter fora do Release. |

## Task 1 — Gate de canal seguro em Release semelhante ao distribuível

**Entregável:** dois Androids abrem canal LAN com autenticação do host e criptografia, sem `allowMixedContent`, `usesCleartextTraffic` global ou exceção de IP da POC; falha de pin/certificado fecha antes de enviar convite. Este é um **spike bloqueante**: se WSS nativo com certificado efêmero e pin não for viável, parar e apresentar alternativa para aprovação, sem trocar silenciosamente para `ws://`.

**Arquivos:** criar testes em `android/app/src/androidTest/java/com/galerows/app/` e implementação nativa mínima em `android/app/src/main/java/com/galerows/app/`; inspecionar `capacitor.config.ts`, manifesto principal e manifesto Release mesclado.

- [ ] Escrever teste instrumentado de sucesso com certificado/pin esperado e teste de falha com pin diferente; verificar que nenhum token foi enviado na falha.
- [ ] Rodar o teste contra o estado atual e registrar falha por ausência do canal seguro.
- [ ] Implementar somente o canal nativo necessário à prova, com certificado efêmero e verificação explícita do fingerprint apresentado pelo convite.
- [ ] Rodar teste instrumentado e um APK assinado de teste nos dois aparelhos por Wi-Fi e hotspot sem WAN; inspecionar configuração embutida, Logcat e tráfego efetivo.
- [ ] Revisar threat model: QR observado por terceiro, hotspot malicioso, replay, certificado renovado, falha de relógio e mudança de IP. Aprovar ou replanejar antes da Task 2.

**Comandos de verificação:** `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew :app:testDebugUnitTest :app:connectedDebugAndroidTest :app:assembleRelease` em `android/`, mais instalação explícita por serial de um artefato Release semelhante. Ajustar o teste assinado às credenciais locais existentes, sem gravá-las no repositório.

## Task 2 — Convite e protocolo de ingresso explícito

**Entregável:** QR/entrada manual versionados e resposta `admitted`/`rejected` separada de `WebSocket.open`; resposta aceita contém `playerId` e `Snapshot` autorizado. O convite tem `roomId`, endpoint dinâmico, validade, capacidade de ingresso de uso único e fingerprint do host, mas não contém credencial de retomada nem segredo de jogo. O host renova o convite após cada admissão.

**Arquivos:** criar `lanInvite.ts`/`lanInvite.test.ts`; estender `lanWire.ts`/`lanWire.test.ts` e os codecs nativos apenas no limite necessário. Reutilizar `qrcode`/`jsqr` já instalados quando a UI chegar.

- [ ] Escrever testes que rejeitam convite expirado, adulterado, fora de tamanho, versão incompatível, IP/porta inválidos e reutilização indevida.
- [ ] Escrever testes de `hello → admitted` e `hello → rejected`: `open` isolado não produz membership nem inicializa `ClientReplica`.
- [ ] Confirmar falhas, implementar serialização mínima e repetir `npm test -- --run src/features/multiplayer/lan/lanInvite.test.ts src/features/multiplayer/lan/lanWire.test.ts`.
- [ ] Medir `Snapshot` realista: se 16 KiB não bastar, decidir limite/fragmentação com teste de tamanho antes de mudar o contrato.

## Task 3 — Coordenador do host e identidade de sala

**Entregável:** `LanRoomHost` admite uma conexão verificada, chama `runtime.join(connectionId)` uma vez, envia snapshot privado correto e roteia comandos/resync. O token de ingresso não é usado como `playerId`; cada socket recebe `connectionId` efêmera. O host participa como membro local sem abrir socket LAN para si.

**Arquivos:** criar `lanRoomHost.ts`/`lanRoomHost.test.ts`; adaptar `lanNativeHost.ts` somente para expor eventos/canal de forma segura; usar `runtime.ts`, `protocol.ts` e `gameAdapter.ts` sem alteração de semântica.

- [ ] Escrever testes com adapter mínimo sem jogo real: dois convidados recebem projeções privadas distintas, e nenhum quadro destinado a A contém privado de B.
- [ ] Escrever testes para comando com `playerId` forjado, peer antigo, sala errada, duplicata de `commandId` e `ResyncRequest` não autorizado.
- [ ] Confirmar testes vermelhos; implementar mapeamento `peerId → connectionId → playerId`, admitindo só após validação e roteando `RuntimeDelivery` ao peer correto.
- [ ] Rodar `npm test -- --run src/features/multiplayer/lan/lanRoomHost.test.ts src/features/multiplayer/runtime.test.ts` e verificar revision, idempotência e ausência de logs de segredo.

## Task 4 — Sessão convidada e contrato RoomTransport

**Entregável:** `LanRoomSession.connectInvite()` devolve `{ playerId, snapshot, transport }` somente após admissão. O `transport` implementa exatamente `connect`, `disconnect`, `sendCommand`, `sendResyncRequest` e `subscribe` de `roomTransport.ts`; o cliente inicializa `ClientReplica` com o snapshot e aplica `CommandResult`, `Event` e `Snapshot` por seus métodos existentes.

**Arquivos:** criar `lanRoomSession.ts`/`.test.ts`, `lanRoomTransport.ts`/`.test.ts`; estender `lanWire.ts` para mensagens autoritativas. Não embutir regra de Impostor ou Adedonha.

- [ ] Portar para o transporte LAN os cenários de contrato do harness `testing/inMemoryRoomTransport.test.ts`: resultado antes de evento, duplicata, reorder, gap, resync, retry e marker.
- [ ] Confirmar falhas, implementar o adaptador mais fino possível e validar `ClientReplica` sem alterar sua semântica.
- [ ] Rodar `npm test -- --run src/features/multiplayer/lan src/features/multiplayer/testing/inMemoryRoomTransport.test.ts src/features/multiplayer/clientReplica.test.ts`.
- [ ] Fazer teste físico Android ↔ Android com adapter mínimo: ingresso, um comando aceito, um rejeitado, projeções diferentes e snapshot de resync.

## Task 5 — Retomada de jogador e falha do anfitrião

**Entregável:** credencial individual de retomada emitida depois do ingresso, armazenada no convidado, jamais no QR; novo socket prova posse antes de `runtime.reassociate(playerId, newConnectionId)`. O socket antigo perde autorização. Encerrar host fecha a sala com erro distinguível de perda transitória.

**Arquivos:** estender `lanRoomHost.ts`, `lanRoomSession.ts`, seus testes e armazenamento local apropriado; `runtime.ts` permanece responsável apenas pelo membership lógico.

- [ ] Escrever testes de credencial correta, ausente, expirada e de outro jogador; verificar que falhas não criam novo membership nem permitem comandos.
- [ ] Escrever teste de desconexão → nova `connectionId` → `Snapshot` → `ClientReplica.applySnapshot`; repetir `commandId` original e exigir deduplicação.
- [ ] Confirmar falhas, implementar prova/rotação e desautorizar conexão anterior; testar encerramento do host sem migração automática.
- [ ] Rodar suítes LAN/core e repetir em dois Androids, inclusive background/foreground e hotspot sem WAN.

## Task 6 — Entrada de sala mínima e QR no aplicativo

**Entregável:** criar sala, mostrar QR/código/endereço atualizado, ler QR no segundo app, visualizar status de ingresso e erro, sair/retomar. Sem tela de jogo. Preservar QR atual da Adedonha como formato distinto, sem interpretá-lo como convite multiplayer.

**Arquivos:** telas/rotas sob `src/features/multiplayer/lan/` e `src/app/routes.tsx`; testes de componente e contrato de `lanInvite.ts`. Reutilizar câmera/QR existentes sem compartilhar payloads incompatíveis.

- [ ] Escrever testes de UI para QR válido, câmera negada, convite expirado, mudança de IP/porta e entrada manual.
- [ ] Confirmar falhas, conectar UI apenas a `LanRoomSession` e `LanRoomHost`, sem estado autoritativo no store de tela.
- [ ] Rodar `npm test`, `npm run typecheck`, `npm run lint` e teste manual em dois Androids.

## Task 7 — Gate físico e pacote Release

**Entregável:** relatório de evidências de build assinado e dois dispositivos, com manifesto Release, hash dos APKs, Wi-Fi e hotspot sem WAN, QR real, comando/resync, reconexão e falha do host. Verificar ausência da página de diagnóstico e de permissões globais de mixed content/cleartext.

- [ ] Criar matriz de casos antes da execução, com resultado esperado e comando de coleta para cada caso.
- [ ] Compilar build Release semelhante ao distribuível; instalar por serial; conferir SHA-256 dos `base.apk` instalados, assets embutidos e manifesto mesclado.
- [ ] Executar testes de convite inválido/adulterado, pin inválido, pares simultâneos, `playerId` forjado, projeções privadas, desconexão/reconexão, IP alterado e host encerrado.
- [ ] Executar em Wi-Fi com e sem WAN e em hotspot sem roteador; confirmar rotas locais e ausência de `adb reverse`/forward para o transporte.
- [ ] Documentar falhas e corrigir por TDD antes de pedir aprovação para o primeiro jogo.

## Gate posterior de jogo — fora deste plano de execução

Depois de aprovada a integração genérica e a segurança de Release, resolver a divergência da fila de impostores registrada em `docs/multiplayer-architecture.md`. Só então planejar `GameAdapter` de **Impostor da Palavra** e testes de projeção privada por jogador. **Adedonha** vem depois para demonstrar reutilização. Nenhum dos dois é implementado por este documento.

## Revisão requerida antes de executar

O gestor precisa aprovar: (1) investigação WSS nativo como primeira opção de Release; (2) capacidade curta de ingresso no QR e credencial privada de retomada por jogador; (3) fechamento da sala sem migração de host na V1; (4) Android como primeiro gate físico, iOS em gate próprio. Qualquer falha do spike de segurança retorna para nova decisão arquitetural antes de integrar o core.


## Adendo de sequência — 11/10/2026

As Tasks LAN 1–6 deste plano foram implementadas no Android experimental, e o gate físico da Task 6 foi concluído em `docs/lan-task6-physical-gate-evidence.md`. Após esse resultado, o produto aprovou um **lobby persistente multi-jogos**. A Task 7 original **não deve ser executada isoladamente como lançamento/Release final** antes da revisão do lifecycle e saída definitiva. O plano atualizado de evolução está em `docs/superpowers/plans/2026-10-11-persistent-lobby-roadmap.md`; requisitos em `docs/multiplayer-persistent-lobby-spec.md`. Seguir gates PL-00 em diante, com revisão explícita antes de implementar cada etapa. Este adendo mantém intactos os critérios históricos das Tasks 1–7 e não inicia nenhuma delas.
