# Task 5 — retomada autenticada e encerramento do anfitrião

Data: 11/10/2026. Branch obrigatória `feat/multiplayer-lan-task1-wss`, HEAD inicial `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`. A working tree já continha alterações e arquivos não rastreados das Tasks 1–4; foram preservados. Nenhum commit, merge ou push foi criado.

## Arquitetura implementada

O `LanRoomHost` emite uma credencial aleatória individual de 256 bits, vinculada a `roomId` e `playerId`, com validade de duas horas. O convite consumido não é reutilizado. A credencial é registrada no autenticador nativo antes de `admitted` e enviada somente pelo WSS com fingerprint pinado. Ela não aparece no convite, em projeções nem em logs. O Android a guarda como ciphertext AES-256-GCM em `SharedPreferences`, com chave não exportável do Android Keystore; endpoint e fingerprint ficam no mesmo registro criptografado.

Arquivos de Task 5: `lanRoomHost.ts` e teste, `lanRoomSession.ts` e teste, `lanRoomTransport.ts` e teste, `lanIngressClient.ts` e teste, `lanWire.ts`, `lanAdmission.ts`, bridges `lanNativeHost.ts`/`lanSecureNativeClient.ts`, `LanHelloAuthenticator.java`, `LanSocketServer.java`, `LanServerPlugin.java`, `LanSecureClientPlugin.java`, novo `LanResumeCredentialVault.java` e testes JVM correspondentes. O probe temporário `LanCoreProbeScreen.tsx` e seu teste ganharam controles de queda, retomada e parada; nenhuma UI definitiva de sala foi criada. O `AuthoritativeRoomRuntime` e o contrato `RoomTransport` não foram alterados para esta Task.

`connectResume(roomId)` carrega a credencial do cofre e abre um novo WSS pinado. O primeiro frame `resumeHello` é autenticado pelo servidor nativo contra a credencial daquele jogador, sem depender do token de convite rotacionado. O host TS confere novamente sala, membro lógico, token e prazo antes de chamar `runtime.reassociate(playerId, novaConnectionId)`. A conexão anterior perde o binding e o socket é fechado. O runtime existente fornece o `Snapshot` autorizado; o convidado aplica o snapshot na `ClientReplica` existente ou cria uma replica nova após reinício do processo. `commandId` permanece sob o contrato do runtime, preservando a deduplicação.

O host registra a credencial seguinte antes de responder `resumed`. Mantém a anterior até receber `resumeAck` pelo novo peer, depois a revoga. Se a resposta se perder, o cliente ainda pode usar a credencial antiga; uma nova tentativa reaproveita a credencial pendente. Se o cliente persistiu a credencial nova e perdeu o ACK, a tentativa com ela comprova que recebeu a resposta e promove a rotação. O servidor nativo mantém no máximo duas credenciais por jogador durante essa janela. Registro nativo falho fecha apenas o peer em retomada; falhas antes de `admitted` compensam o ingresso. `stop()` aguarda a admissão em andamento, envia `roomClosed` aos peers ativos, revoga credenciais e encerra sockets e memberships. O convidado apaga o cofre ao receber `roomClosed`; uma queda sem esse frame é `connection_lost` e preserva a credencial.

## TDD e segurança

Foram executados testes vermelhos antes de cada correção para emissão de credencial, reassociação, ACK/rotação, fechamento terminal, cofre do convidado, restauração de replica, corrida de `stop()` com registro nativo e falha de registro nativo. Os testes focados passaram após as correções. A retomada foi exercitada com credencial correta, ausente, expirada, de outro jogador e de outra sala; tentativas inválidas não criaram membership. Há testes de dois pedidos simultâneos, resposta de rotação perdida, revogação após ACK, replay antigo, peer antigo enviando comando e resync, e `commandId` repetido sem segunda mutação. O snapshot da retomada contém somente o privado do jogador autenticado; o outro convidado não recebe esse privado. A ponte nativa compara tokens em tempo constante e aplica o teto de 16 KiB por mensagem lógica, inclusive sobre fragmentos WebSocket. O limite não foi alterado.

## Verificação automatizada

| Verificação | Resultado |
| --- | --- |
| Vitest completo | 67 arquivos, 376 testes aprovados na verificação final. |
| TypeScript | `npm run typecheck` aprovado. |
| ESLint | `npm run lint` aprovado após correção de parâmetros não usados nas fixtures. |
| Web | `npm run build` aprovado. Build temporário `VITE_LAN_CORE_PROBE=1 npx vite build` usado apenas no diagnóstico; assets normais restaurados com `npx vite build` e `npx cap sync android`. |
| Android JVM | `:app:testSecureProbeUnitTest` aprovado: 22 testes, zero falhas. Inclui autenticação de retomada, sockets reais em JVM e validação do cofre; roundtrip Android Keystore não é executado por testes JVM locais. |
| Android APK | `:app:assembleRelease` e `:app:assembleSecureProbe` aprovados. SHA-256 Release: `c587b0ff718dcd4ac3f752f8dc5994d3112bf874a707cc946985c4bbd9411ea0`; secureProbe: `483eb33afdf9585bfe0ce3fbc1888f7578b562e3046bd63fae5201f5b4b1bfbf`. |

## Ensaio físico de dois Androids

O mesmo APK `secureProbe` acima foi instalado no Galaxy S23 `RXCX705P3JR` e no Galaxy S25 FE `RXGL30N4F3F`. O S23 hospedou em `swlan0` `10.245.112.98/24`; o S25 FE entrou por `wlan0` `10.245.112.245/24`. Em ambos, `ip -4 route` mostrou somente `10.245.112.0/24`, sem rota padrão/WAN. O DevTools via USB acionou o probe temporário `/__lan-core`; os frames multiplayer passaram pelo WSS nativo sobre o hotspot, sem encaminhamento ADB da porta da sala.

O S25 FE recebeu `admitted`, executou comando aceito, passou para segundo plano e voltou com a sessão preservada, derrubou o socket, executou `connectResume` usando o cofre nativo e recebeu `resumed` para o mesmo jogador. Um novo comando foi aceito após a retomada. Depois que o S23 encerrou o host, outra tentativa de retomada no convidado recebeu `resume_credential_not_found`, confirmando limpeza local após `roomClosed`. O probe usa somente adapter mínimo de contador; nenhum jogo foi integrado. Isolamento entre dois convidados físicos simultâneos não foi testado: essa propriedade está coberta pelos testes automatizados com bridge simulada.

## Limites e próximo gate

Um encerramento abrupto do processo/anfitrião sem entrega de `roomClosed` é visto como queda transitória até a tentativa de retomada falhar; não há migração automática. A credencial de duas horas não estende o certificado TLS de 24 horas nem muda endpoint/fingerprint se o host reiniciar. A rotação impede replay da credencial antiga após ACK, mas a posse de uma credencial válida roubada concede retomada durante sua validade; o cofre Android reduz exposição local e o WSS pinado protege a transmissão. O limite lógico de 16 KiB segue exigindo medição para qualquer adapter de jogo real. O probe físico não substitui validação de APK Release distribuível nem prova forense do Keystore.

Task 5 concluída para revisão. A Task 6 deve conectar sua UI mínima aos contratos existentes de `LanRoomHost` e `LanRoomSession`, exibindo separadamente perda transitória e fechamento definitivo. Não iniciar Task 6 sem aprovação.

## Micro-gate corretivo — confirmação do ingresso inicial

Após a revisão da Task 5, o ingresso inicial passou a usar confirmação em duas fases, sem alterar `AuthoritativeRoomRuntime`, WSS, pinning ou autenticação de retomada. `admitted` entrega snapshot, uma credencial candidata e um `admissionId` aleatório e efêmero de 256 bits, mas não publica o binding do peer. O convidado valida o envelope, persiste a credencial no cofre e envia `admissionAck { roomId, playerId, admissionId }`. Somente esse ACK, recebido pelo mesmo peer e vinculado ao identificador imprevisível, promove binding e credencial no host; o host responde `admissionConfirmed` com o mesmo identificador, e `connectInvite()` só expõe replica e transporte depois dessa resposta. ACK antecipado, forjado ou pertencente a outra tentativa é ignorado.

Falha do cofre não envia ACK e fecha o canal. Falha de envio ou perda do ACK, timeout de confirmação de 15 segundos e desconexão antes do ACK revogam a credencial, executam `runtime.leave` e entregam as revisões de entrada/saída aos membros já ativos antes de fechar o peer. `stop()` cancela o timer e compensa qualquer ingresso pendente antes de revogar o restante e encerrar o nativo. O convite continua consumido e não é reabilitado. Comandos e resync do peer pendente são ignorados.

Se `admissionConfirmed` se perder depois que o ACK chegou, o membership já tem uma credencial efetivamente persistida. A falha de escrita desconecta o binding, mas preserva membership e credencial para a retomada autenticada existente; assim, a incerteza da confirmação final não cria membro irretomável. O convidado também conserva a credencial persistida ao falhar aguardando a confirmação: ela retoma o membro se o host promoveu o ACK, ou é rejeitada depois da compensação se o host não o recebeu.

O ciclo TDD começou com falhas observadas no wire, na aceitação prematura de comandos, na falta de compensação ao desconectar e na ausência de ACK do cliente. Uma regressão adicional reproduziu o aceite indevido de ACK antecipado enquanto a escrita de `admitted` estava bloqueada. Depois da correção mínima, os testes LAN/core passaram com 14 arquivos e 159 testes. As regressões específicas cobrem falha de armazenamento, falha ao enviar ACK, ACK perdido/timeout, desconexão, perda de `admissionConfirmed`, ACK antecipado/forjado, comandos antes da confirmação e `stop()` durante confirmação.

Validação final em 11/10/2026: Vitest completo com 67 arquivos e 385 testes; TypeScript, ESLint, build Vite e `git diff --check` aprovados; `:app:testSecureProbeUnitTest` com 22 testes, `:app:assembleRelease` e `:app:assembleSecureProbe` aprovados após `cap copy android`. SHA-256: Release `c587b0ff718dcd4ac3f752f8dc5994d3112bf874a707cc946985c4bbd9411ea0`; secureProbe `9b7a2c6eb34f4821294967416c4b364df42212d093f8a5af6071d20c5187da8c`. Não houve novo ensaio físico neste micro-gate; o transporte WSS e o cofre nativo não foram modificados. Nenhum commit, merge ou push foi criado, e a Task 6 não foi iniciada.
