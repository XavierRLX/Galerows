# Impostor da Palavra — experiência mobile integrada

## Escopo

A partida LAN real passa a ocupar uma tela própria após o lobby, tanto no fluxo de voto individual quanto no fluxo legado. A interface consome o snapshot e dispara os comandos existentes. Não houve alteração no reducer do jogo, WSS, Room, persistentRoom ou protocolos.

Identidade visual escura, violeta e verde-lima, com radar, contagem inicial, revelação animada e transições de fase. O nome exibido é **Impostor da Palavra**. A tela usa a altura disponível do visualViewport e safe areas; participantes e pontos são paginados, sem rolagem. Animações respeitam prefers-reduced-motion.

## Fluxo

- Revelação privada: ACK_BRIEFING existente ao revelar, ocultação após 5 segundos, perda de foco, desconexão ou mudança de fase/sessão.
- Conversa: cena local separada após todos visualizarem; pergunta, primeiro participante e cronômetro vêm do estado autoritativo. O anfitrião abre a votação.
- Votação: seleção paginada, confirmação e espera; desempate preservado.
- Fluxo legado: pistas, discussão e acusação usam os comandos anteriores.
- Palpite: campo disponível somente para quem tem autorização no estado privado; o anfitrião pode encerrar sem palpite.
- Resultado: resumo e pontos em vistas alternáveis. O anfitrião registra a pontuação e pode iniciar nova rodada ou retornar todos ao lobby.
- Saída: confirmação também pelo botão voltar nativo; reconexão mantém a identidade oculta.

## Arquivos desta alteração

Alterados:
- `src/features/multiplayer/lan/lobby/ImpostorImmersiveRound.tsx`
- `src/features/multiplayer/lan/lobby/impostorImmersive.css`
- `src/features/multiplayer/lan/lobby/LobbyRoomView.tsx`
- `src/features/multiplayer/lan/lobby/ImpostorImmersiveRound.test.tsx`
- `src/app/routes.tsx`

Criados:
- `src/features/multiplayer/lan/lobby/ImpostorGameFlow.test.tsx`
- `src/features/multiplayer/lan/prototypes/ImpostorLivePreview.tsx`
- `src/features/multiplayer/lan/prototypes/impostorPreviewRoom.ts`
- Este relatório.

## Prévia

Com o Vite de desenvolvimento: `http://127.0.0.1:5173/__prototype/impostor-live`.

A rota usa o componente de produção e AuthoritativeRoomRuntimeV2 em memória, com participantes simulados. O botão **LAB · sem rede** permite simular os demais, trocar a perspectiva, desconectar e ensaiar o resultado. Ela não conecta celulares. O laboratório é exclusivo de DEV e seu texto não aparece nos assets do build de produção.

No multiplayer real, basta iniciar Impostor da Palavra pelo lobby existente; a integração está em LobbyRoomView. As rotas antigas do protótipo visual continuam disponíveis e não representam esta nova implementação.

## Verificação

- 77 testes passaram em 8 arquivos: fluxo novo, interface imersiva, UX final, LobbyRoomView, LanPersistentLobbyScreen, RoomSessionProvider, reducer e rotas.
- Os novos testes executam o runtime real em memória: revelação, cronômetro, voto, palpite, pontuação, replay, retorno ao lobby, fluxo legado, desconexão, botão voltar e foco do diálogo.
- TypeScript, ESLint dos arquivos envolvidos, build de produção e git diff --check passaram. O build também executou 26 testes de conteúdo.
- Navegador: revelação, conversa, votação paginada com 12 participantes, palpite e resultado. Conferidas telas de 390×844, 320×568, 390×640, 844×390 e palpite com altura reduzida a 380px para simular teclado. Resumo/placar sem overflow nas dimensões verificadas.
- Comparação SHA-256 com o início desta execução confirmou preservação dos arquivos anteriores fora do escopo, inclusive alterações locais de Cidade Dorme.

## Limites

Não foi realizada validação desta versão em celulares físicos conectados via LAN; a altura reduzida no navegador não substitui o teclado nativo. Nenhum APK foi instalado. Não foram feitos commit, push, merge ou deploy. Alterações permanecem na branch `feat/ux-hub-header-brand` para revisão.
