# Galerows — PL-02B: revisão final de segurança, múltiplos membros e duração de Room

> **ADENDO PL-02B-REKEY (12/10/2026):** o risco material de token ativo de 2h foi tratado por rekey autenticado periódico e persistência nativa antes do ACK, com prova física S23 ↔ S25 FE; **518/518 testes**. Leia `docs/lan-pl02b-rekey-evidence.md` como fonte mais recente. O status **OPEN / NO-GO** desta revisão histórica permanece para os demais gates de corrida/Doze/logs de debug e jogo real, mas **REKEY agora é PASS**.

**Data:** 12/10/2026 (BRT). **Branch:** `feat/multiplayer-lan-task1-wss`. **Baseline e HEAD final:** `e6859c1`. **Escopo:** jogos sintéticos da Room v2, sem ativação da UI comercial ou de jogo real. **Classificação:** PASS dos subgates aqui exercitados; **PL-02B geral continua OPEN / NO-GO para lançamento de multiplayer real**.

## Baseline preservado

- A landing/identidade visual introduzida por `e6859c1` permaneceu intacta.
- Todas as alterações locais herdadas (admissão, command/resync, resume/leave, probe e evidências) foram preservadas; os arquivos desta revisão foram adicionados ao mesmo working tree.
- Nenhum `git reset`, `clean`, merge, push, deploy ou commit nesta revisão.
- Dois aparelhos físicos S23 e S25 FE estavam disponíveis por ADB; a prova física anterior foi documentada em `docs/lan-pl02b-physical-v2-evidence.md`. Este subgate **não afirma um terceiro aparelho físico**.

## TDD: três membros e isolamento de credenciais

`lanPersistentResumeLeave.test.ts` foi estendido para simular, através dos contratos reais `LanPersistentRoomHost` e `LanPersistentGuestAdmission`:

1. Room com **três memberships** (host + guest + guest-2), convidados em **dois cofres nativos simulados independentes**.
2. Tokens únicos e armazenados sob playerId correto no autenticador; cada cliente recebe sua própria projeção/segredo sintético em `toy`, sem o segredo alheio sequer no JSON de seu estado.
3. Tentativa de declarar o `playerId` do primeiro convidado com o token do segundo é negada antes de assumir membership; os demais permanecem autorizados.
4. Segunda identidade volta por resume mantendo seu segredo, mesmo após desconexão e tentativa de personificação.
5. Saída definitiva do primeiro convidado revoga somente sua credencial; o segundo ainda consegue executar um comando autenticado de partida e depois sair individualmente.

**Limitação:** os convidados adicionais deste ensaio foram transportes **simulados**, não um terceiro Android físico. O teste físico com S23 ↔ S25 FE e hotspot sem WAN foi realizado na etapa anterior.

## TDD: ACK perdido durante rotação

Foi introduzida a perda deliberada do quadro `resumeAckV2` **cliente → host**, além do caso anterior de `resumeConfirmedV2` perdido **host → cliente**.

- A credencial pendente foi persistida no vault *antes* de seu ACK.
- A primeira tentativa excede o timeout sem que o cliente declare `admitted`.
- A segunda tentativa autenticada pelo token pendente reassocia a mesma identidade; host revoga os tokens obsoletos e mantém o mesmo membership.
- Replays e bindings antigos continuam sem autorização. Saída do membro e remoção do novo token foram verificadas no final.

## Política de validade e proteção cruzada JS/Android

- Certificado TLS efêmero Android: validade **24h** em `LanTlsIdentity.java` (inalterada).
- V2: prazo máximo nominal de Room **23h**, uma hora antes do limite TLS.
- `LanPersistentRoomHost.ts`: timer de 23h fecha a Room, rejeita convites/comandos posteriores e não reabre Room nem reinicia watchdog após stop. Duas provas com temporizador fake (expiry e stop manual), mais prova de `room_expired` assíncrono.
- `LanV2RoomLifetimePolicy.java`: `watchdogDelayMs(2)=23h`, `watchdogDelayMs(1)=0`; preserva todo ciclo de vida LAN v1. Dois testes JUnit adicionados, primeiro RED por classe ausente e GREEN após implementação.
- `LanServerPlugin.java`: `Handler` no main looper agenda shutdown nativo por identidade da instância; ao atingir o prazo, emite `room_expired` e fecha peers/certificado, mesmo se JS estiver suspenso no background. Remove callback em `stop`/destruição/encerramento, para não atingir uma Room nova.
- `LanPersistentRoomHost`: ao receber `room_expired`, fecha sua autoridade de maneira idempotente. `stop()` foi endurecido para aguardar fechamento em curso, revogar os tokens dos desconectados e remover listener ainda que o nativo falhe.
- **Limite técnico:** timers Android podem executar após atraso de suspensão profunda; o processo morto fecha os sockets; o evento será tratado pelo JS quando a WebView voltar a processá-lo. Não há SLA de encerramento em milissegundos sob Doze.

## Risco residual material: credenciais com TTL 2h e Room até 23h

O token de retomada dura **2 horas** e é rotacionado durante **resume**. Ainda **não existe rekey em sessão ativa**, e um convidado conectado por mais de 2h poderá continuar jogando, porém não terá reconexão garantida caso perca o socket após a expiração do token.

**Decisão de segurança:** não prometer retomada por 23h nem marcar esta limitação como resolvida. Próximo gate: renovar credenciais v2 pelo canal WSS autenticado **antes** de 2h, com persistência no Android Keystore antes do ACK, revogação do token anterior após confirmação, tratamento de falha/ACK perdido, clientSeq inalterada, reconexão sem quebra de segredo e testes de longa duração com relógio falso. Alternativa conservadora de produto: reduzir a duração máxima da Room para menos de 2h antes de liberar uso real. Essa decisão não está implícita no teste de 23h.

## Resultado de regressão

| Gate | Resultado |
| --- | --- |
| `npm test` | **509/509 PASS**, **84** arquivos Vitest (anterior 504/504) |
| TypeScript | PASS |
| ESLint | PASS |
| `npm run build` padrão | PASS |
| `cap copy android` sem flag da probe | PASS |
| Android `:app:testSecureProbeUnitTest` | **36/36 PASS**, 9 suites, 0 errors/failures (anterior 34) |
| Android `:app:assembleRelease --offline` | BUILD SUCCESSFUL |
| `git diff --check` | PASS |
| Guard Release da probe v2 | PASS; zero assets `LanPersistentRoomProbeScreen` e zero rota `/__lan-room-v2` |
| SHA-256 do APK Release | `c023f5b131ff8808f33dd2f08d8100032ee040910e58850e8ea79eb8dcd01057` |
| Teste físico com **três dispositivos reais** | NÃO executado; há somente dois Samsung fisicamente disponíveis |

## Gates seguintes recomendados

1. **PL-02B-REKEY:** política efetiva para TTL 2h (rekey autenticado na conexão ativa ou fechamento explícito antes do TTL). Não fazer lançamento enquanto reconexão após 2h estiver ambígua.
2. **PL-02B-RACE:** testar falhas durante `registerResumeToken`, `rotateResumeCredential`, `revokeResumeToken`, `resumeAck`, leave e stop simultâneos, incluindo host/guest em background.
3. **PL-02B-MULTI-FÍSICO:** se houver terceiro Android disponível, verificar dois clientes simultâneos reais, tokens separados e segredo isolado; até lá manter PASS apenas simulado para 3 membros.
4. Revisão do histórico/git para organizar commits lógicos de documentação, codec nativo v2, admissão/comandos, resume/leave, prazo e probe (separados do commit de identidade visual). Não instalar app experimental no package de produção nem ativar os jogos reais antes dos gates.

**Parada para revisão:** esta entrega não criou commits; o HEAD e a branch originais do subgate foram mantidos.
