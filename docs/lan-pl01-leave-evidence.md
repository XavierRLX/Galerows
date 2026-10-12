# Galerows — PL-01: revisão independente, regressão completa e teste físico (11/10/2026)

**Veredito:** `PL-01 PASS` para **saída definitiva de convidados no protocolo LAN v1 do Android experimental**, com ressalvas documentadas; não é aprovação de Release, lobby nem PL-02.

## Baseline e escopo

- Repositório: `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch `feat/multiplayer-lan-task1-wss`, HEAD `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`, preservados. Worktree dirty e untracked das Tasks 1–6 preservados. Sem commit, merge, push, reset ou clean.
- Implementação do Codex entregue em `lanRoomHost.ts`, `lanWire.ts`, `lanRoomTransport.ts`, `lanRoomSession.ts`, `LanRoomScreen.tsx` e respectivos testes. O Commander não alterou esses arquivos funcionais.
- Revisão independente focada no binding `peerId → connectionId → playerId`, credenciais `current/pending`, deduplicação/serialização de saída, perdas de ACK, revogação e fallback de `stop()`. Sem alterações de protocolo v2, jogos reais, lobby, NSD/mDNS ou `main`.

## Revisão de comportamento

1. `leaveRequest` só é autorizado para a membership convidada da conexão atual. Convidado não pode forjar `playerId` de outro membro ou encerrar a sala.
2. Ao sair, o host bloqueia comandos e resume concorrentes, revoga os tokens `current` e `pending`, remove membership via `runtime.leave()` uma vez, entrega a revision aos demais e responde `leaveConfirmed` antes de fechar o peer.
3. Confirmação perdida não ressuscita membership nem credencial válida; cliente exibe saída não confirmada. Cofre Android é limpo apenas após confirmação reconhecida.
4. Desconexão temporária utiliza `disconnect()`, mantém membership e pode usar `resume()`; não é interpretada como saída definitiva.
5. Se a revogação falha, não há sucesso prematuro. Se o peer desconecta enquanto há revogação falha, a política implementada encerra a Room inteira para evitar identidade inacessível e token ativo. **Trata-se de fallback conservador e disruptivo**, cabendo reavaliação na política de lobby futuro sem enfraquecer a segurança.
6. PL-01 mantém protocolo e frame v1, Android Keystore, certificado pinado e admissão com `admissionAck/admissionConfirmed` anteriores.

## Verificações completas realizadas pelo Remote Desktop Commander

| Etapa | Resultado |
| --- | --- |
| `npm test` | PASS — **420/420 testes**, **69 arquivos** |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| Vite build padrão | PASS |
| Vite experimental `VITE_LAN_ROOM_UI=1` | PASS |
| `npx cap copy android` com assets experimentais | PASS |
| JVM Gradle `:app:testDebugUnitTest` | PASS — **26/26** após correção de um teste instável |
| `:app:assembleSecureProbe` | PASS com UI experimental |
| `:app:assembleRelease` | PASS com UI experimental durante ensaio e PASS novamente com assets padrão restaurados |
| `git diff --check` | PASS |
| Rota experimental no build padrão | Ausente; chunk `LanRoomScreen` não aparece em `dist/assets` |
| Git | Branch/HEAD preservados; sem commits |

**Teste JVM preexistente com ordenação não determinística:** no primeiro JVM full run, `LanSocketServerIntegrationTest.simultaneousPeersAndReconnection` falhou porque assumia incorretamente que `connected` do socket A chegaria primeiro. Uma repetição focada confirmou a falha. O Commander alterou **somente esse teste** (`android/app/src/test/java/com/galerows/app/LanSocketServerIntegrationTest.java`), inserindo frame `identify-a` para correlacionar cada `peerId` ao cliente correto antes de validar o envio. Preserva dois sockets simultâneos, corrige o teste sem alterar código de produção/protocolo; JVM full posterior passou 26/26.

**Artefatos:**
- `android/app/build/outputs/apk/secureProbe/app-secureProbe.apk` (experimental PL-01) SHA-256: `e54cc42708afa6e9de326a19f368637761e60bd430e5caf7a35220b7820f3081`.
- `android/app/build/outputs/apk/release/app-release.apk` (padrão restaurado, sem UI LAN) SHA-256: `9ce9176e93c68fdacdeed8a6378942820726194b4d059ad13c356162ae298d67`, igual à baseline anterior.

## Ensaio físico — S23 e S25 FE

Aparelhos físicos conectados por ADB USB, com **tráfego do multiplayer LAN em WSS pelo hotspot, sem encaminhamento ADB da porta de jogo**:

- Anfitrião: Galaxy S23, `RXCX705P3JR`, `swlan0=10.245.112.98/24`.
- Convidado: Galaxy S25 FE, `RXGL30N4F3F`, `wlan0=10.245.112.245/24`.
- Ambos na `10.245.112.0/24`, sem rota IPv4 default durante o teste. Mesmo APK experimental instalado em ambos por `adb install -r`.
- Interface inspecionada por CDP WebView via ADB somente para navegação/controles/estado, sem portar os sockets LAN. Convite e código de teste transferidos em memória para a UI, sem expor token ou QR em saída de diagnóstico. **Não repetimos câmera/QR nem conferência humana do código presencial**, já ensaiados na Task 6.

| Caso real | Resultado observado |
| --- | --- |
| Criar sala e admitir convidado | PASS — 2 membros incluindo anfitrião; convidado `Na sala` |
| Botão `Sair definitivamente` | PASS — guest `Você saiu da sala`; host caiu de 2 para 1 membro |
| Cofre nativo após confirmação | PASS — `connectResume(roomId)` antigo rejeitado por ausência de credencial |
| Reingresso com convite renovado | PASS — host voltou a 2 membros, nova identidade `playerId` diferente da anterior |
| Botão `Desconectar e retomar` | PASS — UI desconectada, mas membership mantida no host |
| `Tentar retomar` | PASS — conexão retomada na mesma sala |
| Encerramento remoto do host | PASS — ambos mostram `Sala encerrada` |

**Não ensaiados fisicamente no PL-01:** falha parcial de revogação no plugin nativo, ACK de leave perdido e forja de identidades; há cenários correspondentes em Vitest com mocks. Isolamento simultâneo de dois convidados físicos não foi provado com somente dois telefones.

## Conclusão e próximos gates

**PL-01 APROVADO no escopo v1.** O problema original das vagas órfãs geradas por `Sair` foi corrigido e confirmado em dois aparelhos. A saída e o reconnect são agora opções distintas.

**PL-02 permanece não iniciado.** Seu design deve incluir a coordenação de `RoomLifecycleAdapter`, `GameSession` tipada, versão de handshake Java/TS, `roomRevision` e limites, conforme `persistent-lobby-technical-design.md`. Não iniciar descoberta, jogos ou Task 7 sem seus gates próprios.
