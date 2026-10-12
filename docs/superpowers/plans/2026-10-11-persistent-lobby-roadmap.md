# Galerows — Roadmap de implementação do Lobby Persistente (v0.1)

> **Checkpoint PL-03 (12/10/2026):** UI de lobby persistente v2 implementada sob `VITE_LAN_PERSISTENT_LOBBY_UI=1` + Android native. Consistência com a logo e `/inicio`, UX host/guest, QR/manual, convite rotativo, ready, seleção de dois jogos sintéticos, resultados, reconnect/leave, acessibilidade básica. **534/534 Vitest, 36/36 JUnit, TS/Lint/Release PASS; Release padrão sem rota de lobby.** Galaxy S23 exibiu a UI e criou Room nativa v2 (rev. 1), screenshots locais. Galaxy S25 FE desconectado do ADB: **PL-03 segue PARTIAL / HOLD no teste físico completo de dois aparelhos**. Leia `docs/lan-pl03-lobby-ui-evidence.md`. Não iniciar PL-04/PL-05/PL-06 por este checkpoint; manter `main` intacta, sem push/deploy.

> **Checkpoint atualizado em 12/10/2026 — prevalece sobre o registro histórico abaixo:** PL-02B implementado (ingresso/RoomCoordinator, comandos/resync, resume/leave, rekey, watchdog), aprovado em 521/521 Vitest, 36/36 Android JUnit, build Release sem probe, com ensaios físicos anteriores aprovados em S23 ↔ S25 FE. Auditoria final corrigiu 2 corridas RED/GREEN e desabilitou logs de tokens no bridge Capacitor. Evidências: `docs/lan-pl02b-closure-review-2026-10-12.md`, `docs/lan-pl02b-rekey-evidence.md`. No ensaio de logs mais recente, o S25 FE desconectou de ADB, logo **não** houve nova prova E2E completa. **Próximo estágio PL-03: UX do lobby persistente com jogos sintéticos**, feature flag; descoberta PL-04, stress/Doze/terceiro aparelho PL-05 e integração Impostor PL-06 ainda não concluídos. Branch de trabalho preservada, sem push/merge/main.

> **Status de checkpoint para o próximo chat (11/10/2026):** PL-00, PL-01 e PL-02A aprovados; PL-02B parcialmente aprovado (codec, WSS nativo v2, cofre v2, teste físico e regressão LAN v1). **Admissão v2 e troca de GameSessions pela LAN pendentes.** As restrições antigas de não criar commits são registros históricos. O estado foi preservado em dois commits locais (implementação e documentação), **sem push**. Handoff: `2026-10-11-pl02b-next-chat-handoff.md`.

**Planejamento aprovado como direção de produto em 11/10/2026.** Fonte de requisitos: `docs/multiplayer-persistent-lobby-spec.md`. **Não autoriza implementação integral nem início da Task 7.** Executar apenas o próximo gate que for explicitamente solicitado/aprovado. Manter Gates 1–6 LAN como evidência histórica, não os reescrever.

## Baseline de referência

- Repositório `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch existente `feat/multiplayer-lan-task1-wss`, HEAD histórico `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`; working tree intencionalmente dirty, arquivos untracked das Tasks LAN 1–6.
- A Task 6 passou no Android experimental: `docs/lan-task6-physical-gate-evidence.md`. Não é Release.
- Preservar Git integralmente; **sem reset, clean, cherry-pick, commit, push, merge, mudança de main ou alteração concorrente de arquivos pelo Commander/Codex**.
- Runtime atual vincula `GameAdapter` fixo no construtor. `LanRoomHost` atua como fronteira da sala LAN; `LanRoomSession`/`ClientReplica` dão ingresso/snapshot/reconnect. Não existe lobby multi-jogos nem descoberta automática.

## PL-00 — Design técnico e contrato do lifecycle (próximo gate)

**Entrega:** documento técnico em `docs/superpowers/plans/persistent-lobby-technical-design.md`, mais matriz de testes proposta; **somente leitura/análise/documentação, sem editar TypeScript/Java/React**.

1. Inspecionar código atual: `runtime.ts`, `gameAdapter.ts`, `protocol.ts`, `clientReplica.ts`, `lanRoomHost.ts`, `lanRoomSession.ts`, `lanWire.ts`, `LanRoomScreen.tsx`, `games.registry.ts`, contratos dos testes e regras locais de Impostor.
2. Comparar opções para dissociar Room de GameSession sem desmontar WSS/nativo: (A) coordenador de lifecycle com composição de runtimes e snapshot-envelope; (B) adapter delegante seguro dentro de autoridade persistente. Escolher uma por critérios explícitos de simplicidade, ordem de revisões, segurança, atomicidade, backward compatibility, reconexão e testabilidade; não assumir que trocar referência de adapter na hora seja seguro.
3. Especificar interfaces/commands autoritativos e policy de sala: `hostPlayerId`, `gameSessionId`, `phase`, `SELECT_GAME`, `CONFIGURE_GAME`, `READY`, `START_GAME`, `END_GAME`, `RETURN_TO_LOBBY`, `LEAVE_ROOM`; testes para unauthorized, retry, conflitos e comando atrasado de outra GameSession.
4. Projetar `roomRevision` monotônica com `Snapshot` público/privado por destinatário e resposta segura a gaps; definir como a replica apaga private state de jogos anteriores. Dimensionar frames no limite de 16 KiB sem elevar limite por conveniência.
5. Definir ciclo completo de membership/presença/desconexão/expiração; correção da saída definitiva com revogação do token nativo e resultado idempotente, incluindo resposta/ACK perdida. Planejar host remove, placeholders de jogadores desconectados e join enquanto jogo em andamento.
6. Identificar separação entre catálogo de jogos solo e capacidades multiplayer por `gameId`; primeiro Impostor da Palavra, depois Adedonha; checar min/max, game start conditions, UI em cada aparelho. Não ajustar regras do Impostor nesta tarefa.
7. Registrar riscos: host app background/crash, certificado efêmero 24h, salas longas, replay, connId antiga, failover explícito ausente, eventos anteriores após troca, ausência de terceiro aparelho físico para segredo entre convidados.
8. Fechar uma matriz de testes de contrato (unitário/integração/nativo/manual) e rollout incremental. Cada etapa precisa de acceptance criteria verificáveis e rollback sem apagar dados pré-existentes.

**Gate de aceite:** decisão técnica inequívoca e motivada, diagrama de fluxo e tabela de transições/falhas, caminhos de arquivos propostos, lista de testes vermelhos antes de implementação; nenhum código alterado, nenhuma suite completa repetida apenas para planejar. Pedir revisão antes de PL-01.

## PL-01 — LeaveRoom definitivo e membership

**Implementar somente após PL-00 aprovado.** Introduzir comando de saída própria, idempotente e autenticado; revogar token atual/pending; remover membership e projetar revisions. `disconnect` espontâneo preserva membership. Perda de ACK não restaura credencial revogada; UI precisa de feedback seguro. TDD LAN/runtime, físico S23↔S25 FE, verificar que slots não acumulam. Não modificar lobby/jogos reais aqui.

## PL-02 — Core RoomLifecycle + GameSession

**Implementar somente após gate anterior.** Room persistente com host role, estado de lobby, seleção/configuração e dois adapters mínimos sintéticos alternáveis (`counter`/`toy`, sem segredos reais). Contrato `gameSessionId`, transitions atômicas, roomRevision e resync/reconnect, idempotência, zero vazamento entre jogos. Provar `A → result → lobby → B → lobby` na mesma conexão/identidade. Testes Vitest e Android WSS; sem UI de jogos.

## PL-03 — UI de lobby persistente

**Implementar somente após PL-02.** Entrada via QR/manual existentes, lista/presença/ready, jogo selecionado, host escolhe configurações/inicia, guest acompanha, resultados retornam ao lobby, fechamento completo distinto do fim do jogo. Fluxo de jogo sintetizado para provar navegação sem integrar Impostor. UX acessível Android, estados de falha/reconnect e checks físicos. Feature flag até Release.

## PL-04 — Descoberta local (spike → decisão → implementação opcional)

Primeiro estudo documentado de NSD/mDNS Android e LAN/hotspot em dois Samsung; robustez sem WAN, multicast permitido, anúncios sem segredos, atualização/revogação, colisão de nomes, desempenho, permissões e fallback. **Não** assumir que broadcast de IP/fingerprint permite ingresso: novo protocolo seguro de solicitação/admissão precisa ser projetado e aprovado preservando pin TLS e código presencial. Caso discovery falhe na rede, sala continua acessível por QR/manual. iOS futuramente em gate separado. Somente implementar após spike PASS e autorização.

## PL-05 — Gate Release físico/segurança (evolução da Task 7)

Revalidar manifesto Release, WSS, certificate pinning, secret isolation, signed APKs, routes/debug flags, room/session commands forged, replay, recuperação de conexão, troca de jogo, leave, dois convidados simulados e no mínimo dois Androids reais. Registrar diferenças entre duas e três pessoas físicas. Não declarar pronto para produção antes dos gates de jogo e da decisão sobre iOS.

## PL-06 — Jogos reais, um por vez

1. **Impostor da Palavra**: primeiro auditar regra de papéis/fila/sorteio já existente; escrever `GameAdapter`, private projections, UX por papel, testes para não revelar palavra/impostor de outros jogadores; partida completa com resultado e retorno ao lobby.
2. **Adedonha**: implementar segundo `GameAdapter` real e provar troca de jogo **na mesma sala**, sem recriar TCP/WSS, pinning, identidades ou convites.

Replanejar o gate final de lançamento conforme evidências reais: prova de infraestrutura Release não equivale a prova de jogo completo.

## Governança, divisão Codex vs Commander

- **Remote Desktop Commander**: baseline Git, leitura/logs, documentos, testes já existentes, ADB/cópia/instalação APK e ensaios físicos, sem chamadas redundantes de Codex.
- **Codex**: PL-00 design técnico profundo e, após gate, TDD de contratos/lifecycle, mudanças multi-arquivo, controle de concorrência/segurança.
- Não executar PL-01/PL-02/PL-03/PL-04/PL-05/PL-06 em lote ou simultaneamente; cada etapa deve entregar evidência e parar para revisão.
- Nenhum backend, servidor de internet, mudança de `main`, iOS ou integração de jogo real antes do respectivo gate.

## Registro de revisão PL-00 — 11/10/2026

**PL-00 PASS como direção técnica**, sem implementação. Decisão B aprovada com ressalvas R1–R7 documentadas em `2026-10-11-pl00-review.md`. Handoff do primeiro gate de implementação: `2026-10-11-pl01-handoff.md`. **Somente PL-01** pode ser encaminhado ao Codex após revisão; deixar suítes completas, builds/Gradle, ADB e testes físicos ao Remote Desktop Commander para evitar duplicação de esforço. PL-02, descoberta, Task 7 e integração de jogos permanecem bloqueados até seus gates específicos. Preservar working tree/untracked, sem commits/merge/push.

## PL-01 — Gate concluído e revisado (11/10/2026)

**PL-01 PASS no Android LAN v1 experimental**, conforme `docs/lan-pl01-leave-evidence.md`. Vitest 420/420 (69 arquivos), JVM 26/26, TypeScript, ESLint, Vite e APKs Android passaram. Teste físico em S23/S25 FE, hotspot sem WAN, validou saída definitiva, vaga liberada, credencial apagada, novo playerId, desconexão retomável e encerramento da sala. Um teste JVM legado foi estabilizado em `LanSocketServerIntegrationTest.java` para mapear corretamente peerId sob conexões simultâneas; nenhum código de produção foi alterado pelo Commander. Build Release padrão foi restaurado sem rota experimental.

**PL-02 não iniciado**. Após aprovação de gate pelo usuário, reservar Codex às mudanças profundas de lifecycle/protocolo/testes focados, mantendo Commander para auditorias, suíte completa e ensaios físicos. Não criar commit, merge ou push.

## Autorização PL-02 e divisão do trabalho — 11/10/2026

O usuário autorizou iniciar PL-02 e confirmou a disponibilidade física de S23/S25 FE. Por segurança e economia de tokens, executar **PL-02A (core TypeScript, TDD focado) → revisão Commander → PL-02B (wire/nativo/probe) → regressão completa e ensaio físico Commander**, sem integrar jogos reais. Handoff operacional e critérios: `docs/superpowers/plans/2026-10-11-pl02-execution-handoff.md`. **Status nesta atualização: handoff criado, PL-02A ainda não implementado.** Os testes completos do PL-01 já passaram e não devem ser repetidos sem alterações funcionais. Preservar git dirty, main e flags Release.

## Revisão PL-02A e codec PL-02B isolado — 11/10/2026

**PL-02A aprovado** no core TypeScript (446/446 Vitest, typecheck, ESLint e Vite). O usuário sinalizou crédito Codex limitado e autorizou continuar com Remote Desktop Commander. Um **incremento parcial de PL-02B** foi implementado pelo Commander, sem Codex: codec LAN v2 isolado (`lanPersistentWire.ts` e testes), rejeição de envelopes v1 e frames inválidos, limite 16 KiB, verificação de estado privado/barreiras por GameSession. TDD 11/11; regressão global **457/457 Vitest** (71 arquivos), TypeScript, ESLint e Vite PASS. Evidência: `docs/lan-pl02a-review-and-pl02b-wire-evidence.md`. **PL-02B permanece aberto**, sem handshake Java, host/guest v2, probe APK, integração LAN ou ensaio físico novo. V1 preservado, branch/HEAD e untracked preservados, sem commit/merge/push. Próximo bloco opcional é integrar handshake/versão nativa somente com testes e gate separado, usando Commander quando viável.

## PL-02B — subgate nativo de handshake v2 validado fisicamente

Em 11/10/2026, executado inteiramente via Remote Desktop Commander sem Codex. `LanHelloAuthenticator` aceita protocolo por Room (v1 default, v2 opt-in), com recusa de mixed versions e cofre AES-GCM versionado para `connectResume` de v2 sem migrar credenciais antigas. Pontes TS `LanNativeHost`/`LanSecureNativeClient` têm métodos opt-in v2. TDD vermelho-verde JVM/Vitest; regressões globais **462/462 Vitest, 34/34 JVM, TSC/ESLint PASS**. Android SecureProbe/Release builds PASS. Prova física S23/S25 FE em hotspot sem WAN: TLS fingerprint, proibição downgrade v1 em Room v2, transporte de frames, resume v2 criptografado; regressão v1 de ingresso/comando/leave PASS. Artefatos, caveats e próximos gates: `docs/lan-pl02b-native-version-evidence.md`.

**PL-02B permanece parcial/aberto**: falta admission v2, RoomCoordinator no WSS, guest session e probe com troca de jogos. Nenhum PL-03, discovery, Task7, jogo real, commit/merge/push.
