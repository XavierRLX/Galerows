# Galerows — PL-02B: retomada segura e saída terminal LAN v2

**Data:** 11/10/2026. **Subgate:** resume e leave versionados de PL-02B. **Resultado:** PASS em integração simulada, sem prova Android física de ponta a ponta. **PL-02B permanece ABERTO.**

## Baseline e execução

- Repositório `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch `feat/multiplayer-lan-task1-wss`, HEAD `c284ff8` preservado.
- Preservadas todas as alterações locais dos gates anteriores de admissão e comandos/resync.
- TDD com Remote Desktop Commander, sem Codex, sem commit, merge, push, reset ou limpeza.
- Dois aparelhos Android presentes no ADB: Galaxy S23 e S25 FE. **Não foram feitos testes físicos adicionais neste gate**, para evitar provar prematuramente a sessão antes da probe controlada.

## Novos contratos v2

`lanPersistentWire.ts` possui validação rigorosa de payload/version para:

- `resumeHello` (aplicação da versão 2; gerada pelo cliente nativo no handshake WSS, nunca confundir com v1)
- `resumedV2`, `resumeAckV2`, `resumeConfirmedV2`
- `leaveRequestV2`, `leaveConfirmedV2`, `leaveRejectedV2`

As mensagens de resume contêm snapshot v2 privado do destinatário, `resumeId` e nova credencial criptograficamente aleatória; a chamada nativa `connectResume(roomId)` preserva a versão armazenada e o pin TLS. Não foi alterada a codificação do protocolo LAN v1.

## Segurança e semântica do host

- A autoridade `RoomCoordinatorV2` é fonte única de membership; `reassociate(playerId, connectionId)` preserva a identidade, cria nova revisão e invalida o vínculo do socket antigo.
- O host valida o token nativo *e novamente* o token atual/pendente, expiração, Room, player e ausência de leave pendente.
- Rotação em duas etapas: registra um próximo token no autenticador nativo, entrega `resumedV2`, cliente persiste o token no Android Keystore antes de emitir ACK, host então revoga o anterior e confirma. Se a confirmação for perdida, o novo token persistido pode ser usado numa nova tentativa. O token anterior não é reutilizado depois de revogado.
- Até o ACK do resume, o novo peer não pode enviar comandos/resync. O timeout fecha o peer não confirmado; não deixa a Room eternamente bloqueada.
- `LEAVE_ROOM` valida binding atual, bloqueia comandos/resume, revoga `current` e `pending` (se existir), remove membership/revision no coordinator, emite `leaveConfirmedV2` e fecha a conexão. Tombstone temporária por peer e `commandId` impede segunda remoção.
- Falha de revogação nativa: o host **não** remove o membro ou informa sucesso; deixa-o em `leaving`, sem comandos/resume, e admite retry da revogação pela mesma conexão. Falha durante `resumeAck` provoca fechamento do host (*fail closed*).
- `stop()` revoga tokens inclusive de membros previamente desconectados e fecha o servidor. O certificado/porta/Room antiga não são reutilizados automaticamente.

## Semântica do cliente

- `LanPersistentGuestAdmission.resume(roomId, expectedPlayerId?, previousReplica?)` abre conexão via cofre nativo versionado e aplica snapshot atual, preservando o mesmo playerId, seq e revision; rotaciona credencial **antes** do `resumeAckV2`.
- `leaveRoom(commandId?)` exige `leaveConfirmedV2` com room/player/command corretos para limpar a credencial do Keystore. Com ACK ausente ou socket perdido, informa `leave_unconfirmed` e **não** limpa a credencial; o host pode já ter revogado o token e concluído a saída. Não prometer confirmação automática.
- `leaveRejectedV2(revocation_failed)` permite tentar novamente pela mesma conexão, mantendo bloqueio de gameplay. Não informa sucesso sem prova.
- Nenhum token privado deve ser registrado em logs ou transmitido para outros peers.

## Testes e evidências

| Verificação | Resultado |
| --- | --- |
| TDD dos envelopes resume/leave v2 | RED inicial por falta de frames; GREEN ao adicionar validadores |
| `lanPersistentResumeLeaveWire.test.ts` | 2/2 |
| `lanPersistentResumeLeave.test.ts` | 6/6 em transporte nativo simulado |
| `npm test` completo | **493/493 Vitest**, 80 arquivos, 0 falhas (anterior: 485/485) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `git diff --check` | PASS |
| `:app:testSecureProbeUnitTest` | **34/34 JUnit**, 8 suites, zero failures/errors/skips |
| `:app:assembleRelease --offline` | PASS (Gradle); APK existente **up-to-date** |
| SHA-256 do APK Release existente | `349a06fa013b409317609f577fa8070ceef82097be3f1f41f1ff2ee59ec4b0d4` |
| `npm run build` | **BLOCKED** por import não resolvido `./landing.css` em `src/features/landing/LandingPage.tsx`; ver nota abaixo |

O teste de rede simulada confirmou: resume mantendo identidade/seq; substituição de peer ativo; retomada após disconnect; revogação de token antigo; retomada novamente após `resumeConfirmedV2` perdido; ACK de resume falsificado; leave com remoção uma só vez e cofre limpo; leave com confirmação perdida e cofre preservado; falha de revogação e retry sem commit prematuro.

**Atenção à prova Android:** como o novo build web falhou, os assets Android não foram copiados neste gate. Gradle `assembleRelease` executou sobre os assets anteriores, não sobre as alterações TypeScript deste subgate. O hash inalterado não demonstra integração Android atual.

## Descoberta de alteração externa simultânea no checkout

Ao iniciar o gate, `git status` **não** mostrava mudanças de `src/main.tsx`, `src/app/appMode.ts` nem `src/features/landing/`. Durante a regressão, esses arquivos apareceram modificados/criados sem ação desta execução. `LandingPage.tsx` importa `./landing.css`, ausente do diretório. `git show HEAD:src/features/landing/LandingPage.tsx` indica que o arquivo da landing não existe no commit `c284ff8`, e `git ls-files src/features/landing` é vazio.

Não se deve inventar `landing.css`, restaurar `main.tsx`, descartar os arquivos externos, alterar a landing, gerar build Release parcial ou culpar o PL-02B. O bloqueio foi preservado para o responsável pelo trabalho paralelo resolver em seu próprio escopo. Confirmar que outros processos/agentes estão concluídos antes de novo gate de build e prova física.

## Pendências e gate seguinte

- **PL-02B ainda não tem validação física de resume/leave v2 com S23↔S25 FE**.
- Avaliar `leave` com falha de revogação seguida de perda do socket (estado `leaving` conservador) e reconciliação/encerramento seguro; reconfirmar tombstone e política de ACK perdido.
- Reconfirmar timeout real de resume nativo e reconexão durante jogo em andamento, inclusive snapshot privado de GameSession atual e troca para novo jogo.
- Resolver isoladamente o bloqueio da landing/build sem sobrescrever alterações externas.
- Criar probe diagnóstica **somente sob `VITE_LAN_ROOM_UI=1`**, restrita a toy/counter sintéticos; testar por ADB/hotspot sem WAN, com teste de retomada e saída, depois build Android Debug/Release normal e ausência da probe no Release.
- Não iniciar PL-03, descoberta de salas, Task 7, integração dos jogos reais nem deploy.
- **Parada:** subgate de resume/leave com PASS simulado, aguarda revisão; nenhum commit, merge ou push autorizado.
