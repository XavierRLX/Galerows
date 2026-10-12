# Galerows — PL-02B: handshake v2 nativo opt-in, ponte e regressão física

**Data:** 11/10/2026. **Status:** subgate de transporte nativo **PASS**; PL-02B completo **PENDENTE**. Execução neste chat com Remote Desktop Commander; **nenhum crédito do Codex usado**.

## Baseline e escopo

- Repo `/Users/renanxavier/Documents/GitHub/galerows`, branch `feat/multiplayer-lan-task1-wss`, HEAD `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`, working tree e untracked intencionalmente preservados.
- Fontes: `docs/lan-pl02a-review-and-pl02b-wire-evidence.md`, `docs/superpowers/plans/2026-10-11-pl02-execution-handoff.md`.
- Resultado: servidor nativo Android permite **selecionar versão por Room**, aceita somente `hello/resumeHello` naquela versão; **v1 continua default** para o app existente; v2 exige opção explícita no `startSecure`. O cliente nativo passa a carregar versão de seu cofre AES-GCM no `connectResume`; credenciais antigas sem versão são interpretadas como v1.
- O decoder v2 isolado de aplicações, `LanNativeHost.startSecureV2/sendV2/onV2Event` e `LanSecureNativeClient.connectV2/sendV2/onV2Event` foram preparados sem substituir o parser v1. Os frames são validados pelo codec isolado; a ponte WSS v2 ainda **não** aciona o RoomCoordinator/ingresso autoritativo.

## Arquivos alterados neste subgate

**Android:**
- `android/app/src/main/java/com/galerows/app/LanHelloAuthenticator.java`: construtor de versão 2 com fail closed e default legado 1.
- `android/app/src/main/java/com/galerows/app/LanServerPlugin.java`: opção `protocolVersion=2` somente para `startSecure`, recusa valores inválidos e v2 cleartext.
- `android/app/src/main/java/com/galerows/app/LanResumeCredentialVault.java`: versão 1/2 validada dentro do JSON cifrado; leitura de credenciais antigas v1; rotação preserva versão/pin/endpoint.
- `android/app/src/main/java/com/galerows/app/LanSecureClientPlugin.java`: `storeResumeCredential` aceita versão opcional default1; `connectResume` constrói hello com versão armazenada.
- Testes novos `LanHelloAuthenticatorVersionTest.java` e `LanResumeProtocolVersionTest.java`, e teste `versionTwoHelloAndResumeUseActualWebSocketWithoutV1Downgrade` no `LanSocketServerIntegrationTest.java`.

**TypeScript:**
- `src/features/multiplayer/lan/lanNativeHost.ts` e `lanSecureNativeClient.ts`: métodos opt-in v2 e `StoredResumeCredential.protocolVersion?` sem mudança nas chamadas v1 existentes.
- Novo teste `src/features/multiplayer/lan/lanNativeProtocolVersion.test.ts`.

## TDD / regressão automatizada

- **Vermelho observado**: testes JVM não compilavam construtor `LanHelloAuthenticator(room,token,2)`; depois passaram ao implementá-lo.
- **Vermelho observado**: testes do vault v2 não compilavam `credentialProtocolVersion`/validação; passaram após persistência de versão no cofre.
- **Vermelho observado**: três casos Vitest da ponte TypeScript falharam porque métodos v2 não existiam; **5/5 verdes** após implementar e corrigir ESLint.
- Teste de socket JVM real verifica v1 rejeitado em Room v2, v2 aceito, `resumeHello` v2 encaminhado ao host e close de peer.
- **Regressão total:** `npm test` **462/462**, 72 arquivos; `npm run typecheck` PASS, `npm run lint` PASS, `:app:testSecureProbeUnitTest` **34/34 JVM**, 8 XML de suites, 0 failures/errors/skips.
- `VITE_LAN_ROOM_UI=1 vite build`, `cap copy android`, `:app:assembleSecureProbe` PASS.
- Build web padrão restaurado, `LanRoomScreen` ausente dos chunks; `cap copy android` padrão e `:app:assembleRelease` PASS; `git diff --check` PASS.

## Testes físicos — S23 anfitrião / S25 FE convidado

- USB/ADB: S23 serial `RXCX705P3JR`, hotspot `swlan0=10.245.112.98/24`; S25 FE serial `RXGL30N4F3F`, `wlan0=10.245.112.245/24`. Sem default route IPv4 nas interfaces conferidas no início.
- Mesmo APK `secureProbe` PL02B SHA256 `5586f86db42ff8d88f8598a5969f125bba2aa3f9a31b83d9c837ae2d3c9669d7` instalado nos dois aparelhos. Rede LAN pelo hotspot **sem forward ADB do WebSocket**; ADB/CDP apenas para navegação de teste e invocação do plugin.
- **PASS — pinning:** fingerprint incorreto foi rejeitado antes de ingressar no servidor.
- **PASS — sem downgrade:** `hello` v1 com capacidade correta não provocou evento `connected` numa Room nativa v2. Observação: a API do cliente pode resolver a tentativa de conexão antes de receber o fechamento remoto; o critério seguro observado é **ausência de peer autenticado no host**.
- **PASS — v2:** `hello` v2 correto no TLS pinado provocou `connected` no host, e frames de envelope v2 foram transportados nos dois sentidos. **O servidor não aplicou esses frames a um RoomRuntime**, pois tratava-se apenas de teste dos bytes após o handshake.
- **PASS — v2 resume:** host registrou token efêmero do player de teste; guest salvou `protocolVersion=2`, endpoint e fingerprint no cofre; após disconnect, `connectResume(roomId)` aceitou a reconexão e o host observou o `resumeHello` v2. Credencial de teste removida no fim e servidor parado.
- **PASS — regressão v1 física:** usando UI LAN experimental preexistente, convidado ingressou após verificação de código, comando incrementou contador nos dois, `Sair definitivamente` reduziu host de 2 para 1 membership e host encerrou sala. Nenhuma mudança na interface funcional ou no protocolo v1.

## Artefatos

- APK experimental Android secureProbe (com UI de teste) SHA-256 `5586f86db42ff8d88f8598a5969f125bba2aa3f9a31b83d9c837ae2d3c9669d7`.
- APK Release padrão (sem UI experimental) SHA-256 `349a06fa013b409317609f577fa8070ceef82097be3f1f41f1ff2ee59ec4b0d4`.
- Logs sem capacidades/token, script diagnóstico temporário fora do repo, limpeza ao fim.
- Nenhum commit, merge, push, reset, clean, alteração da `main` ou integração de jogos reais.

## Pendências reais de PL-02B

1. **Convite e admission v2:** codificar convite v2 distinto e adicionar `hello/joinRequest/admitted/admissionAck/admissionConfirmed`, com proteção contra replays, TTL e código presencial.
2. **Host/coordinator v2:** integrar `RoomCoordinatorV2` ao servidor autenticado; serializar ingresso, saída, revogação, comando com `clientSeq`, snapshot, resync, disconnect/reassociate e stop. Não aceitar comando antes do ingresso confirmado nem confiar em `playerId` do frame sem binding.
3. **Guest Session v2:** persistir credential **somente após admissão validada**, manter autenticação e reconexão seguras; tratar token e versão sem downgrade. Prova de duas GameSessions sintéticas no mesmo WSS e `playerId`.
4. **Probe limitada:** expor a máquina de estados A→resultado→lobby→B na UI diagnóstica flag-only para teste físico; não construir lobby comercial PL-03.
5. **Segurança de parsing:** métodos `onV2Event` opt-in, como o v1 atual, ignoram frames inválidos. No PL-02B final, o ingresso/coordinator deve **fechar conexão ou sinalizar erro terminal** nos frames protocolarmente impossíveis, sem tratar silêncio como confirmação.
6. **Gate posterior:** teste físico end-to-end de admissão v2, leave, reconnect, troca de GameSession, segredo privado e release. **Não** usar o teste de socket deste subgate para declarar o PL-02B completo.

**Conclusão:** subgate handshake/credencial v2 nativo **APROVADO**. PL-02B completo continua **ABERTO**, PL-03 e Task 7 ainda não iniciados.
