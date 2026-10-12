# Galerows — fechamento técnico da Fase 4A e gate de Release LAN

Data: 11/10/2026. Branch: `feat/multiplayer-lan-4a`. Este documento fecha a **POC de transporte Android**, não aprova um APK LAN para distribuição nem inicia a integração de jogo. Evidência primária: [lan-4a-physical-test-evidence.md](lan-4a-physical-test-evidence.md). Requisitos de produto: [multiplayer-offline-first-requirements.md](multiplayer-offline-first-requirements.md).

## Decisão de fechamento da 4A

| Critério da POC | Estado | Base observada |
| --- | --- | --- |
| Dois Androids físicos reconhecidos e APK Debug instalado | Aprovado | S23 `RXCX705P3JR` e S25 FE `RXGL30N4F3F`, Android 16; `base.apk` de ambos com SHA-256 `852930944cbc218b28866ef24a271c4ead9a4c50ae8832d7268430bef1ff758a`. |
| WebView → Capacitor → plugin nativo → servidor WebSocket → LAN → WebView convidada | Aprovado | No hotspot `10.245.112.98:37677`, `native connected`, `pong` recebido no anfitrião e `ping` recebido no convidado. |
| Convite válido e inválido | Aprovado para o mecanismo da POC | `hello` válido gerou peer; token incorreto fechou o socket sem evento de ingresso. Ainda não há admissão de membro da sala. |
| Parada, desconexão e reconexão | Aprovado para o socket | Parada desconectou, novo peer ingressou, mensagens trafegaram após reconexão; encerramento forçado do anfitrião fechou o convidado. |
| Background e foreground | Aprovado no par testado | Mensagens enviadas enquanto um app estava em segundo plano apareceram após retorno. Não equivale a garantia de serviço em segundo plano prolongado. |
| Wi-Fi sem internet | Aprovado | Hotspot S23 (`swlan0`) ↔ S25 FE (`wlan0`), ping 2/2 em cada direção; sem rota WAN no anfitrião e destino externo inalcançável no convidado. A porta WebSocket não foi encaminhada por ADB. |
| Build e regressões | Aprovado para Debug | JDK 21, build web/Gradle, 15 testes JVM, 8 testes Vitest LAN e teste instrumentado de política cleartext com ciclo vermelho → verde. |

**Conclusão:** a comunicação WebSocket local Android ↔ Android é viável em Wi-Fi e hotspot sem internet. A 4A não provou Release, iOS, ingresso de `playerId`, autenticação resistente a interceptação, QR de sala, `RoomTransport`, `ClientReplica`, projeções privadas ou partida completa. Esses itens são gates posteriores.

## Estado concreto do código

- `LanSocketServer` aceita WebSocket e emite eventos por peer; `GalerowsLanServer` valida `roomId` e token no primeiro quadro. O token compartilhado é enviado no `hello` atual por `ws://` sem criptografia. O `peerId` é identificador de socket, não identidade de jogador.
- `LanClient.connect()` resolve quando o WebSocket abre, antes da decisão de autenticação do host; o fechamento posterior sinaliza rejeição. Falta confirmação positiva explícita de admissão.
- `lanWire.ts` já valida versão e tamanho dos quadros da POC, mas ainda não serializa respostas autoritativas (`CommandResult`, `Event`, `Snapshot`). O limite de 16 KiB precisa ser medido contra snapshots reais antes de ser contratado.
- `AuthoritativeRoomRuntime`, `RoomTransport` e `ClientReplica` já existem e foram exercitados pelo harness em memória da Fase 3. `runtime.join(connectionId)` cria `playerId`/snapshot; `reassociate(playerId, connectionId)` **não autentica por si só**. A autorização de ingresso e de retomada deve ocorrer antes dessas chamadas.
- A UI `LanDiagnosticScreen` só entra no build web com `VITE_LAN_DIAGNOSTICS=1`. O manifesto e a exceção de cleartext estão em `src/debug` e aceitam apenas o IP do hotspot daquela sessão.

## Riscos e decisão necessária para Release Android

| Risco | Consequência | Gate recomendado |
| --- | --- | --- |
| `https://localhost` → `ws://` | Mixed content bloqueado por padrão. `allowMixedContent=true` usa o modo `MIXED_CONTENT_ALWAYS_ALLOW` no Capacitor instalado, que amplia permissões da WebView. | Não promover a flag Debug. Provar um cliente LAN nativo com canal seguro em build de produção, mantendo a WebView em HTTPS e mixed content bloqueado. |
| Cleartext Android | Apps com target SDK ≥ 28 negam cleartext por padrão; a exceção Debug para `10.245.112.98` quebra quando DHCP/hotspot muda o IP. | Não copiar XML Debug nem liberar `base-config` global. Validar o destino dinâmico com transporte nativo seguro, manifesto Release e teste físico. |
| Token no `ws://` | Um observador na LAN pode ler/reutilizar o convite e as mensagens; a comparação constante no plugin não protege o canal. | Priorizar WSS nativo com certificado efêmero do anfitrião e pin/fingerprint transmitido pelo QR, mais token curto de ingresso; validar identidade do host antes de enviar credenciais. Revisar threat model antes de fixar o protocolo. |
| IP, porta e topologia variáveis | QR ou endereço copiado pode ficar obsoleto; hotspot pode isolar clientes ou encerrar ao sair do app. | Descobrir o endereço e a porta ativos, atualizar QR, manter entrada manual como fallback e testar hotspot/Wi-Fi em Release. Não gravar IP de sessão no código. |
| Identidade/replay | O token único da POC não diferencia jogadores; `playerId` em comando pode ser forjado se não houver associação de sessão. | Convite com validade/uso limitado; após ingresso, credencial privada de retomada por jogador, vinculada à sala e guardada localmente; host associa socket novo ao membership após prova da credencial. Rejeitar conexão antiga e replay. |
| Permissões futuras | Hoje `INTERNET` permite LAN no target 36. A política Android para acesso local evolui e pode exigir permissão específica ao elevar target SDK. | Testar permissões concedidas/negadas em versões alvo e reavaliar no upgrade do SDK, inclusive WebView, sockets de entrada e descoberta. |
| Estado privado e logs | Segredos do Impostor poderiam alcançar destinatários indevidos ou aparecer em Logcat/QR. | Testar projeções por `playerId`; QR só contém dados de ingresso, nunca papéis/palavras; redigir logs de token, credencial e estado privado. |

| Alternativa de Release | Benefício | Custo/decisão |
| --- | --- | --- |
| **WSS nativo com certificado efêmero e pin via QR — investigar primeiro** | Canal autenticado e cifrado sem liberar mixed content na WebView. | Implementar e testar servidor/cliente nativos, ciclo de certificado, pin, IP variável e futuro equivalente iOS. Ainda não validado. |
| Socket nativo com criptografia autenticada na aplicação | Pode contornar a dificuldade de certificado WSS. | Especificação criptográfica, revisão especializada e testes de replay/rotação tornam o risco maior; só considerar se WSS falhar. |
| WebView `ws://` com mixed content e cleartext amplos | Menor alteração na POC. | Rejeitado como caminho automático para Release: amplia a superfície de rede e mantém o convite exposto sem criptografia. |

O caminho **preferido para investigação** é o primeiro, não uma solução validada: exige prova em APK assinado semelhante ao Release, teste de renovação de certificado, IP dinâmico, falhas de pin e interoperabilidade futura com iOS. Qualquer troca de abordagem volta ao gate de aprovação.

Esta análise se apoia em [Capacitor: `allowMixedContent` não destinado a produção](https://next.capacitorjs.com/docs/next/config), [Android: modos de mixed content da WebView](https://developer.android.com/reference/android/webkit/WebSettings), [Android: Network Security Configuration](https://developer.android.com/privacy-and-security/security-config), [Android: política de cleartext](https://developer.android.com/reference/android/security/NetworkSecurityPolicy) e [Android: permissões de rede local](https://developer.android.com/privacy-and-security/local-network-permission). Os efeitos específicos no Galerows acima são inferências do código e dos testes físicos, não garantias das APIs.

## Arquitetura proposta para o próximo gate

1. **Sala no anfitrião.** Um coordenador de sala na WebView do host possui um `AuthoritativeRoomRuntime`. O plugin nativo possui sockets e entrega eventos por `peerId`. O coordenador cria `connectionId` efêmero, mantém `peerId ↔ connectionId`, autentica ingresso/retomada e só então chama `join` ou `reassociate`. O host também participa como membro lógico por um endpoint local, sem depender de conexão à própria LAN.
2. **Ingresso por QR.** Um convite versionado carrega `roomId`, endpoint LAN ativo (IP/porta), prazo, nonce/capacidade de ingresso de uso único e identidade criptográfica do host. Após cada admissão, o host renova o QR para o próximo convidado; convites simultâneos exigem capacidades distintas. O leitor valida formato, tamanho, prazo e destino antes de conectar. Código/endereço manual é fallback para QR indisponível; mudança de IP exige convite atualizado. O QR não contém `playerId`, credencial de retomada, palavras ou papéis.
3. **Identidade.** O host cria `playerId` ao admitir o participante; nome visível é atributo de apresentação, não identidade ou autorização. Após admissão, o anfitrião emite uma credencial de retomada individual, rotativa/expirável, armazenada localmente no celular convidado. Essa credencial nunca é compartilhada no QR. O token de convite apenas autoriza solicitar ingresso e não autoriza comandos após o vínculo com uma sessão.
4. **Confirmação de admissão.** O transporte distingue socket aberto, canal seguro verificado e membro admitido. Uma resposta explícita de ingresso fornece `playerId` e `Snapshot` autorizado. Falha de convite ou versão retorna erro fechado sem inicializar `ClientReplica`.
5. **Comandos e projeções.** O convidado implementa `RoomTransport<TPublic,TPrivate>` existente; envia `Command`/`ResyncRequest`. O host passa comandos ao runtime usando o `connectionId` autenticado e roteia `CommandResult`, `Event` e `Snapshot` apenas ao destinatário da projeção. A UI observa `ClientReplica`; não recebe estado canônico do host.
6. **Reconexão.** Queda de socket preserva membership; novo socket e nova `connectionId` exigem prova de retomada. A antiga conexão perde autorização. O cliente solicita snapshot usando `lastAppliedRevision`, reaplica intents apenas com `commandId` estável e deixa o runtime deduplicar. Se o host encerrou ou perdeu estado, a sala fecha com erro explícito; não haverá migração automática de host na V1.

## Critérios para aprovar a integração do núcleo, antes de qualquer jogo

- Build de produção equivalente, sem diagnóstico, `allowMixedContent` ou exceção Debug, conecta dois Androids por Wi-Fi e hotspot sem WAN; falha de verificação do host/certificado impede envio do convite.
- Ingresso por QR válido, expirado, adulterado e reutilizado; identidade de jogador atribuída pelo host; nenhum `playerId` é aceito somente por alegação do cliente.
- `RoomTransport` LAN passa a mesma suíte de contrato do harness em memória: `CommandResult` independente de `Event`, revision monotônica, duplicata, reorder, gap, resync, idempotência e projeções pública/privada por membro.
- Desconexão/reconexão conserva `playerId`, gira `connectionId`, rejeita socket antigo e entrega `Snapshot` autorizado. Falha do host encerra a sala com estado/erro claro.
- IP e porta são obtidos em tempo de execução; QR atualizado ao mudar endpoint; não há IP fixo, token fixo ou segredo em logs/QR de retomada.
- Testes físicos em dois Androids com Wi-Fi sem WAN e hotspot, logs/manifestos Release inspecionados; permissão de rede local negada/concedida quando exigida pelo target/plataforma. iOS é gate físico separado antes de prometer suporte multiplataforma.
- Jogos solo atuais continuam funcionais. O primeiro `GameAdapter` real será **Impostor da Palavra**, depois **Adedonha**. A regra da fila de impostores e a projeção privada devem ser aprovadas antes de iniciar esse adapter.

## Decisão solicitada ao gestor

Aprovar ou ajustar o desenho de identidade, QR, reconexão e a investigação de WSS nativo como primeiro gate de Release. A aprovação deste documento autoriza **planejar/executar uma integração posterior**, não inicia Impostor, Adedonha, backend ou publicação nesta execução. A sequência TDD proposta está em [plano de integração](superpowers/plans/2026-10-11-lan-core-integration.md).
