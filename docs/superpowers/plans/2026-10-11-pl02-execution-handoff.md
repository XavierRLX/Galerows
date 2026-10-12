# Galerows — PL-02: handoff de execução incremental (11/10/2026)

**Autorização:** usuário autorizou prosseguir com PL-02 e informou disponibilidade do S23/S25 FE para testes físicos. **Estado atual:** preparação documental pelo Remote Desktop Commander; **nenhuma implementação de PL-02 foi iniciada aqui**.

**Fonte de verdade:** `docs/superpowers/plans/persistent-lobby-technical-design.md` (decisão B), `docs/multiplayer-persistent-lobby-spec.md`, `docs/superpowers/plans/2026-10-11-pl00-review.md`, `docs/lan-pl01-leave-evidence.md` e este handoff. O design PL-00 ainda contém descrições históricas de "PL-01 não implementado"; **prevalece a evidência de fechamento PL-01**. O protocolo atual LAN/Android é v1, com `LEAVE_ROOM` definitivo já executado e fisicamente aprovado; **preservar esse gate**.

## Baseline confirmado pelo Commander

- Repo: `/Users/renanxavier/Documents/GitHub/galerows`. Branch obrigatória: `feat/multiplayer-lan-task1-wss`. HEAD histórico `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`, `git diff --check` PASS.
- **Working tree está propositalmente dirty**, com documentação, JS/TS, nativo Java, builds e testes untracked das Tasks anteriores. Não `git clean`, `reset`, trocar branch, `commit`, `merge` ou `push`. Não modificar `main`.
- Regressão anterior: 420/420 Vitest (69 arquivos), 26/26 JVM, typecheck, ESLint, Vite e Android builds PASS; físico PL-01 PASS. Não repetir suítes completas por rotina.
- ADB disponível: S23 `RXCX705P3JR` (host, `swlan0 10.245.112.98/24`) e S25 FE `RXGL30N4F3F` (guest, `wlan0 10.245.112.245/24`), sem rota IPv4 default na última checagem. Essa condição deve ser **reverificada** antes do teste, não presumida permanente.
- Versões atuais: `src/features/multiplayer/protocol.ts` exporta `PROTOCOL_VERSION = 1`; `android/app/src/main/java/com/galerows/app/LanHelloAuthenticator.java` exige `hello.protocolVersion == 1`. `lanWire.ts`, `lanInvite.ts`, `lanRoomHost.ts`, `lanRoomSession.ts` e `ClientReplica` compartilham pressupostos v1. **Não alterar apenas a constante**.
- `AuthoritativeRoomRuntime` mantém um `GameAdapter` imutável no construtor, dedup por `commandId`, uma única revisão e membership. `roomEffects` de barreira vivem fora do estado do adapter. `runtime.disconnect()` não revisiona presença ainda. `LanRoomHost` gerencia peer/binding/credenciais e PL-01 leave; `roomClosed` é exclusivo de fechamento completo.
- Build padrão sem `/__lan-room` foi restaurado. Interface diagnóstica habilitada apenas com `VITE_LAN_ROOM_UI=1` e aplicativo Capacitor nativo. Não habilitar `allowMixedContent`, cleartext ou debug route no Release.

## Objetivo do PL-02

Demonstrar, **sem integrar nenhum jogo real**, que uma única Room autoritativa mantém `roomId`, `playerId`, membership, WSS/Keystore/pinning e revisão contínua enquanto executa:

`lobby → SELECT_GAME toy → CONFIGURE_GAME → READY → START_GAME (GameSession A) → END_GAME → results → RETURN_TO_LOBBY → SELECT_GAME counter → START_GAME (GameSession B) → END_GAME → lobby`.

Os adapters sintéticos devem ter regras diferentes. Um deles pode projetar segredo **distinto por participante**, para provar isolamento privado; o segundo pode usar apenas contador público. Usar mínimo de **2 jogadores** em ao menos um adapter para permitir prova física S23+S25 FE. Testar guardas de min/max e teto de 12 separadamente, inclusive um game sintético de mínimo 3 se necessário. Não inferir suporte de jogos multiplayer a partir de `games.registry.ts` solo.

## Divisão de execução — não pular subgates

### PL-02A — Core TypeScript e contratos (primeiro Codex)

**Autorizar já.** Implementar somente o núcleo tipado, sem Java/Capacitor/UI e **sem ativar wire v2 na rede nesta subetapa**:

1. Definir `RoomLifecycleAdapter` **fixo** e estado canônico com `phase`, host explícito, metadados por membership, jogo/config selecionados, `GameSession` atual e resultado público mínimo. Envolver o adapter de jogo **sem alterar a referência do adapter do runtime**.
2. Catálogo multiplayer tipado e separado dos jogos solo; dois adapters sintéticos de teste. Criar `gameSessionId` único em cada `START_GAME`, lista de participantes congelada, entrada posterior `waiting`, projeção privada nula quando não autorizada. Opcional `READY` por participante e autorização estrita de ações de host; subdelegação não confia no `playerId` alegado.
3. Introduzir contratos/parsers **v2 tipados e isolados** (por exemplo, namespace/arquivo separado de v1) para `scope=room|game`, `gameSessionId`, `clientSeq`, `commandId`; preservar o protocolo v1 compilando e com os testes existentes. Comandos atrasados de sessão A não executam em B; retry legítimo não cria outra sessão/sorteio; conflito retorna erro explícito.
4. Uma `roomRevision` única monotônica e snapshot completo para destinatário autorizado; private/public state substituído por `null` ao voltar ao lobby, inclusive depois de gap/resync. `ClientReplica` v2 deve rejeitar snapshot antigo/room errada e apagar projeção privada anterior.
5. Implementar transições sem efeitos parciais: pré-projetar/validar todos os destinatários, UTF-8 e envelope/frame projetado **menor ou igual a 16 KiB**, antes de commit de estado/revision/dedup. Barriers escopadas por `gameSessionId` e apagadas na troca. Não alterar suite antiga para esconder regressões.
6. Definir **com portabilidade para o PL-02B** a API do `RoomCoordinator` para serializar membership/join/leave/presence/resume e reduzir condições de corrida; efeitos externos (credenciais/WSS) **não implementados aqui**. Garantir fonte única de membership, não criar lista canônica paralela de playerIds.
7. Tratamento de sequência por jogador e cache limitado: retries com mesmo `commandId`/intent retornam mesmo resultado; conflito e replay antigo não reexecutam; resultado rejeitado consome sequência quando sintaticamente/autenticadamente válido; snapshot privado informa próxima sequência. Definir comportamento de comando de seq futuro sem deadlock/replay.
8. **TDD estrito**: antes do código, escrever testes vermelhos para host/guest permission, START inválido, duas GameSessions, segredo por player, spectator/waiting, retry, stale game command, duplicate commandId, gap+snapshot, barrier antiga, 12 jogadores, UTF-8/oversize, falha de projector sem commit/revision/dedup e presença revisionada. Usar fake clock/RNG para determinismo. Produzir evidência vermelho→verde e critérios dos contratos.

**Limites PL-02A:** NÃO editar Android Java/WSS, `LanRoomScreen`, QR, convite, camera, UI de jogo real, discovery NSD/mDNS, iOS ou release; NÃO bump global `PROTOCOL_VERSION` v1. Não reexecutar Gradle, APK e teste físico. Focar Vitest/TDD, typecheck e eventualmente ESLint para arquivos alterados. Documentar `docs/lan-pl02a-core-evidence.md` e **parar para revisão Commander**.

### PL-02B — Ponte LAN v2 + probe e teste físico (somente após PL-02A revisado)

**Não iniciar junto com PL-02A sem revisão.**

1. Evoluir coordenação `LanRoomHost`/`LanRoomSession` e wire nativo Java com **versão negociada/conhecida da Room**; ingress `hello` e `resumeHello` Android compatíveis com v2, pinning e validação explícita de mismatch sem downgrade silencioso. Decidir e testar formato do convite v2 em separado (não reutilizar capacidade/QR v1 cegamente).
2. Preservar e revalidar `admitted → armazenamento durável → admissionAck → admissionConfirmed` e PL-01 `LEAVE_ROOM` no protocolo selecionado, sem tornar membro o socket apenas conectado. Preservar rekey/Keystore e proteção contra segredo no log.
3. Integrar envelopes v2, snapshots/eventos/resync e `clientSeq` no transporte; corrigir races de stop/resume/leave e estado de presence autoritativa sem dupla revision ou vaga órfã. Nunca promover convidado a host por frame forjado.
4. Adicionar **somente probe diagnóstica de teste**, sob flag excluída do Release: expor ao Commander host/guest lifecycle sintético A→B, presença, resultados e revisão para verificar os dois aparelhos via ADB/CDP; isso **não** é UI do lobby PL-03 nem novo jogo comercial.
5. TDD Vitest e JUnit focados para protocolo/versão nativa, controles de acesso, ACK perdidos, revogação, janela reconnect e mixed versions; NÃO executar builds completos repetitivos no Codex.
6. Documentar `docs/lan-pl02b-bridge-evidence.md`, parar. Commander então faz suíte única completa, Gradle, build secureProbe experimental/Release sem rota, instala em S23/S25 FE e testa WSS **pelo hotspot sem WAN**, sem `adb forward` de porta do jogo.

### Critério de gate PL-02 completo

- Mesmo `roomId` e `playerIds` e mesma sessão TLS durante transição A→lobby→B; diferentes `gameSessionId`; ordem contínua de `revision`.
- Host escolhe/configura/inicia/encerra e guest só faz ações permitidas; comandos maliciosos/repetidos/tardios rejeitados.
- Segredos privados isolados por jogador e zerados em lobby/troca/reconnect; gaps restaurados por snapshot correto.
- Admissão, leave definitivo, transient disconnect/resume e room stop continuam íntegros; não ampliar limites nativos, não abrir cleartext.
- Prova física com 2 Androids e testes simulados para 3 convidados, **sem apresentar prova simulada como físico**.
- Mesmo build Release não contém probe/lobby incompleto. Gate de segurança/Release PL-05/Task7 permanece posterior.

## Divisão permanente de ferramentas (economizar tokens Codex)

**Remote Desktop Commander (este chat):** baseline/auditoria, documentação, handoff, log/ADB, testes completos finais, builds Vite/Gradle/APK, instalação/ensaio físico e evidências; não reexecutar testes/compilação antes de haver código novo.

**Codex (outro chat):** desenho de tipos de código, TDD vermelho-verde, refatoração complexa do core e wire/nativo; testes *focados* durante implementação. Entregar resumo de arquivos e questões pendentes, **parar entre PL-02A e PL-02B**.

Não modificar o mesmo arquivo simultaneamente pelos dois chats. Nenhum commit, merge, push, reset, clean ou mudança de branch; preservar worktree dirty e untracked.

## Comando sugerido ao Codex

```text
Continue o Galerows na branch feat/multiplayer-lan-task1-wss, repo
/Users/renanxavier/Documents/GitHub/galerows.

Leia docs/superpowers/plans/2026-10-11-pl02-execution-handoff.md,
docs/superpowers/plans/persistent-lobby-technical-design.md,
docs/lan-pl01-leave-evidence.md e a especificação de sala persistente.

Execute SOMENTE PL-02A — core TypeScript autoritativo multi-jogos, TDD estrito.
Leia e preserve a implementação LAN v1 e PL-01; não inicie v2 na rede.
Prove A→resultado→lobby→B mantendo um runtime/revision/membership,
isolamento privado, guardas host/guest, replay, stale session, preflight
atômico e ClientReplica v2, com dois adapters sintéticos.

Não iniciar PL-02B, não editar Java/Capacitor/UI, nem implementar jogo
real, descoberta de salas, PL-03 ou Task 7. Não executar suíte completa,
Gradle, builds APK nem testes físicos: o Remote Desktop Commander fará
isso ao fim do gate. Execute somente testes focados e typecheck se
necessário, registre vermelho→verde em docs/lan-pl02a-core-evidence.md
e PARE para revisão.

Git: preserve todas as mudanças/untracked; nenhum commit, merge,
push, reset, clean ou alteração em main.
```
