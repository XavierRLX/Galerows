# Task 4 — sessão convidada e RoomTransport LAN

Data: 11/10/2026. Branch: `feat/multiplayer-lan-task1-wss`. HEAD e baseline histórico: `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`. A working tree já continha alterações e arquivos não rastreados das Tasks 1–3; todos foram preservados. Nenhum commit, merge ou push foi criado.

## Pré-gate corretivo da Task 3

Testes determinísticos com `native.send` retido por promises reproduziram a inversão: duas operações locais consecutivas podiam entregar revision 4 antes da 3 ao mesmo peer, porque `joinLocal` e `processLocalCommand` disparavam `deliver` sem aguardar. Outro teste mostrou `stop()` alcançar o encerramento nativo com escrita local ainda pendente. Ambos falharam antes da correção e passaram após uma fila global de escritas seriais no `LanRoomHost`. A fila preserva a ordem por destinatário, aguarda as escritas pendentes antes de parar o nativo e tem teto de 64 mensagens. A fila de entrada também tem teto de 64. Antes de uma mutação local, o coordenador rejeita a operação se não houver capacidade de saída suficiente; excesso remoto desautoriza o peer. Não há fila ilimitada.

Teste adicional reproduziu `runtime.join()` deixando membership e revision parciais quando `projectPrivate` lançava exceção. O runtime agora remove apenas o membership recém-criado e restaura a revision dentro do próprio `join` antes de propagar a exceção. Nenhuma delivery saiu dessa chamada síncrona. A compensação **após** um `join` bem-sucedido continua sendo `leave` visível em revisões consecutivas, como definido na Task 3.

## Sessão convidada

`LanRoomSession.connectInvite` usa `LanIngressClient` para validar o convite, abrir o canal nativo WSS com fingerprint pinado, exigir código presencial e solicitar ingresso. Só após `admitted` com `playerId` presente no `Snapshot` da sala/protocolo corretos cria `ClientReplica` e `LanRoomTransport`. O `RoomTransport` implementa o contrato existente sem alterar assinaturas, encaminha `Command` e `ResyncRequest` pelo mesmo canal e valida protocolo, sala e `playerId` antes de enviar. Os frames autoritativos são filtrados por sala/protocolo. O `CommandResult` passa por `observeCommandResult`, sem avançar a revision; `Event` passa por `applyEvent`; `Snapshot` passa por `applySnapshot`. Um gap solicita exatamente um resync enquanto a replica aguarda snapshot, mantendo a semântica atual de `ClientReplica`.

O `LanIngressClient` guarda até 64 frames que chegam depois de `admitted` e antes da inscrição; o transporte também guarda até 64 mensagens antes do listener. A inscrição reproduz esses frames na ordem original. Overflow fecha o canal e bloqueia novos envios. Fechamento nativo desativa o transporte, remove listeners e rejeita comandos posteriores. Uma instância de sessão é de uso único; retomada de jogador fica para a Task 5.

## TDD e contratos

Foram observadas falhas vermelhas para: ausência dos módulos de sessão/transporte; frame imediatamente após `admitted` sem caminho de replay; envio após fechamento nativo; replay de fechamento síncrono durante construção do transporte; falta de limpeza automática no fechamento; overload do buffer de ingresso que ainda permitia `sendFrame`; fechamento durante o `connect()` nativo que depois marcava TLS como verificado. Cada caso passou após a correção correspondente. Os testes cobrem resultado antes do evento, duplicata, evento antigo, marker, gap/resync, snapshot autorizado, retry com `commandId` estável, rejeição, sala/protocolo/identidade falsificados, unsubscribe, desconexão e limites dos buffers. Os testes do anfitrião verificam projeções privadas diferentes e ausência do privado de um peer nos frames do outro. O probe físico usa adapter mínimo de contagem; não há regras de jogo real.

## Teste físico Android ↔ Android

`secureProbe` foi compilado com `VITE_LAN_CORE_PROBE=1`, instalado nos dois aparelhos a partir do mesmo arquivo e executado com a rota temporária `/__lan-core`: S23 `RXCX705P3JR` como anfitrião em `swlan0` `10.245.112.98/24`; S25 FE `RXGL30N4F3F` como convidado em `wlan0` `10.245.112.245/24`. Em ambos, `ip route` mostrou somente a rota local `10.245.112.0/24`, sem rota padrão. O teste controlou a UI WebView de cada aparelho pelo DevTools via USB; a comunicação multiplayer passou pelo WSS nativo sobre o hotspot, sem ADB forward da porta de jogo. O hash SHA-256 do arquivo APK usado nas duas instalações foi `cb7c590c13992b4bb02d15abe8bed6c2b57c80a84f55339fbefc0d7729f420a7`.

O S23 criou sala, convite, código presencial e membro local com projeção privada. O S25 FE confirmou o código, recebeu `admitted`, `playerId` e snapshot com tag privada diferente da do anfitrião. Um comando válido produziu `CommandResult` aceito e `Event`; um comando inválido produziu resultado rejeitado. Um gap sintético na replica foi detectado e a solicitação explícita de resync recebeu `Snapshot` autorizado pela mesma conexão. A automação de envio de resync por gap está coberta nos testes da sessão; o botão do probe envia a solicitação explicitamente após forçar o gap. O ensaio físico prova o caminho WebView → Capacitor → WSS nativo → hotspot → WSS nativo → Capacitor → WebView, mas não substitui o gate futuro de Release distribuível ou teste de dois convidados físicos simultâneos. A ausência de vazamento de privado entre **dois convidados** é comprovada por testes do host com bridge simulada, não pelo ensaio de dois aparelhos.

## Verificação final

| Verificação | Resultado |
| --- | --- |
| LAN Task 4 + Task 3 + runtime + ClientReplica + harness in-memory | 14 arquivos, 136 testes aprovados após a correção final. |
| Vitest completo | 67 arquivos, 362 testes aprovados com `--maxWorkers=2` após o último ajuste. |
| TypeScript e ESLint | Aprovados após o último ajuste. O primeiro ESLint apontou dois parâmetros de fixture não usados; corrigidos. |
| Web normal | `npm run build` aprovado; `npx cap sync android` restaurou os assets normais após o teste físico. Nenhum chunk ou texto `LAN Core Debug` ficou em `dist` ou nos assets Android. |
| Android JVM | `:app:testSecureProbeUnitTest` e `:app:testDebugUnitTest`: 16 testes cada, zero falhas. |
| Android APKs | `:app:assembleSecureProbe` e `:app:assembleRelease`: `BUILD SUCCESSFUL`. Release SHA-256: `a452b9065fc12e0f420bea99dc995d1db614560b41b094867f8e9a73f79019cf`. Manifesto Release sem `usesCleartextTraffic` ou `networkSecurityConfig`; `allowMixedContent=false`. |

## Limites e aprovação da Task 5

O limite lógico de 16 KiB permanece, com as medições e política registradas na evidência da Task 3. Um adapter real precisa de nova medição de snapshots e eventos antes de qualquer mudança desse teto. O `send` nativo confirma escrita no socket, não consumo do `admitted` pela aplicação remota; queda nesse intervalo resulta em desconexão lógica e exige o protocolo de retomada da Task 5. Também ficam pendentes testes físicos de queda/reconexão, background/foreground, expiração e rotação de credencial individual, invalidação da conexão antiga e fechamento definitivo do host. A Task 5 deve iniciar somente após aprovação explícita, com esses critérios e testes vermelhos de segurança definidos antes da implementação.
