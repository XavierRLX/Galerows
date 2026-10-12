# Galerows — Handoff para novo chat: PL-02B restante

**Atualizado em 11/10/2026 — depois da validação física do handshake WSS v2.**
**Estado real:** Tasks LAN 1–6 e PL-01 aprovados na UI experimental Android; PL-00 design aprovado; PL-02A aprovado em testes do núcleo; **PL-02B parcial**. PL-03/PL-04/Task 7/integração dos jogos reais **NÃO iniciados**.

## Repositório e Git

- Mac do usuário via **@Remote Desktop Commander**.
- Repo local: `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch: `feat/multiplayer-lan-task1-wss`. **Não** trabalhar na `main`.
- Baseline histórico das tarefas: `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`.
- Commit de código, testes e configuração: `fe3044f08a190103aa92243bfe7cad9bfd55e628` — `feat(multiplayer): add secure Android LAN and persistent room core`.
- Documentação, incluindo este handoff, está no commit de documentação seguinte. Na nova conversa, confira o SHA real usando `git log -2 --oneline`.
- **Dois commits locais; não houve push nem merge; branch sem upstream.** Verificar `git status --short` ao começar, sem presumir estado limpo eterno. Não usar `reset`, `clean`, checkout/descarte ou comandos destrutivos sem autorização. Não criar novos commits/push automaticamente se o usuário não solicitar.

## Direção de produto

O Galerows é aplicativo mobile-only de jogos de grupo, offline-first; multiplayer **real LAN** por Wi-Fi/hotspot sem internet, não browser/WAN. A sala `Room` persiste enquanto os jogadores executam GameSessions sequenciais. Host escolhe jogo/configuração/início/fim; convidados seguem estado autoritativo. Ao terminar: resultados → mesmo lobby → jogar novamente ou escolher outro jogo sem reconexão, mantendo `roomId`, `playerId`, membership, TLS e revision. Primeiro jogo real futuro: **Impostor da Palavra**; segundo: **Adedonha**. Descoberta de salas próximas via NSD/mDNS é evolução separada com fallback QR/manual. **Não integrar jogos reais nesta etapa.**

## Fontes de verdade (ler primeiro)

1. `docs/multiplayer-persistent-lobby-spec.md` — UX/objetivos e regras de sala permanente.
2. `docs/superpowers/plans/persistent-lobby-technical-design.md` — decisão B: um runtime autoritativo por Room com `RoomLifecycleAdapter` fixo delegando à `GameSession` ativa.
3. `docs/superpowers/plans/2026-10-11-persistent-lobby-roadmap.md` — histórico e ordem PL-00..PL-06; **adendos finais prevalecem sobre statuses históricos**.
4. `docs/superpowers/plans/2026-10-11-pl02-execution-handoff.md` — limites e critérios do PL-02A/PL-02B.
5. `docs/lan-pl01-leave-evidence.md`, `docs/lan-pl02a-core-evidence.md`, `docs/lan-pl02a-review-and-pl02b-wire-evidence.md`, `docs/lan-pl02b-native-version-evidence.md` — evidências concretas.
6. `docs/lan-task6-physical-gate-evidence.md` — prova anterior do ingress/QR/WSS/reconexão/close v1.

## Já implementado e testado

**LAN v1:** WSS Android nativo com certificado TLS efêmero pinado, QR/convite com capacidade temporária, verificação presencial de código separado, admission `admitted → guest salva credencial durável → admissionAck → admissionConfirmed`, bindings peer/connection/player, snapshots privados/revisões, comandos e resync, resume token AES-GCM Android Keystore, leave definitivo revogando tokens e liberando membership, transient disconnect retomável, host stop. UI diagnóstica `/__lan-room` **só com `VITE_LAN_ROOM_UI=1` em Android**; não distribuída no Release.

**PL-02A:** `src/features/multiplayer/persistentRoom.ts` (runtime/coordinator) e `persistentProtocol.ts`, `persistentReplica.ts`, `multiplayerGames.ts`, `multiplayerGames.synthetic.ts` e testes. Um runtime contínuo, lifecycle/host role, `toy A → results → lobby → counter B`, `gameSessionId` distintas, um cursor de revision, `clientSeq` e idempotência, private projections por jogador, preflight e limite frame 16 KiB. **Apenas unitário/sintético; não conectado à LAN.**

**PL-02B parcial:** codec v2 isolado em `lan/lanPersistentWire.ts` com testes; Android nativo `LanHelloAuthenticator.java` aceita **protocolo por Room**, v1 por padrão e v2 com opt-in, rejeitando wrong version sem downgrade; cofre `LanResumeCredentialVault.java` grava `protocolVersion` junto com pin e endpoint, interpretando credenciais antigas sem campo como v1; `LanServerPlugin.java` opt-in v2 apenas WSS, `LanSecureClientPlugin.java` gera `resumeHello` com versão persistida. Bridges opt-in `LanNativeHost.startSecureV2/sendV2/onV2Event` e `LanSecureNativeClient.connectV2/sendV2/onV2Event`. **v1 permanece compatível**. Teste físico S23↔S25 FE comprovou TLS pin, versão errada rejeitada pelo host, bytes bidirecionais v2 e native resume versionado.

**Atenção:** o teste físico v2 até agora **registrou token diretamente via plugin e enviou frames brutos**, sem realizar a admissão Room v2 e sem executar jogos sintéticos no runtime sobre WSS. Não chamar PL-02B completo.

## Últimos resultados verificáveis

- `npm test`: **462/462 Vitest** (72 arquivos).
- `npm run typecheck`: PASS; `npm run lint`: PASS.
- `./gradlew :app:testSecureProbeUnitTest`: **34/34 testes JVM**, 8 suites, 0 falhas.
- Vite build experimental `VITE_LAN_ROOM_UI=1` e APK `:app:assembleSecureProbe`: PASS. Mesmo APK instalado nos dois telefones.
- Teste físico do transporte v2 e regressão física de ingresso/comando/leave **v1**: PASS no hotspot sem WAN.
- Build Vite **padrão**, `cap copy android` e `:app:assembleRelease`: PASS, sem UI diagnóstica.
- Hash SHA-256 do SecureProbe testado: `5586f86db42ff8d88f8598a5969f125bba2aa3f9a31b83d9c837ae2d3c9669d7`.
- Hash SHA-256 do Release compilado: `349a06fa013b409317609f577fa8070ceef82097be3f1f41f1ff2ee59ec4b0d4`.
- `git diff --check` passou. Os resultados acima se referem ao código do commit `fe3044f`; não foram reexecutados após o commit, pois o conteúdo não mudou.

## Dispositivos e execução física

- S23 anfitrião (ADB `RXCX705P3JR`), hotspot/host IPv4 `10.245.112.98/24` (`swlan0`).
- S25 FE convidado (ADB `RXGL30N4F3F`), Wi-Fi `10.245.112.245/24` (`wlan0`).
- Os aparelhos estavam disponíveis e conectados em 11/10, **mas revalidar `adb devices -l`, `ip -4 route` e SSID a cada teste**. Não presumir que o hotspot continuará ativo. Evitar WAN e **não usar ADB forward da porta de multiplayer**, somente CDP para inspeção de interface quando necessário.
- O experimento físico anterior encerrou as portas temporárias 19222/19223. Outras portas ADB preexistentes (ex.: 9223) não devem ser removidas sem identificar proprietário.
- O aplicativo Android Release é deliberadamente sem a rota experimental. Em debug, não confundir o manifesto cleartext experimental com Release seguro. Após qualquer teste `VITE_LAN_ROOM_UI=1`, restaurar `vite build` normal, `cap copy android` e `:app:assembleRelease`.

## PRÓXIMO PASSO — PL-02B, subgate de admission v2 (escopo controlado)

**Objetivo:** vincular o `hello` nativo v2 à admissão autorizada de Room e ao `RoomCoordinatorV2`, mantendo ingresso seguro e regressões v1. Separar em subgates TDD; não implementar PL-03 ainda.

1. Auditar **somente os contratos que serão editados**: `lanIngressHost.ts`, `lanIngressClient.ts`, `lanRoomHost.ts`, `lanRoomSession.ts`, `lanAdmission.ts`, `lanInvite.ts`, `lanWire.ts`, `lanPersistentWire.ts`, `persistentRoom.ts`, `lanNativeHost.ts`, `lanSecureNativeClient.ts` e testes próximos.
2. Definir contrato versionado de convite v2 **distinto** do prefixo `galerows-lan-v1:`. Não entregar segredo de admissão por descoberta de salas. Manter token single-use/TTL, código presencial, pin TLS; version mismatch fail closed.
3. Implementar host admission binding seguro `peerId ↔ connectionId ↔ playerId`, usando fila serializada do `RoomCoordinatorV2`; o `hello` nativo sozinho **não** admite jogador. Após `admitted`, guest grava token criptografado e responde ACK; host só indica presença admitida após `admissionConfirmed`; caso falhe, compensar membership/revogar token/atualizar revision sem leaks.
4. Implementar guest v2 entry/session e resume com envio/recepção pelo codec v2, snapshot privado autorizado, `resync` em gaps, leave revogando credencial e membro, proteção contra duplicate/replay, peer antigo, timeout e stop. Serializar corrida de admission/leave/resume.
5. Criar **probe diagnóstica sob flag** apenas para `toy A → results → lobby → counter B` com duas pessoas e mesma Room (sem PL-03/sem jogos comerciais). Comprovar `roomId`, `playerId`, `gameSessionId`, revision e secret isolation. Testar S23 e S25 FE hotspot sem WAN, diferenciar simulação de prova física.
6. Critério de gate: TDD vermelho-verde focado pelo executor; revisão Commander + regressão completa/JVM/builds/ADB **somente após implementação**. Preservar 16 KiB, pinning, credential vault, host-only controls, e fluxos v1. Não usar fallback para protocolo v1 para fazer v2 funcionar.
7. **PL-02B deve parar para revisão.** PL-03 (interface bonita do lobby), PL-04 (salas próximas), Task 7/PL-05 e PL-06 (jogos reais) continuam bloqueados.

## Distribuição de execução e guardrails

- Preferência explícita do usuário: **usar este chat ou outro chat com Remote Desktop Commander como executor padrão**, aproveitando execução local, auditoria, builds, ADB e testes físicos. **Codex pode ajudar, mas apenas quando fizer diferença técnica**; não repetir trabalho em duas conversas.
- Não tocar nos **mesmos arquivos simultaneamente** pelo Commander deste chat, Commander do outro chat e Codex. Um executor por subgate. Antes de continuar, confirmar se há processos/testes/editores ativos.
- Não usar Codex para varredura de arquivos, comandos repetitivos, builds/Gradle gerais ou ADB se o Commander já faz isso. Para refatoração complexa/concorrência, Codex opcional com TDD focado.
- Sem novo push, merge, manipulação de `main`, reset, clean, remoção de documentos ou alteração de jogos reais sem autorização.
- A branch ainda **não tem upstream**; os commits locais preservam o estado, mas não constituem backup remoto. Solicitar decisão específica do usuário antes de `git push -u origin feat/multiplayer-lan-task1-wss`.
- Este handoff é a descrição do estado **no instante dos dois commits locais**. Informações antigas nos documentos de evidência são históricas; os adendos mais recentes e `git log -2` prevalecem.

## Prompt de abertura resumido para o próximo chat

> Continue Galerows usando @Remote Desktop Commander na branch `feat/multiplayer-lan-task1-wss`, repositório `/Users/renanxavier/Documents/GitHub/galerows`. Leia integralmente `docs/superpowers/plans/2026-10-11-pl02b-next-chat-handoff.md`, `docs/lan-pl02b-native-version-evidence.md` e o design PL-00. Primeiro audite Git e preserve os dois commits locais e todos os arquivos. Execute apenas o próximo subgate de PL-02B com TDD, priorizando admission v2 segura integrada à Room e sem mexer em PL-03, discovery, Task 7 ou jogos reais. Use Commander como executor; Codex somente se estritamente necessário. Não criar commit/merge/push sem nova solicitação; ao final relatar testes e parar para revisão. Dois aparelhos Android podem estar disponíveis; verificar ADB/rede antes de usá-los.
