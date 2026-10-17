# Galerows — Fechamento de Pista Única: regras, identidade e Android

**Data:** 2026-10-17
**Branch integrada:** `feat/game-modes-ux-integration-01`
**Worktree:** `/Users/renanxavier/Documents/GitHub/galerows-mode-unification`

## Histórico preservado

Baseline `81bf287` da home/Minha Galera e dos três jogos. A integração ocorreu por **fast-forward**, sem rebase ou resolução de conflitos, incorporando os commits:

- `af3bf6e` — validação automática/manual de dicas, fase privada de revisão, distribuição +2/+1, placar persistente restrito à Pista Única;
- `cf509ad` — identidade imersiva Oficina das Pistas nos modos 1 celular e LAN: cartas, estados de revisão, paginação, animação, preparação, palpite, resultado, placar;
- `7ad3df5` — recuperação de comandos LAN após erro do RoomSessionProvider, permitindo tentar novamente sem remount, preservando sigilo das cartas.

Esta entrega de fechamento adiciona ao commit integrado a preservação de evidências visuais, a estabilização da espera assíncrona no teste de navegação da home e a folga de área segura nativa Android para o cabeçalho de Pista Única.

A alteração de Capacitor gerada automaticamente em `android/capacitor.settings.gradle` durante o sync foi **revertida apenas nesse arquivo**, pois apontava para um caminho relativo do worktree local (`../../galerows/node_modules`), não portátil. Não foram alterados os outros worktrees.

## Regras e contrato público/privado

- Um adivinhador por rodada; todos são adivinhadores uma vez na partida normal (3–12 pessoas).
- Autores escrevem pistas privadas; todas as pistas repetidas normalizadas são anuladas; pista igual à própria palavra também é anulada; revisão manual para pistas não anuladas automaticamente.
- No LAN, apenas o revisor autorizado recebe a lista privada de revisão. O adivinhador não recebe a palavra nem as dicas antes de `guessing`; UI privada se fecha em background/reconexão.
- Se o palpite for correto: adivinhador **+2**, cada autor de pista válida **+1**. Erro ou zero pistas válidas: zero. Pontos de sessão só entram na competição da Room com `END_GAME` autorizado.
- A UI LAN possui recuperação de tentativa após erros, confirmações de encerramento, controle de host e salas persistentes.
- Interface da partida: cabeçalho, cartas, estados, pontuação e preparação coerentes com o tema Oficina das Pistas, sem repetir a logo global.

## Verificação de integração em ambiente de desenvolvimento

- `npm test`: **955/955 testes, 152 arquivos, PASS**. Teste anteriormente intermitente `GameCard.gamesFirst.test.tsx` passou a esperar a navegação assíncrona com `findByRole`.
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- `npm run build` (padrão): **PASS**.
- `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`: **PASS**.
- `npx cap sync android`: **PASS**.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home ./gradlew --no-daemon :app:assembleDebug`: **BUILD SUCCESSFUL**.
- `git diff --check`: **PASS**.
- Screenshots e métricas de 320×568 / 375×667 / 430×932 do Codex foram arquivados em `docs/superpowers/reviews/pista-unica-2026-10-17/`. A revisão específica da correção LAN havia sido aprovada; esta revisão de integração reproduziu a suíte e os builds.

## Gate nativo Android (emulador)

AVD: `Galerows_LAN_4`, API 33, arm64-v8a.
O ADB conectou o emulador; `adb install -r` concluiu com **Success**; `am start -W -n com.galerows.app/.MainActivity` concluiu com **Status: ok**. O aplicativo exibiu home, card de Pista Única, escolha de modo e preparação de 1 celular. Sem exceções `AndroidRuntime:E` no log de execução verificado.

A primeira inspeção revelou que o cabeçalho da Oficina das Pistas estava parcialmente coberto pela status bar Android. Foi adicionado tratamento específico de área segura quando `Capacitor.isNativePlatform()` e `Capacitor.getPlatform() === 'android'`, protegido por novos testes RED→GREEN. O APK foi **recompilado e reinstalado**, e `android-emulator-safearea.png` confirma o título da oficina inteiro abaixo da barra do sistema.

**Artefato final de teste, não uma versão publicada:**
`/Users/renanxavier/Documents/GitHub/galerows-mode-unification/android/app/build/outputs/apk/debug/app-debug.apk`
Tamanho: **14.622.924 bytes**
SHA-256: `8e1d48f5fc3d61878163568e40766a085f32dbb0b916fe282aa0c5baaf84fbad`

## Limite da homologação

**Nenhum aparelho físico estava conectado ao ADB** durante esta sessão; apenas `emulator-5554`. A verificação Android demonstrou instalação, abertura, navegação e safe-area, mas **não** uma partida real LAN entre 3+ aparelhos, reconexão em Wi‑Fi/hotspot, teclado físico/nativo em todos os cenários ou leitura por tecnologia assistiva. Esses testes permanecem dependentes de dispositivos disponíveis; não podem ser considerados PASS sem execução.

O código integrado, os testes de software, a documentação e o APK de depuração estão concluídos. Não foi feito deploy de produção ou merge em `main` (há alterações locais não relacionadas no worktree original). A branch foi mantida separada e limpa após commit.

## Evidências

- `pista-unica-2026-10-17/REVISAO.md`: relato original Codex;
- `pista-unica-2026-10-17/task-1-report.md` e `task-review.md`: TDD, falha corrigida e revisão;
- `pista-unica-2026-10-17/browser-results.md`: cenários reais no navegador e simulação do transporte LAN;
- `pista-unica-2026-10-17/viewport-metrics.json` e `lan-viewport-metrics.json`: medidas de rolagem;
- `pista-unica-2026-10-17/*.jpg`: cinco capturas relevantes do Codex;
- `pista-unica-2026-10-17/android-emulator-safearea.png`: evidência adicional da correção Android.
