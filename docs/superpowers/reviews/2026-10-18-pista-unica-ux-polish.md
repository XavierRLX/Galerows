# Galerows — revisão de UX do Pista Única / Oficina das Pistas

**Data:** 2026-10-18 · **Escopo:** ajustes pontuais de UX, sem alteração de regras, sorteio, pontuação, outros jogos, lobby LAN ou identidade visual.

## Baseline real e isolamento

- Repositório principal: `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch MVP auditada: `feat/mvp-app-completion-01`; HEAD confirmado em `d218d28` (`docs(review): record MVP completion checks and remaining Play gates`). Worktree MVP existente: `/Users/renanxavier/Documents/GitHub/galerows-mvp-app-completion`.
- Trabalho realizado exclusivamente no novo worktree `/Users/renanxavier/Documents/GitHub/galerows-pista-ux-polish`, branch `feat/pista-unica-ux-polish-01`, criada a partir de `d218d28`.
- Auditoria prévia: branches, worktrees e alterações locais inspecionados. Nenhum outro worktree, branch ou commit preexistente foi reescrito. A baseline executou **976 testes aprovados em 163 arquivos** antes das alterações.
- Dependências existentes reutilizadas, sem instalação de pacote de gestos.

## Comportamentos e arquivos alterados

| Área | Antes | Depois | Arquivos |
| --- | --- | --- | --- |
| Tema nas pistas | Categoria real não aparecia ao adivinhador | Indicador compacto `TEMA DA RODADA · ...` acima das pistas válidas; nomes `Palavras`, `Filmes`, `Séries` vindos do i18n; permanece quando a carta muda | `PistaWorkshop.tsx`, `PistaUnicaPlayScreen.tsx`, `PistaUnicaLanRound.tsx`, `pistaWorkshop.css` |
| Projeção pública LAN | Sem categoria pública | `roundCategory` calculado do alvo da rodada pelo runtime autorizado; disponível somente após publicação das pistas, sem ID/segredo | `pistaUnicaLanGame.ts` |
| Cartas | Setas e contador apenas | Swipe touch/pen com mínimo de 48 px e dominância horizontal; setas/contador mantidos, dica discreta no primeiro contato; limites respeitados | `PistaWorkshop.tsx`, `pistaWorkshop.css` |
| Seleção de jogadores | `CardDeck` com três registros por página | Lista única com `overflow-y: auto`, limite de altura, contador, seleção individual e botão contextual `Selecionar todos`/`Desmarcar todos` | `PistaUnicaSetupScreen.tsx`, `pistaWorkshop.css` |
| Participantes | Seleção manual limitada a 12 | Seleção em massa mantém escolhas existentes, preenche primeiros cadastrados elegíveis até 12 e reserva vagas para convidados; desmarcação em massa não remove convidados | `PistaUnicaSetupScreen.tsx` |

Testes novos ou atualizados:
- `src/features/pista-unica/PistaUnicaSetupScreen.test.tsx`
- `src/features/pista-unica/PistaWorkshop.swipe.test.tsx`
- `src/features/pista-unica/PistaUnicaWorkshop.test.tsx`
- `src/features/multiplayer/pistaUnicaLanGame.test.ts`
- `src/features/multiplayer/lan/lobby/PistaUnicaLanRound.test.tsx`
- `src/features/multiplayer/lan/lobby/PistaUnicaProjection.test.tsx` (inicialização explícita do i18n no teste de integração, sem alteração de produção).

## Privacidade e integridade da rodada LAN

- A projeção pública fornece **somente** `roundCategory: words | movies | series | null`; não publica `targetId` nem a palavra secreta. As verificações de snapshots públicos e do adivinhador confirmam ausência do alvo.
- Em `writing` e `review`, `roundCategory` é `null` e a lista pública de pistas continua vazia. Pistas privadas de revisão não são introduzidas na projeção pública.
- Na fase `guessing`, categoria e pistas aprovadas tornam-se visíveis juntas. Após `NEXT_ROUND`, a categoria volta a `null` até a próxima aprovação; snapshots retomados derivam o tema da rodada corrente.
- Nenhum gesto altera o estado de jogo, dispara ação de pontuação/rodada, emite comando LAN ou grava paginação persistente. Campos e botões iniciadores de gesto são ignorados; revisão mantém seu rascunho no componente pai.
- Regras, sorteio, resultado e pontuação não foram alterados.

## TDD, revisão e verificação

Fluxo Superpowers aplicado: auditoria/worktree isolado, plano, testes RED antes de cada implementação, implementação GREEN, revisão de diffs, execução integral e commits locais separados.

| Verificação | Evidência em 2026-10-18 |
| --- | --- |
| Testes de categoria e privacidade | Três categorias, transição/retomada da rodada e snapshots LAN aprovados |
| Swipe | Esquerda/direita, início/fim, toque/arraste curto, vertical, cancelamento, controles interativos, revisão e decks agrupados aprovados |
| Seleção | 5, 12 e 15 cadastrados; convidados, duplicatas, contador, mínimo de 3, lotação, seleção individual/em massa, remoção, navegação aprovados |
| Testes Pista Única + projeções LAN | **51/51 aprovados** em seis arquivos |
| Vitest integral | **994/994 aprovados** em 165 arquivos (baseline 976/976, acréscimo líquido de 18 testes) |
| TypeScript | `npm run typecheck` — aprovado |
| ESLint | `npm run lint` — aprovado |
| Vite padrão | `npm run build` — aprovado; inclui 26 testes de conteúdo |
| Vite multiplayer LAN | `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` — aprovado; inclui 26 testes de conteúdo |
| Integridade Git | `git diff --check d218d28 HEAD` — sem erros; confirmação final do worktree limpo após o commit deste relatório |

A suíte integral emite avisos `NO_I18NEXT_INSTANCE` em alguns testes antigos de entrada/navegação LAN, sem falhas; o harness de projeção Pista Única tocado nesta entrega passou a inicializar i18n explicitamente.

## Evidência de layout mobile e limite da cobertura

Smoke test no **Google Chrome headless** usando o app real em modo de pré-visualização `VITE_APP_PREVIEW=1`, com 15 jogadores cadastrados em perfil temporário isolado e viewport de 800 px de altura:

| Largura | Registros | Altura rolável / visível | Largura lista (scroll/client) | Overflow horizontal | Avanço |
| --- | --- | --- | --- | --- | --- |
| 320 px | 15 | 816 / 334 px | 274 / 274 px | Não | Presente |
| 375 px | 15 | 816 / 334 px | 329 / 329 px | Não | Presente |
| 430 px | 15 | 816 / 334 px | 384 / 384 px | Não | Presente |

Nos três casos, largura de scroll do documento e da superfície principal igual à largura disponível; `overflow-y: auto` confirmado na lista. Seleção em massa observada chegando a **12 / 12 selecionados**.

**Android:** `adb devices -l` retornou lista vazia. Portanto, swipe/scroll em **Android WebView físico** não pôde ser atestado; testes de pointer events e o smoke test de layout no Chromium passaram. Nenhum APK foi instalado.

## Commits locais

1. `13524d9` — `feat(pista): show current round category on clue cards`
2. `788789e` — `feat(pista): support swipe gestures in workshop decks`
3. `3fa4292` — `feat(pista): add scrollable player selection and select all`
4. `124dff7` — `test(pista): initialize localization in LAN projection harness`
5. Commit documental: este relatório e `docs/superpowers/plans/2026-10-18-pista-unica-ux-polish.md`.

## Pendências reais e limites de autorização

- **Pendente apenas validação manual em aparelho Android/WebView**, quando houver um dispositivo disponível e autorização específica para instalação, caso necessária. Incluir arrastos esquerda/direita, scroll vertical e campos de revisão na verificação física.
- Não foram feitos push, merge, deploy, instalação Android ou alteração de `main`, da branch MVP ou de outros worktrees.
