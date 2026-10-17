# Handoff Codex — Galerows: entradas de jogo por modo (17/10/2026)

## Contexto obrigatório

Trabalhe EXCLUSIVAMENTE no worktree `/Users/renanxavier/Documents/GitHub/galerows-game-entries-codex`, branch `feat/game-mode-entries-codex-01`. O Remote Desktop Commander criou esta branch a partir do commit de integração aprovado. Confira `git status`, branch, HEAD e worktrees ANTES de editar; se divergirem, pare e reporte. Utilize as skills Superpowers disponíveis (brainstorming já aprovado, TDD, verificação, Git). **Não executar merge, push, deploy ou alterar main**. Preserve todos os demais worktrees e suas alterações locais.

Leia `docs/superpowers/specs/2026-10-17-galerows-mode-ux.md`, `docs/superpowers/plans/2026-10-17-game-modes-parallel-ux.md`, `docs/brand/identidade-visual.md` e `src/features/games/gameModes.registry.ts`. O redesign game-style da home já está commitado. Não altere a home principal: o único atalho de grupo é **Minha Galera**.

## Seu escopo: componente e três entradas de jogo

Crie uma experiência **unificada e mobile-game**, adequada ao Galerows presencial, usando um componente de modo reutilizável para:

- `src/features/cidade-dorme/CidadeDormeHomeScreen.tsx`
- `src/features/impostor-da-palavra/ImpostorDaPalavraHomeScreen.tsx`
- `src/features/pista-unica/PistaUnicaHomeScreen.tsx`
- Novo componente em `src/features/games/`, CSS dedicado e testes.
- Você pode adaptar/remover `src/features/impostor-da-palavra/ImpostorModeEntry.tsx` **somente se** os testes atuais forem preservados e atualizados.

Requisitos funcionais:
1. Mostrar logo/identidade e nome/objetivo do jogo; decisão inicial clara **“1 celular”** vs **“Multiplayer local — Cada um no seu celular”**, com 1–2 frases curtas. Uma escolha única antes de configurar; sem repetir lobby.
2. Modo um celular: preservar store, resumir/desfazer apenas via fluxos existentes; navegar para setup, play ou result conforme sessão atual. Não exigir sala, conexão ou cadastro de todos os participantes. “Minha Galera” salva nomes usados no modo local.
3. Multiplayer disponível apenas com `VITE_GAMES_FIRST_LAN_ENTRY === '1'`, `VITE_LAN_PERSISTENT_LOBBY_UI === '1'` e `lanNativeMvpAvailable()`. Sem iOS LAN nesta entrega. Na web/iOS, explicar brevemente a indisponibilidade sem oferecer um botão que leve a rota inexistente.
4. Em Android LAN, ações **Criar sala** -> `/__lan-lobby-v2/criar?game=cidade-dorme` (ou o ID do jogo atual), **Entrar em sala** -> `/__lan-lobby-v2/entrar`. O host selecionará as regras apenas uma vez; a rota LAN já lê e valida `?game=` e seleciona apenas em sala NOVA. Convidado não força o jogo do host.
5. Se `useRoomSessionOptional()` indicar Room ativa, mostrar “Voltar à sala” -> `/__lan-lobby-v2`, não criar/substituir Room. Não tocar nos contratos da Room nem fazer limpeza de credenciais.
6. Preservar botões “Como jogar”, favoritos, informação de jogadores, retomada local e áreas de segurança; padronizar apenas a hierarquia/aparência da entrada do jogo. Paleta oficial `#101014`, `#D2F86A`, `#B8A0FF`, `#F5F3EF`; acentos temáticos por jogo.
7. Mobile-first 320/375/430, leitura rápida, acessibilidade de botões, testes unitários por jogo e regressão dos caminhos local e LAN. Sem dependências novas, sem efeitos de rede e sem alterar a interface de partida nessa etapa.

**Arquivos proibidos (dono: Remote Desktop Commander):** `HubHeader.tsx`, `HubScreen.tsx`, `GameCard.tsx`, `hub.css`, `PlayersScreen.tsx`, `HomeRoomActions.tsx`, `LanPersistentLobbyScreen.tsx`, `LobbyRoomView.tsx`, `RoomSessionProvider.tsx`, todos os adapters/reducers LAN, migrations/native, e `src/app/routes.tsx`.

## Gates de entrega

1. RED→GREEN dos testes de entrada 1-celular e LAN nos três jogos, incluindo web/iOS indisponível.
2. `npm test`, `npm run typecheck`, `npm run lint`, build padrão e (sem cap sync) `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`, `git diff --check`.
3. Commits **somente locais** dos arquivos do seu escopo, com mensagem descritiva; reporte hashes, arquivos, testes e limitações. Não fazer merge/cherry-pick para branch de integração: isso será realizado em revisão conjunta posterior.
4. Não declarar gate físico/Room real validado, nem publicação iOS/Android.

Se algum contrato obrigatório não puder ser cumprido sem tocar em arquivo proibido, reporte a dependência em vez de quebrar isolamento.
