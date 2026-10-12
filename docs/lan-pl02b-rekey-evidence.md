# Galerows — PL-02B-REKEY: renovação segura de credenciais WSS

**Data:** 12/10/2026 (BRT). **Branch:** `feat/multiplayer-lan-task1-wss`. **Baseline HEAD:** `e6859c1`. Mudanças não commitadas; `main` intacta.

## Escopo

Rekey de credenciais de retomada da **Room v2** durante conexão autenticada, sem troca de `roomId`, `playerId`, `GameSession`, revisão ou `clientSeq`. Não modifica o protocolo LAN v1 nem integra os jogos comerciais.

### Protocolo de duas fases

1. O host agenda a rotação a cada **60 minutos** enquanto o convidado estiver autenticado e conectado. O token atual possui validade de **2 horas**. Uma margem de segurança impede esperar até o vencimento.
2. O host registra uma nova credencial nativa, mantém a anterior válida e envia `rekeyOfferV2` com `rekeyId`, token novo e validade. A credencial fica pendente, sem avanço de autoridade.
3. O cliente valida `roomId`/`playerId` e persistência temporal, grava primeiro no **Android Keystore (vault AES-GCM)** e só depois envia `rekeyAckV2`.
4. O host valida o vínculo do peer, `rekeyId` e token pendente, **revoga a credencial anterior no autenticador nativo**, promove a nova e responde `rekeyConfirmedV2`.
5. Em ACK perdido, o host repete a **mesma oferta** a cada 30 s e não revoga a antiga antecipadamente. O cliente reenvia ACK idempotente da mesma oferta, sem gravar duas vezes.
6. Se o socket cair após a persistência mas antes do ACK, o `resumeHello` autenticado pelo token pendente promove-o no host; o token antigo é revogado. Se o cliente retoma com o token antigo, o host revoga a oferta pendente obsoleta antes da nova rotação de resume.
7. Falha do vault não produz ACK, preservando o token atual para repetição. Falhas de registro/revogação nativos implicam **fail-closed da autoridade WSS** em vez de presumir segurança.
8. `leaveRoom` aguarda um rekey já iniciado e revoga **tanto o token atual quanto o pendente**. Quadros atrasados de rekey na fase `leaving` não cancelam a saída. `stop()` cancela os timers e revoga as credenciais também de usuários desconectados.

**Limite explícito:** não é possível renovar o token de um convidado que esteja offline. Um membro ausente por mais de duas horas poderá perder a capacidade de retomar. O limite de 23h da Room e a validade TLS nativa de 24h permanecem independentes.

### Segurança e testes TDD

Os cenários de rekey foram introduzidos **RED antes da implementação**, depois GREEN. São exercitados contratos de `LanPersistentRoomHost`, `LanPersistentGuestAdmission`, codecs estritos v2 e simuladores de vault/registro/peer:

- Rotação ativa, revogação do antigo e continuidade de comandos com revisão inalterada;
- ACK perdido e confirmação perdida; reconexão pelo novo token;
- Falha temporária do Android Keystore com retransmissão e uso da mesma oferta;
- Erros de registro/revogação no autenticador com encerramento seguro;
- Cinco horas de relógio simulado, múltiplas rotações, mesmo membership e reconexão;
- Revogação conjunta de tokens atual e pendente ao sair;
- ACK forjado sem assumir a identidade nem alterar sequência de comandos;
- **Corrida real identificada no Android**: saída durante gravação nativa da nova credencial. Novo teste RED com vault bloqueado; correção espera a operação em curso antes de `leaveRequestV2`.
- Codec rejeita campos adicionais, versão incompatível e IDs/tokens inválidos.

### Prova física

Equipamentos: **Galaxy S23** como host, **Galaxy S25 FE** como convidado. Mesmo Wi-Fi local (S23 `192.168.0.84`; S25 FE `192.168.0.89`), ping local confirmado. **Não foi afirmado isolamento da WAN neste novo ensaio**; a prova sem rota WAN permanece no documento físico PL-02B anterior.

APK experimental **`com.galerows.app.secureprobe`**, com flags **`VITE_LAN_ROOM_V2_PROBE=1`** e **`VITE_LAN_REKEY_PROBE=1`**; temporizador de rekey abreviado (2,5s; retry 1,5s) **somente na probe**, nunca no build padrão. O contador da interface expõe apenas quantidade de rotações persistidas, nenhum token.

Roteiro reproduzível `scripts/lan/pl02b-v2-rekey-physical.mjs`. Log final: `/tmp/galerows-pl02b-rekey-physical-final-strict-v2.log`.

**Resultado: `PHYSICAL_V2_REKEY_PASS steps=10`.**

1. Host WSS v2 e comparação presencial de código;
2. Guest admitido com membership, rev 2;
3. Persistência do novo token no vault observada pelo contador;
4. `toy A` iniciado com segredo privado para o convidado, rev 7;
5. Drop e resume após rekey; mesma GameSession e `hasPrivate=true`, rev 9;
6. Resultados e lobby novamente, rev 11;
7. `counter B` em nova GameSession e sem segredo do jogo anterior, rev 16;
8. Comando INCREMENT aceito e **rev 17 observada em ambos**;
9. Leave confirmado e **rev 18/um membro observados no host**;
10. Host encerra definitivamente a Room.

Houve tentativas anteriores incompletas que **não foram contadas como aprovação**: uma condição de observação incorreta no roteiro, uma corrida real de `rekey_in_flight` corrigida por TDD, e uma corrida de clique na UI experimental tratada com espera por confirmação de comando. A última execução passou integralmente.

### Regressão após restauração do build padrão

- `npm test`: **518/518 PASS**, **84** arquivos Vitest (baseline anterior 509/509).
- `npm run typecheck`: PASS; `npm run lint`: PASS.
- `npm run build` **sem as flags da probe**: PASS; `npx cap copy android`: PASS.
- Assets de distribuição sem rota `/__lan-room-v2` nem identificador de jogo sintético: **RELEASE_PROBE_GUARD_PASS**.
- Android `:app:testSecureProbeUnitTest`: **36/36 PASS**, 9 suites e zero falhas/erros.
- Android `:app:assembleRelease --offline`: **BUILD SUCCESSFUL**.
- `git diff --check`: PASS. Branch `feat/multiplayer-lan-task1-wss`, HEAD `e6859c1` mantido.
- SHA-256 Release `android/app/build/outputs/apk/release/app-release.apk`: `c023f5b131ff8808f33dd2f08d8100032ee040910e58850e8ea79eb8dcd01057`. O APK padrão **não** integra a UI da probe.
- Testes físicos encerrados com ambos os pacotes experimentais parados e redirecionamentos USB/CDP removidos. O Wi-Fi do S23 foi restaurado ao estado anterior (desligado); o S25 FE não teve Wi-Fi alterado.

### Limitações e gates restantes

- Um **terceiro aparelho físico** ainda não foi utilizado; a prova de três memberships e isolamento foi simulada.
- Sem verificação de relógio real ao longo de 23 horas, Android Doze extremo, troca de rede ativa ou stress de 12 convidados.
- No build de depuração, o bridge Capacitor/Logcat pode registrar **conteúdos de quadros e argumentos sensíveis, inclusive credenciais**. **Nunca compartilhar logs brutos**. Auditar/suprimir emissão sensível antes de distribuir builds de debug e verificar comportamento do Release.
- Ainda é necessária revisão integrada de corridas entre suspensão, `stop`, `resume`, `leave` e `rekey`, e organização de commits lógicos antes de iniciar o primeiro jogo real.

**Status deste subgate:** **REKEY PASS nos testes automatizados e no fluxo físico de dois Android**; ainda não equivale à liberação integral de PL-02B/PL-03 ou do jogo Impostor da Palavra. Nenhum push, merge, deploy ou commit nesta entrega.
