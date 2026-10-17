# Galerows — integração de home, Minha Galera e entrada dos três jogos

**Data:** 17/10/2026
**Branch/worktree:** `feat/game-modes-ux-integration-01` — `galerows-mode-unification`

## Escopo incorporado

1. `236b300` — baseline funcional anterior, contendo a expansão do Cidade Dorme; homologação física em HOLD.
2. `cb5d336` — cherry-pick equivalente à home game-first do Astra, originalmente em `6448377` (`feat/ux-hub-header-brand`).
3. `3ae95c5` — Minha Galera em dois contextos: **1 celular** (nomes salvos) e **multiplayer local** (criar/entrar/retomar sala); remove Ranking apenas dos atalhos da home; passagem opcional do jogo desejado por `?game=` para seleção pelo host após criar Room nova.
4. `5143cb7` — cherry-pick do commit Codex `5b3fd52`, criando `GameModeEntry` e `GameEntryHero` consistentes em Cidade Dorme, Impostor da Palavra e Pista Única; mantém saves locais, regras, favoritos e estados de LAN/Room ativa; não repete logo nos três jogos.

## Revisão independente

- Inspecionados `git show --stat`, diff dos três jogos, novo componente, CSS e evidências `.superpowers/sdd/2026-10-17-codex-game-mode-entry-handoff/task-1-report.md`.
- Nove arquivos do Codex exclusivamente no escopo acordado. Nenhuma alteração feita por ele ao catálogo, Minha Galera, runtime LAN, rotas globais ou main.
- Contrato de segurança preservado: modo LAN somente com as duas flags experimentais e Android nativo; convidado não escolhe jogo do host; `?game=` aceito somente para três IDs registrados e apenas ao criar Room, sem substituir uma Room ativa.
- A revisão não encontrou bloqueadores de código para esta integração. Revisões de código do Codex relatadas sem apontamentos.
- **Não** houve novo teste visual/manual independente em aparelhos. O relato Codex menciona verificação de 320/375/430px, que permanece evidência recebida, não homologação física.

## Verificação independente na integração

Após cherry-pick do commit Codex `5b3fd52`, executados diretamente no worktree de integração:

- `npm test -- --reporter=default` — **149 arquivos; 927/927 testes PASS**, exit 0.
- `npm run typecheck` — **PASS**, exit 0.
- `npm run lint` — **PASS**, exit 0.
- `npm run build` (padrão) — **PASS**, exit 0.
- `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` — **PASS**, exit 0.
- `git diff --check HEAD~1 HEAD` — **PASS**, exit 0.
- Branch sem mudanças locais, exceto a criação deste relatório até seu commit.

## Decisões e pendências

- Home principal permanece com apenas **Minha Galera** como atalho de grupo; Ranking acessível em Minha Galera.
- Escolha 1 celular ou multiplayer local também aparece ao abrir cada um dos três jogos.
- LAN iOS ainda não implementado; criação de sala habilitada só nos builds Android experimentais.
- Gates físicos LAN, 4+ pessoas para Cidade Dorme, reconexão, QR e comportamento em background continuam **PENDENTES**.
- Nenhum merge para `main`, push, deploy, instalação ou alteração nos worktrees originais.
- Próximo passo: revisão visual in-app, depois homologação física quando houver aparelhos disponíveis e autorização.
