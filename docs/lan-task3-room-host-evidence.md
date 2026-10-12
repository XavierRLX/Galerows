# Task 3 — coordenador do anfitrião LAN

Data: 11/10/2026. Branch: `feat/multiplayer-lan-task1-wss`. HEAD inicial: `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`. A árvore já continha alterações e arquivos não rastreados das Tasks 1 e 2; foram preservados. Nenhum commit, merge ou push foi criado.

Atualização: o pré-gate corretivo e a integração convidada posteriores estão registrados em [`lan-task4-guest-session-evidence.md`](lan-task4-guest-session-evidence.md). As pendências abaixo descrevem o fechamento histórico da Task 3.

## Arquitetura implementada

`LanRoomHost` é o coordenador independente de UI. `LanIngressHost` mantém WSS, convite e reserva via `LanAdmissionGate`. Após a validação, o coordenador cria `connectionId` aleatória e chama `AuthoritativeRoomRuntime.join` uma vez. O runtime atribui `playerId` e produz `Snapshot` privado. A entrega de `admitted` é o limite de confirmação local do host; o coordenador só publica o vínculo `peerId → connectionId → playerId` após a escrita do frame. O anfitrião pode entrar como membro lógico local com `joinLocal`, sem socket. Comandos e resync de peers não vinculados são ignorados. Comandos de vinculados chegam ao runtime com a `connectionId` do host; o `playerId` alegado continua sujeito à checagem de membership do runtime. `CommandResult` antecede as deliveries, roteadas por `playerId` **e** `connectionId`.

A confirmação do envio pelo plugin significa que o frame foi escrito no socket, não que a aplicação convidada o processou. A Task 4 deve formalizar o recebimento do convidado por `RoomTransport` e `ClientReplica`; a Task 5 define a retomada após desconexão. Esta Task não implementa essas etapas.

## Admissão e compensação

O ingresso espera a conclusão de comandos e deliveries já iniciados. Entre `join` e o resultado de `native.send(admitted)`, comandos remotos são enfileirados; operações locais são recusadas. Em falha de envio, desconexão ou fechamento, o coordenador executa `runtime.leave(playerId)` como **compensação visível**, não rollback invisível. As deliveries do ingresso e da saída são encaminhadas nas revisões consecutivas aos membros ativos; o convite permanece consumido e é renovado. Um `Snapshot` de admissão que ultrapassa 16 KiB é detectado antes do envio e compensado. Uma sala configurada com `roomId` diferente do runtime também é recusada e compensada.

`leave` incrementa `revision`, portanto uma tentativa malsucedida pode consumir duas revisões. Isso preserva o contrato existente e informa aos membros o ingresso e saída transitórios. Após admissão bem-sucedida, desconexão ou falha de envio de `Snapshot` usa `runtime.disconnect`: o membership lógico persiste para a política de retomada da Task 5, mas a conexão antiga perde autorização. `stop()` fecha a sala, remove vínculos e deixa os memberships ainda presentes.

## Isolamento e segurança

O adapter de teste usa `projectPrivate(state, playerId)` para produzir segredos distintos. Os testes verificam que frames enviados a A não contêm o segredo de B e vice-versa, inclusive em eventos após comando. Testes adicionais cobrem `playerId` falsificado, sala errada, peer desconhecido/desconectado, conexão antiga, deduplicação e conflito de `commandId`, resync de outro jogador, consumo concorrente do convite, falha de escrita, desconexão/fechamento durante admissão, `Snapshot` excessivo e ausência de token/segredo em `console.log`. O estado canônico do runtime nunca é enviado; apenas snapshots e projeções produzidos pelo runtime entram nos envelopes LAN.

## Tamanho das mensagens

Medição UTF-8/JSON do fixture representativo da Task 2: 16 jogadores, 32 barreiras, 2 KiB públicos e 512 bytes privados. `admitted`: **5.918 bytes**; `Snapshot`: **5.876 bytes**; `Event`: **5.890 bytes**; `CommandResult`: **131 bytes**. O limite permanece **16.384 bytes**. O teste recusa evento e snapshot de admissão excessivos. No Android, `LanWebSocketCodec` limita cada fragmento e `LanSocketServer` limita a soma remontada a 16 KiB; o envio nativo também usa esse teto. Fragmentação WebSocket não contorna o limite lógico, e o servidor atual envia um único frame por mensagem. A revisão futura do limite deve medir o `GameAdapter` real, estabelecer um teto lógico explícito com proteção de memória/negação de serviço e testar interoperabilidade de cliente/servidor antes de mudar o protocolo.

## Escopo ainda pendente

Os testes da Task 3 usam runtime real e bridge nativa simulada. Não constituem validação física Android ↔ Android de comandos, eventos ou resync; `LanRoomHost` ainda não é ativado por uma interface de sala nem incluído no bundle do APK. Falta a sessão convidada que implemente `RoomTransport`, aplique mensagens em `ClientReplica` e trate o resultado da admissão. O primeiro adapter real (Impostor da Palavra) deve medir projeções privadas concretas e resolver as regras de jogo em gate posterior. A falha de um adapter durante a projeção dentro de `runtime.join()` continua sujeita à semântica de exceção do core; o adapter mínimo testado é puro e não lança exceção. Não há retomada de credenciais nesta Task.

## Verificação executada

| Verificação | Resultado |
| --- | --- |
| TDD | Falha inicial por ausência de `lanRoomHost.ts`; falhas específicas reproduzidas para comando local durante admissão, sala divergente, membership local divergente e ingresso que ultrapassava uma delivery em andamento; testes passaram após correção. |
| Task 3, runtime e LAN | `lanRoomHost.test.ts`: 16 testes; suíte Vitest completa: 64 arquivos, **343 testes** aprovados com `--maxWorkers=2`. |
| Suíte Vitest padrão | Primeira execução concorrente com ESLint e Gradle teve 11 falhas de timeout em testes de UI; repetição isolada com dois workers passou integralmente. |
| TypeScript, ESLint e web | `npm run typecheck`, `npm run lint` e `npm run build` concluíram com código de saída zero. |
| Android JVM | `:app:testDebugUnitTest` concluiu com `BUILD SUCCESSFUL` (tarefas em cache). |
| Android Release | `:app:assembleRelease` concluiu com `BUILD SUCCESSFUL` (APK já atualizado, tarefas em cache). Não valida o novo coordenador em aparelho porque ele ainda não está ligado a uma sessão convidada/UI. |

## Recomendação de gate

A Task 4 pode ser planejada sobre os envelopes e o coordenador após revisão dos resultados de validação desta Task. Antes de aprovar uso em produção, exigir teste físico de envio/recebimento e resync em dois Androids, além de revisar a confirmação fim a fim de `admitted` e a política para falhas de projeção de adapters. Não avançar sem aprovação do gestor.
