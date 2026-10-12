# Task 2 — convite e protocolo de ingresso LAN

Data: 11/10/2026. Branch: `feat/multiplayer-lan-task1-wss`. Sem commit. Escopo restrito à Task 2; a autoridade real do `AuthoritativeRoomRuntime` permanece para a Task 3.

## Contratos implementados

- `galerows-lan-v1:` seguido de JSON em Base64URL, no máximo 1024 bytes. Campos obrigatórios, sem campos extras: `version=1`, `roomId`, IPv4 LAN dinâmico, `port`, fingerprint SHA-256 do certificado TLS, `issuedAt`, `expiresAt` e capacidade aleatória de 256 bits gerada por `crypto.getRandomValues`. Validade de 120 segundos; o parser rejeita versões incompatíveis, formato/endpoint inválido, campos extras, tamanhos excessivos e expiração. Apenas intervalos IPv4 privados, CGNAT e link-local são aceitos neste contrato; IPv6 fica para revisão posterior.
- O `hello` do transporte nativo leva a capacidade **depois** do handshake TLS pinado; seu aceite significa somente socket autenticado para a sala. O novo `joinRequest` repete o convite integral pelo WSS. O anfitrião o compara com a cópia emitida, verifica prazo, limita a três falhas por convite e reserva a capacidade sincronicamente antes de aguardar o coordenador. Segunda solicitação, inclusive simultânea, recebe `rejected/invite_used`.
- Respostas versionadas: `admitted {playerId, snapshot}` e `rejected {error}`. Erros tipados incluem convite inválido, expirado, usado, excesso de tentativas, protocolo incompatível, sala fechada e recusa do coordenador. A capacidade é consumida mesmo se o coordenador recusar ou se a resposta não chegar. Após consumo, o anfitrião gira o token de novos sockets sem interromper peers existentes e emite novo convite. `refreshInvite(hostIp)` também cobre expiração programada e mudança de endereço.
- O convidado tem estados separados `idle`, `socket_connected`, `tls_verified`, `ingress_requested`, `admitted` e `rejected`. `socket_connected` é emitido pelo Android antes do TLS; só o retorno bem-sucedido do `connect` nativo permite `tls_verified`. Nenhum `joinRequest` é enviado até a confirmação presencial. Abrir WebSocket ou passar TLS não define `playerId` nem inicializa `ClientReplica`.
- O código de comparação tem 12 dígitos hexadecimais públicos (48 bits), agrupados em `XXXX-XXXX-XXXX`, derivados do fingerprint do certificado de sessão. O anfitrião o obtém do certificado que criou; o convidado só o apresenta depois que o Android verificou efetivamente esse fingerprint no handshake. A pessoa deve ler o código **na tela do anfitrião** e digitá-lo no convidado; divergência encerra a tentativa. Nome visível de jogador não participa da verificação.

## Integridade e limites da segurança

O QR não tem assinatura própria nesta Task. Alterações pontuais em seus campos são detectadas por validação local, pin TLS e comparação integral do `joinRequest` com o convite emitido no host; uma alteração sintaticamente válida pode passar pelo parser offline, mas não pela admissão do anfitrião original. A substituição **integral** do QR por outro host troca também endpoint e pin: a defesa prevista é a comparação presencial do código com o aparelho anfitrião pretendido. O código não prova sozinho a identidade social de quem segura o aparelho; a verificação precisa ocorrer fora do QR e em um ambiente em que a tela do anfitrião seja confiável.

O limite de quadro continua 16 KiB no WebView e no socket nativo. O teste de contrato serializou um snapshot genérico representativo com 16 jogadores, 32 barreiras, 2 KiB de estado público e 512 bytes privados dentro desse limite; um payload maior é recusado. O tamanho do snapshot real do primeiro `GameAdapter` **não foi medido** nesta Task e deve ser resolvido antes de a Task 3 produzir admissão real, sem descartar membership após um erro de envio.

O certificado da Task 1 vence em 24 horas. Política proposta: encerrar ou reiniciar o servidor antes do vencimento, gerar novo certificado e invalidar todos os convites anteriores; convidados devem reconectar e obter novo pin por convite. Rotação automática de certificado não foi implementada. O convite dura 120 segundos; sem UI/serviço de sala nesta Task, o futuro chamador deve renovar `refreshInvite` antes do vencimento ou ao mudar o IP. Três erros globais podem bloquear um convite legítimo, uma troca deliberada entre contenção de tentativas e disponibilidade; o anfitrião pode emitir outro. Não há proteção contra negação de serviço no hotspot.

## Testes e builds

| Verificação | Resultado |
| --- | --- |
| TDD convite, wire, gate e sessão | Testes vermelhos foram observados antes das implementações; regressões para falha de entrega da resposta, encerramento do servidor após endpoint inválido e limite do texto Base64URL falharam antes das correções e passaram depois. |
| Android instrumentado, Galaxy S23 `RXCX705P3JR` | `LanSecureChannelTest` falhou inicialmente por ausência do evento `socket_connected` e passou após a mudança. `LanHelloAuthenticatorTest` validou token antigo rejeitado e novo aceito após rotação. Execução conjunta com política de rede `secureProbe`: `OK (4 tests)`. |
| JVM | `:app:testDebugUnitTest` passou: 16 testes, nenhuma falha. |
| Web | Execução final de `npm test`: 63 arquivos, 325 testes passaram; `npm run typecheck` e `npm run lint` concluíram com saída limpa. |
| Release | Build web sem flags Debug, `cap sync android` e `:app:assembleRelease` passaram. SHA-256 do APK: `70d7957e67cede9b9a2ef11d73ec71196cb741a1e219247dae2ff26f101bef54`; `allowMixedContent=false`, nenhum chunk `LAN Debug`, sem recurso de política Debug e manifesto Release sem `usesCleartextTraffic`/`networkSecurityConfig`. |

A Task 2 não cria sala em UI nem conecta o `AuthoritativeRoomRuntime`. Os testes usam um coordenador simulado que fornece `playerId` e `Snapshot` para validar a forma da resposta. A Task 3 deverá fornecer a decisão de admissão real, o vínculo `peerId`/`connectionId`/`playerId`, snapshot autorizado, rollback em falhas de envio e medição do payload real. Não há `RoomTransport`, `ClientReplica`, jogo, backend ou iOS novos nesta Task.
