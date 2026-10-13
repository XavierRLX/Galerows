# Galerows G5D — organização da entrada LAN em Minha Galera

Data: 12/10/2026. Decisão solicitada pelo usuário: retirar o bloco grande "Rede Local / Jogar com a galera" da tela inicial e concentrar "Criar sala" / "Entrar em sala" no destino do ícone de pessoas do header (Minha Galera), junto à gestão do grupo. Preservar o catálogo solo e a Room ativa.

## Alterações
- `src/features/hub/HubScreen.tsx`: remove HomeRoomActions do topo da home e os imports/flags correspondentes. Home volta a focar logo/ícones/catálogo de jogos, sem CTA de criar/entrar na home.
- `src/features/players/PlayersScreen.tsx`: disponibiliza `HomeRoomActions` dentro da tela "Minha Galera", imediatamente sob o título "Seu grupo de jogadores", mantendo campos de nome, gerenciamento de membros e ranking. Importação lazy e gating estrito por `VITE_GAMES_FIRST_LAN_ENTRY=1`, `VITE_LAN_PERSISTENT_LOBBY_UI=1` e `Capacitor.isNativePlatform()`.
- `src/features/hub/HomeRoomActions.tsx`: compacto, com título "Jogar em rede local", mensagem curta e botões "Entrar em sala" / "Criar sala". Se houver Room persistente ativa, substitui os botões por cartão enxuto de estado e "Voltar à sala"; em desconexão, indica que reconexão deve ser feita nessa Room. Não cria sala automaticamente e mantém rotas preexistentes `/__lan-lobby-v2/entrar`, `/__lan-lobby-v2/criar` e `/__lan-lobby-v2`.
- `src/features/impostor-da-palavra/ImpostorDaPalavraHomeScreen.tsx`: remove atalho experimental de criação/entrada LAN que contornava "Minha Galera". Jogo solo inalterado.
- `src/features/hub/HubHeader.tsx`: **sem alteração**. O botão com ícone de pessoas "Minha Galera" já levava para `/players`; esse fluxo foi reaproveitado.
- `HomeRoomActions.test.tsx`: expectativas ajustadas para o copy e a estrutura do componente realocado.
- NOVO `src/features/players/PlayersScreen.lan-entry.test.tsx`: simula a build nativa opt-in e valida navegação completa desde o ícone do header até a criação e entrada na Room, além da ausência de bloco LAN na home e preservação do cadastro de jogadores.

## Evidência RED/GREEN
- Testes novos falharam inicialmente (2/2) porque a tela Minha Galera não continha opções LAN.
- Após adicionar UI/rotas e adequar teste a Suspense.lazy, os dois passaram.
- Testes focalizados `PlayersScreen.lan-entry` e `HomeRoomActions`: 5/5 PASS.

## Gate final
- `npm test`: **601/601 PASS, 98 arquivos**. Log `/tmp/galerows-g5d-full-tests.log`.
- `npm run typecheck`: PASS. `/tmp/galerows-g5d-typecheck.log`.
- `npm run lint`: PASS. `/tmp/galerows-g5d-lint.log`.
- `npm run build` padrão: PASS; varredura do bundle `dist/assets` e assets Android padrão sem rotas/componente de grupo LAN experimental: PASS. `/tmp/galerows-g5d-build-standard.log`.
- Build Vite experimental com as duas flags: PASS; strings de controle de grupo LAN incluídas. `/tmp/galerows-g5d-build-experimental.log`.
- `git diff --check`: PASS.
- Branch `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`, `main` `fbfb342` preservados; alterações anteriores G0–G5B e arquivos untracked mantidos.
- Sem commit, push, merge, deploy, nova dependência, nova instalação/APK, teste físico em celulares ou WSS LAN real. A captura anterior do dispositivo pode estar desatualizada. G5C permanece bloqueado por homologação física.

**Status:** G5D UI/CODE/GATE AUTOMATIZADO PASS; APP NATIVO EM DISPOSITIVO AINDA NÃO ATUALIZADO/VALIDADO.
