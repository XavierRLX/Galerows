# Galerows — refatoração UX LAN

Implementação no checkout `feat/ux-hub-header-brand`, baseline `8ec6a016fe14e7cb41bfef6b9326f1efb207d02a`, em 13/10/2026. Pronta para revisão de código e interface; homologação física completa ainda pendente conforme limites abaixo.

## Fluxo anterior e atual

| Antes | Agora |
| --- | --- |
| Minha Galera → Criar → menu Criar/Entrar → criar | Minha Galera → Criar sala → criação automática → lobby |
| Entrada centrada em código, convite completo e verificação manual | Entrada inicia descoberta automaticamente e destaca salas disponíveis |
| Código sempre visível | “Não encontrou a sala? Usar código” revela o campo na mesma tela |
| QR preenche formulário, exige confirmação digitada | QR presencial validado inicia admissão automaticamente |
| Logos, títulos promocionais, revisão técnica e convite dominam a tela | Header com voltar; sala/conexão → jogadores → jogo/regras → prontidão |
| Placar antes dos controles, jogos sintéticos no catálogo comum | Controles dos três jogos reais; placar e campeões preservados |

## Mudanças e decisões

- Criação automática só na rota `/__lan-lobby-v2/criar`, uma vez por montagem, com trava contra operações simultâneas e contra criação de segundo host em sessão ativa. Erro permite repetir; encerrar não recria outra sala automaticamente.
- A seção multiplayer de Minha Galera usa roxo/azul profundo, lilás e verde-lima. Cadastro, edição, remoção e ordenação de jogadores continuam no componente original, sem mudanças de lógica.
- “Opções de rede” é secundário e também está disponível antes de criar, em Minha Galera. Isso permite escolher hotspot quando Wi-Fi e hotspot coexistem, sem uma etapa obrigatória adicional.
- Header sem marca grande e sem slogan. Voltar vai a `/players`; “Ver jogos” continua disponível no lobby. O provider permanece acima das rotas; navegar não chama `leave` nem `stop`.
- Scanner e confirmação de saída consomem Android back por evento cancelável; o comportamento normal de histórico/saída do app permanece quando não há modal. Foco inicial, Escape, contenção de Tab e retorno ao acionador foram cobertos.
- “Convidar amigos” concentra QR e seis dígitos em área recolhível. Convite completo, IP e verificador técnico não são renderizados. A sala recebe uma identificação curta consistente entre anúncio e lobby.
- Participantes exibem avatar, anfitrião, pronto e desconectado. Apenas os três jogos reais são oferecidos no catálogo comum. Motores sintéticos permanecem internos aos testes/contratos existentes.
- Configuração fica em “Regras do jogo”, recolhida após salvar; regras públicas ficam legíveis para os convidados. O formulário do host recupera a configuração salva quando ele retorna ao lobby.
- Iniciar continua condicionado às regras, conexão, prontidão e mínimos existentes: 3 para Impostor/Pista Única e 4 para Cidade Dorme. Instrução do botão desabilitado explica a condição pendente.
- Placar acumulado, resultados, retorno ao mesmo lobby, tela de campeões e comandos privados continuam nos componentes e contratos existentes.
- Convidado desconectado precisa reconectar para confirmar saída: mantido o contrato de revogação autenticada, com mensagem explícita. Não há falso sucesso de abandono.
- Animação discreta de loading, desativada por `prefers-reduced-motion`; alvos principais de 44–48 px, rótulos e estados acessíveis.

## QR e segurança

`joinScannedInvite(raw)` é chamado somente pela leitura do scanner na interface comum. Primeiro passa por `decodePersistentLanInvite`; convite inválido, incompatível ou vencido não chega ao transporte. O fingerprint e a capability do QR presencial seguem para o mesmo cliente WSS e o mesmo `LanPersistentGuestAdmission`. A comparação do verificador interno é derivada desse fingerprint óptico confiável, dispensando digitação, conforme autorização explícita do briefing.

Não foram alterados os transportes nativos, o pinning, a emissão/revogação/expiração de capabilities, o armazenamento das credenciais de retomada, o ACK de admissão nem a autorização do host. Mismatch de certificado, convite revogado e sala fechada continuam falhando. `inFlight` e `roomRef` impedem leituras/admissões duplicadas. A câmera para na leitura, no fechamento e no unmount; respostas tardias de permissão também liberam tracks.

O caminho já existente de descoberta/código continua com sua garantia G4-lite: a primeira identidade vem do anúncio local, não de uma fonte independente. Não passou a ter a mesma garantia de autenticidade do QR presencial. A interface orienta preferir QR em redes compartilhadas.

Seis dígitos continuam sendo um identificador público de anúncios resolvidos, não uma senha nem um lookup universal. Sem mDNS/NSD não existe endpoint suficiente no contrato atual; acrescentar broadcast, varredura ou serviço resolver seria mudança de protocolo e de superfície de segurança, fora desta refatoração. A UI informa corretamente que o código não apareceu e oferece QR. QR dispensa descoberta, mas ainda requer conectividade IP entre os aparelhos.

## Arquivos de implementação

- `src/app/routes.tsx`: modo direto de criação.
- `src/app/useNativeAppSetup.ts`: evento cancelável para Android back em modais.
- `src/features/hub/HomeRoomActions.tsx`: seção multiplayer de Minha Galera, sala ativa e opção de hotspot.
- `src/features/multiplayer/lan/LanQrScanner.tsx`: ciclo da câmera, fechamento, estados e acessibilidade.
- `src/features/multiplayer/lan/lobby/LanPersistentLobbyScreen.tsx`: criação direta, descoberta, QR automático e header.
- `src/features/multiplayer/lan/lobby/LanRoomDiscoveryList.tsx`: descoberta prioritária, refresh, código sob demanda, erro e recuperação.
- `src/features/multiplayer/lan/lobby/LanScreenHeader.tsx`: novo header compartilhado.
- `src/features/multiplayer/lan/lobby/LobbyRoomView.tsx`: hierarquia e controles do lobby, convite secundário, regras e confirmação.
- `src/features/multiplayer/lan/lobby/LobbyRulesSummary.tsx`: apresentação dos campos públicos de configuração, sem serializar snapshots.
- `src/features/multiplayer/lan/lobby/RoomSessionProvider.tsx`: ingresso específico por QR e proteção contra segundo host.
- `src/features/multiplayer/lan/lobby/roomSessionErrors.ts`: mensagens sem orientação obsoleta de colar convite ou digitar verificador.
- `src/features/multiplayer/lan/lobby/lobby.css`: layout mobile/desktop e identidade visual, removendo estilos das estruturas antigas.

`PlayersScreen.tsx`, os três motores multiplayer, o protocolo, o código Android e o encoder de QR foram auditados e preservados. O QR continua em 512 px, correção M e quiet zone 4.

## Testes

Novos testes: `useNativeAppSetup.test.tsx`, `LanQrScanner.lifecycle.test.tsx`, `LanEntryFlow.test.tsx`, `LanRoomDiscoveryList.test.tsx`, `RoomSessionProvider.scanned.test.tsx`, `roomSessionErrors.scanned.test.ts`.

Atualizados: `HomeRoomActions.test.tsx`, `LanQrScanner.test.tsx`, `LanPersistentLobbyScreen.test.tsx`, `LobbyRoomView.test.tsx`, `RoomSessionProvider.test.tsx`, `RoomSessionGuestNavigation.test.tsx`. Expectativas de campos/logos removidos foram trocadas por comportamentos novos; testes de transporte e segurança existentes foram mantidos.

TDD registrado: 6 falhas esperadas de entrada/descoberta antes da implementação; 3 falhas esperadas de apresentação do lobby; 9 falhas esperadas para API QR/trava de host; 7 falhas esperadas de scanner e 2 de mensagens. Depois, cobertura passa para criação única/StrictMode, recriação explícita, back sem saída, código parcial/inexistente/válido com zero inicial, anúncios malformados, rotação do QR, confirmação, regras persistidas, privacidade e reconexão.

| Verificação executada | Resultado |
| --- | --- |
| `npm test` | **114 arquivos, 689 testes passando** |
| `npm run typecheck` | Passou |
| `npm run lint` | Passou |
| `npm run build` | Passou, incluindo testes de conteúdo |
| `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build -- --outDir /tmp/galerows-ux-review/dist-experimental` | Passou |
| Inspeção do bundle padrão | Sem chunks/marcadores `LanPersistentLobbyScreen`, `GalerowsRoomDiscovery`, `galerows-lan-v2`, `joinScannedInvite` |
| Inspeção experimental | Chunk JS/CSS do lobby presente; gate Android preservado |
| `git diff --check` | Passou |
| Revisão independente | Dois P2 identificados e corrigidos (hotspot e saída desconectada); re-review sem pendências, 29 testes direcionados passaram |

Logs completos da execução estão em `/tmp/galerows-ux-review/`.

## Revisão visual

Larguras: **320, 360, 375, 384, 430, 768 e 1280 px**. Primeira matriz: 56 capturas do app real via WebView (Minha Galera, lobby, convite, descoberta, código, convidado, host/convidado configurados), sem overflow horizontal medido.

As 14 imagens finais desta pasta usam o DOM real capturado de telas nativas e os mesmos estilos/fontes, renderizados em Chrome para evitar artefatos de captura da superfície Android quando a largura emulada excede a tela física. São registros de revisão visual, não outra implementação nem produto de protótipo. `layout-final.json` contém as medidas. O scanner, as interações e a conexão foram testados separadamente.

Prévias: [entrada 375 px](entrada-375.png), [lobby 375 px](lobby-375.png), [lobby desktop](lobby-1280.png). A pasta contém ambas as telas em todas as larguras.

## Laboratório e limites reais

- Vite existente na porta 4182 foi reutilizado. Nenhum APK foi instalado/reinstalado, nenhum dado foi apagado e nenhuma versão estável foi substituída.
- ADB encontrou S23, Moto G6 e emulador; o SM-S731B não estava disponível.
- **Executado:** S23 criou sala por uma ação desde Minha Galera; Moto G6 descobriu por NSD e entrou tocando na lista; ambos exibiram dois participantes. Back para Minha Galera e retorno preservaram a sala e os dois participantes. Seleção de Pista Única e regras salvas sincronizaram no convidado.
- **QR parcial:** uma imagem real do QR foi fornecida ao scanner do emulador como stream de câmera de teste. O jsQR real leu, a câmera fechou e a admissão nativa iniciou automaticamente. A conexão ao anfitrião Moto G6 terminou com erro de conectividade exibido corretamente. Não foi ingresso nativo bem-sucedido por QR, nem leitura óptica com lente física.
- **Não homologado nesta sessão:** leitura presencial com câmeras físicas, ingresso QR nativo completo, rodada física completa de cada um dos três jogos, Cidade Dorme com quatro aparelhos, ciclo completo de hotspot, back pelo botão físico e permissão de câmera do Android. Essas fronteiras têm cobertura automatizada, mas isso não substitui o gate físico.
- Mudanças JS/HMR reiniciaram salas efêmeras durante a edição, como previsto na documentação do laboratório. Não é evidência de persistência após morte do runtime. As verificações de navegação sem reload acima foram executadas separadamente.
- Vite permanece disponível para a revisão ao vivo; overrides de câmera e tamanho usados na verificação foram removidos. Os dois forwards ADB físicos e o forward do emulador foram usados apenas para inspeção do app `lanlive`.

## Git e trabalho preexistente

Branch permanece `feat/ux-hub-header-brand`; HEAD permanece `8ec6a01`; `main` continua em `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`. Sem commit, push, merge ou deploy.

Hashes antes/depois confirmaram preservação integral de `HubHeader.tsx`, `routes.test.tsx`, `HubHeader.brand.test.tsx`, `galerows-wordmark.svg` e `2026-10-13-lan-live-ui-lab.md`. Não houve reset nem stash.

Decisões de processo: executar o desenho já autorizado no briefing, sem reabrir aprovação de plano; omitir commits exigidos genericamente pelas skills porque o usuário os proibiu; delegar a unidade QR e a revisão conforme Superpowers, mantendo a integração da UI no agente principal. O custo de revisão dessas decisões é reavaliar o fluxo proposto neste diff local, que permanece reversível e sem publicação.
