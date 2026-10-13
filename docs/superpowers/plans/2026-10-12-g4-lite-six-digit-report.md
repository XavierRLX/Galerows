# Galerows G4-lite — Entrada por 6 dígitos (12/10/2026)

**Status:** implementação e compilação concluídas; **funcionamento real entre aparelhos ainda não homologado**. Usuário solicitou seguir o desenvolvimento e deixar os testes para depois. Este não é um gate de segurança/produção.

## Escopo aprovado pelo usuário
Objetivo explícito: amigos na mesma rede entram com código de seis dígitos sem copiar convites longos, sem senha extra nem confirmação de fingerprint. O usuário aceita uma garantia de acesso inicial **mais leve**. Esclarecimento de produto: estar no mesmo Wi-Fi não significa que apenas amigos terão acesso; outros dispositivos dessa rede podem detectar o anúncio, e anúncios mDNS podem ser falsificados por participantes da LAN. O código está publicado no anúncio e não se apresenta como segredo.

## Implementação
1. `lanShortRoomCode.ts`: código CSPRNG de 6 dígitos (preserva zeros à esquerda), validação/normalização e token de 64 caracteres `SHA-256("galerows-short-room-v1:<roomId>:<code>")`. Código é conveniência, não autenticação robusta.
2. `LanPersistentRoomHost.ts` + `LanNativeHost.ts`: após iniciar WSS v2, host define Room e gera token de código, registrando-o no native através de `setRoomCodeToken`. Na admissão aceita **QR original estrito** ou **convite local curto** contendo token derivado e endpoint/room/fingerprint corretos. A capability QR segue independente, com renovação sem invalidar o código curto. Room authority, limite de jogadores, ACK, snapshots individuais, credentials/rekey/resume continuam no contrato existente.
3. `LanHelloAuthenticator.java` + `LanServerPlugin.java`: segundo token somente para WSS v2, sem reduzir TLS, introduzir cleartext ou alterar o v1. Native compara bytes sem revelar token na rede DNS-SD. `setRoomCodeToken` valida versão, roomId e formatos; anúncio só depois de configurar credencial.
4. `LanRoomNsdPublisher.java`: DNS-SD `_galerows._tcp.` com atributos **públicos** `app`, `v`, `code`, `room` e `fp`; serviço aponta porta nativa do WSS. **Não publica** QR capability, token SHA derivado, resume token, chave privada ou conteúdo da partida. O fingerprint anunciado **não é vinculado independentemente** ao host original.
5. `LanRoomDiscoveryPlugin.java` + `lanRoomDiscovery.ts`: valida versão, code, roomId, fingerprint, endpoint IPv4 privado, limite de anúncio, e entrega locators somente para a tela experimental. Eventos lost invalidam anúncios.
6. `LanRoomDiscoveryList.tsx` + `LanPersistentLobbyScreen.tsx`: localizar salas automaticamente no Wi-Fi, digitar seis dígitos, filtrar sem remover zero inicial, exibir empate de códigos em lista e CTA Entrar. Pode também tocar em uma sala descoberta. Sem lista, fallback QR + convite manual original. Novo método `RoomSessionProvider.joinDiscoveredRoom()` conecta diretamente com o pin publicado no anúncio, deliberadamente sem verificação presencial adicional.
7. `LobbyRoomView.tsx` + CSS: mostrar código público grande ao anfitrião; verificação avançada por QR recolhida para não confundir os números. `HomeRoomActions.tsx` orienta sobre descoberta/código/QR. `src/test/setup.ts` prepara `crypto.subtle` de Node para **futuras execuções de Vitest em jsdom**, sem afetar produção.

## Segurança: trade-off consciente
- **Aceito apenas para rede de amigos:** o código e o fingerprint público podem ser observados por aparelhos na LAN; falsificação de mDNS e primeiro host impostor são possíveis. TLS protege a conexão com a identidade **anunciada**, não comprova quem apresentou o anúncio.
- **Preservado:** WSS/TLS, protocolo v2, autenticação de comandos baseada em membership, private projections, Keystore, resume, tempo máximo da sala, confirmação/rotate do QR legado, limites nativos de sockets.
- **Não implementado:** PIN privado forte, whitelist de dispositivos, pareamento autenticado inicial, criptografia adicional de TXT, bloqueio garantido contra usuários da mesma rede ou rate-limit global anti-flood por IP. Estes itens NÃO são requisitos de MVP desta decisão de UX, mas são riscos conhecidos.
- **Limite de rede:** dependência de mDNS e IPv4 local; isolamento entre clientes no roteador, multicast desabilitado, IP trocado ou mudança para outra rede podem impedir ingresso. QR é fallback viável apenas se houver alcance IP real.

## Compilação e evidências verificadas (nenhum teste funcional nesta fase)
- `npm run typecheck`: **PASS** após todas as alterações.
- `npm run lint`: **PASS**.
- `./gradlew :app:compileSecureProbeJavaWithJavac --offline`: **BUILD SUCCESSFUL** após correção de exceção verificada do TLS fingerprint.
- Build web padrão: **PASS**, guarda de assets confirma código G4 experimental ausente do bundle padrão.
- Build opt-in flags `VITE_GAMES_FIRST_LAN_ENTRY=1` / `VITE_LAN_PERSISTENT_LOBBY_UI=1`: **PASS**, módulo G4 presente na pasta temporária `/tmp/galerows-g4-lite-experimental`.
- `git diff --check`: **PASS**.
- **NÃO EXECUTADOS:** `npm test`, JUnit, Android instrumentado, APK no S23/S25 FE, descoberta mDNS real e WSS entre dispositivos. Os **577 testes do G2.2** são evidência **anterior à implementação G3/G4**, não resultado atual.

## Matriz para próximo gate de testes (adiados a pedido do usuário)
- Geração de códigos `000000`, zeros à esquerda, seis dígitos exatos e rejeição de entradas inválidas.
- Digest idêntico host/guest, contrato token nativo v2 e recusa em v1, roomId diferente, código errado, fingerprint alterado, QR original não regressa.
- Room encontrada / não encontrada / colisão de códigos / anúncio falso / perdido / concorrência de usuários / sala cheia / join simultâneo e convite QR vencido.
- TLS pin com anúncio falsificado (documentar vulnerabilidade de primeira confiança), resume com vault, WSS não interrompida ao navegar/ir para segundo plano, private-state isolation.
- Dispositivos físicos S23/S25 FE mesma Wi-Fi e hotspot, sem Internet, multicast bloqueado, rede alterada, 2-3 aparelhos, limpeza de recursos ao host encerrar. Teste visual em 320/375/430px.
- Necessário decidir depois se deve haver botão opcional de sala privada/convite com garantia mais forte (mantendo fluxo curto como padrão).

## Git e gates
Branch preservada: `feat/multiplayer-lan-task1-wss`, base `fd8cc5c`; `main` intocada; modificações preexistentes G0-G3 preservadas; **sem commit, push, merge, deploy, instalação ou alteração de produção**.

**G2:** teste físico pendente. **G3:** compilado, testes pendentes. **G4-lite:** implementado/compilado, testes físicos e funcionais pendentes. **G5:** não iniciado.
