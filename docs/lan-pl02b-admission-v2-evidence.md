# Galerows — PL-02B: subgate de admissão autorizada LAN v2

**Data:** 11/10/2026. **Resultado:** PASS nos testes automatizados do subgate de ingresso; **PL-02B completo permanece ABERTO**. A integração real de duas GameSessions na mesma sala/WSS ainda não foi provada.

## Baseline e controle do escopo

- Repositório: `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch obrigatória: `feat/multiplayer-lan-task1-wss`; HEAD preservado em `c284ff8`.
- Working tree inicial limpa. Os dois commits locais anteriores foram preservados; nenhum commit, merge, push, reset ou clean foi realizado.
- Antes da primeira alteração, foram lidos integralmente `docs/superpowers/plans/2026-10-11-pl02b-next-chat-handoff.md`, `docs/lan-pl02b-native-version-evidence.md` e `docs/superpowers/plans/persistent-lobby-technical-design.md`.
- Executor: Remote Desktop Commander no Mac do proprietário, com TDD. Codex não utilizado.
- Esta entrega **não** ativa jogo comercial, PL-03, descoberta, Task 7, nova interface ou mutações do protocolo v1.

## Implementação incremental

1. **Convite versionado e capacidade:** `lanPersistentInvite.ts` cria/decodifica o prefixo exclusivo `galerows-lan-v2:` com versão 2, validade máxima de 120 segundos, capacidade aleatória de 32 bytes, IP privado, fingerprint e rejeição de campos inesperados. Convites v1 e v2 não são intercambiáveis. A capacidade permanece reservada ao ingresso direto e não é publicada por descoberta de salas.
2. **Wire v2 rigoroso:** `lanPersistentWire.ts` passou a validar `joinRequestV2`, `admittedV2`, `admissionAckV2`, `admissionConfirmedV2`, `rejectedV2` e `roomClosedV2` sem alterar `lanWire.ts` ou `lanAdmission.ts` v1. Mantém limite de 16 KiB em UTF-8 e exige payloads/coerência de snapshot e tokens válidos.
3. **Fronteira host/coordinator:** `lanPersistentRoomHost.ts` usa exclusivamente `startSecureV2`/WSS nativo e `RoomCoordinatorV2`. O `hello` nativo não admite jogador. Após convite válido, gira a capacidade nativa antes de `joinGuest`; vincula `peerId ↔ connectionId ↔ playerId` para comandos somente após o ACK de admissão correto. Entregas de membership aos demais são retidas até confirmação. ACK forjado, frame de aplicação antes de confirmação e frames não suportados provocam rejeição/fechamento.
4. **Credencial e compensação:** host registra token nativo versionado antes de `admittedV2`; guest, em `lanPersistentGuestAdmission.ts`, valida o código presencial derivado do fingerprint TLS, verifica seu snapshot e salva a credencial com `protocolVersion: 2` no cofre nativo criptografado **antes** de emitir `admissionAckV2`. Em disconnect, timeout, erro de registro ou falha de confirmação há compensação por revogação e `RoomCoordinatorV2.leaveGuest`, com revisão de Room avançada. Resultado incerto de revogação interrompe o servidor nativo como medida fail-closed.
5. **Frames inválidos:** as pontes opt-in `LanNativeHost.onV2Event` e `LanSecureNativeClient.onV2Event` agora entregam `invalid_frame` em vez de silenciar erro. As pontes `onEvent` v1 não foram alteradas.

## Arquivos desta entrega

**Novos:**
- `src/features/multiplayer/lan/lanPersistentInvite.ts`
- `src/features/multiplayer/lan/lanPersistentInvite.test.ts`
- `src/features/multiplayer/lan/lanPersistentAdmissionWire.test.ts`
- `src/features/multiplayer/lan/lanPersistentRoomHost.ts`
- `src/features/multiplayer/lan/lanPersistentRoomHost.test.ts`
- `src/features/multiplayer/lan/lanPersistentGuestAdmission.ts`
- `src/features/multiplayer/lan/lanPersistentGuestAdmission.test.ts`

**Modificados:** `lanPersistentWire.ts`, `lanNativeHost.ts`, `lanSecureNativeClient.ts` e `lanNativeProtocolVersion.test.ts`, todos sob `src/features/multiplayer/lan/`.

## Evidências verificadas

| Validação | Resultado |
| --- | --- |
| TDD focado | RED observado inicialmente por ausência dos módulos e por falta das novas formas do codec; GREEN após implementação |
| `npm test` | **476/476 Vitest**, 76 arquivos, 0 falhas; antes eram 462 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` (padrão, sem flag experimental) | PASS |
| `cap copy android` após build padrão | PASS |
| `:app:testSecureProbeUnitTest` | **34/34 JVM** em 8 suites; 0 failures/errors/skips |
| `:app:assembleRelease --offline` | BUILD SUCCESSFUL |
| Rota de diagnóstico `__lan-room` nos assets normais | Ausente (0 arquivos) |
| SHA-256 APK Release `app-release.apk` | `349a06fa013b409317609f577fa8070ceef82097be3f1f41f1ff2ee59ec4b0d4`, idêntico ao baseline |
| `git diff --check` | PASS |
| Git final | HEAD e branch preservados; alterações locais intencionalmente **sem commit** |

Os testes de host/guest usam mocks de transporte nativo e execução JavaScript do runtime/coordinator. Eles comprovam o contrato de admissão no ambiente de teste, **não** uma admissão v2 WSS física de ponta a ponta. O ADB listou os Galaxy S23 e S25 FE conectados, mas **não** foi realizada nova prova física, nem se deve herdar tal status dos testes de handshake v2 anteriores.

## Limites deste gate e pendências PL-02B

- `LanPersistentRoomHost` e `LanPersistentGuestAdmission` implementam **somente ingresso v2**; o host fecha frames de comando v2 ainda não integrados após admissão. Não chamar esta entrega de multiplayer jogável.
- Ainda faltam `commandV2` autenticado e sequenciado, deliveries de partida, snapshot privado e `resyncV2`, resume v2 seguro, saída terminal e revogação completa, testes de replay/peer antigo e prova de transporte nativo integrada a esses fluxos.
- A probe diagnóstica sob flag para **toy A → resultados → mesmo lobby → counter B**, preservando `roomId/playerId`, revisões e isolamento de segredos, não foi iniciada. Teste físico S23 ↔ S25 FE no hotspot sem WAN permanece pendente até esses passos.
- PL-03, descoberta automática/PL-04, Task 7 e integração dos jogos reais permanecem bloqueados.
- Próxima revisão deve avaliar a semântica de confirmação/perda de ACK, a transação entre fila do coordinator e efeitos nativos, o fail-closed em revogação incerta e a futura implementação de resume/leave antes da prova física.

**Decisão de parada:** subgate de admissão LAN v2 **pronto para revisão automatizada**; PL-02B não foi encerrado. Nenhum commit, merge ou push sem autorização explícita.
