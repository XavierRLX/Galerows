# Pista Única — Oficina das Pistas

Worktree: `/Users/renanxavier/Documents/GitHub/galerows-pista-visual-codex`
Branch: `feat/pista-unica-immersive-codex-01`
Baseline aprovado: `af3bf6e`

## Commits locais

- `cf509ad` — experiência visual Oficina das Pistas nos modos1 celular e LAN.
- `7ad3df5` — recuperação de comandos LAN após erro, com regressões de confirmação e tentativas repetidas.

## Entrega

Palavra secreta e dicas em cartas, revisão com estados explícitos, adivinhador em destaque, revelação e pontos animados. Paginação de cartas/participantes/pontos evita rolagem nas telas normais. Redução de movimento respeitada. Sem repetir logo global. Entrada unificada preservada.

Somente apresentação/interação: nenhuma mudança de regras, cálculo de pontos, motor, sessão persistente ou transporte LAN. LobbyRoomView recebe apenas integração visual específica de Pista. Textos antigos de pontuação/filtro foram corrigidos para refletir regras já aprovadas.

## Verificações finais

- Suíte: **953 testes em151 arquivos**, sucesso,35.06s (`final-tests.log`).
- TypeScript e ESLint: sem diagnósticos (`fix-1-typecheck.log`, `fix-1-lint.log` quando disponíveis; ver task-1-report.md).
- Build padrão e LAN: sucesso, incluindo26 testes de conteúdo cada (`final-build-default.log`, `final-build-lan.log`).
- `git diff --check af3bf6e..HEAD`: limpo; worktree limpo.
- TDD RED/GREEN documentado em `task-1-report.md` e logs.
- Revisão de tarefa aprovada após correção (`task-review.md`). Revisão geral em conclusão.

## Navegador

Fluxo local real completo de3 rodadas: acerto com+2/+1/+1, duplicatas anuladas com0 pontos, remoção manual, retomada privada, placar e nova partida. Preparação com12 jogadores. Cartas/revisão/palpite/resultado/placar sem rolagem em320×568,375×667 e430×932 nos estados medidos.

LAN: prévia temporária ignorada usa `AuthoritativeRoomRuntimeV2` e projeções reais por jogador, com transporte simulado. Fases com12 jogadores medidas nos mesmos tamanhos sem rolagem. Revisão permanece fechada após reconectar; acesso exige nova revelação. Diálogo com foco de teclado, Escape e retorno de foco conferidos. Resultados detalhados em `browser-results.md` e JSONs de medidas.

## Evidências visuais

- `pista-cartas-375.jpg`: dica em carta.
- `pista-revisao-320.jpg`: carta removida manualmente.
- `pista-categorias-320.jpg`: preparação compacta.
- `pista-lan-revisao-320.jpg`: revisão autorizada LAN.
- `pista-lan-pontos-375.jpg`: revelação e pontos paginados.

## Pendências para integração

Homologação em aparelhos Android reais: rádio LAN/reconexão efetiva, teclado nativo, áreas seguras e leitor de tela. Não foi feita instalação de APK. Rolagem acessível permanece disponível quando teclado/texto ampliado excedem a tela.

Sem merge, push ou deploy. Evidências e prévia temporária estão ignoradas pelo Git e preservadas neste worktree para revisão; os dois commits contêm apenas código/testes/textos da entrega.
