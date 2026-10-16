# CITY-AUTOPILOT-REPLAY-01 — regressão da narração após Jogar novamente

Data: 15/10/2026. Branch: `feat/cidade-dorme-auto-orchestration-01`.

## Reprodução / causa

Em `results`, o host tocava **Jogar novamente** e a Room criava uma nova `GameSession`, com quatro confirmações possíveis, porém `REPLAY_GAME` não rearmava o áudio Lucas. O acionamento do narrador existia apenas na ação `START_GAME`. A tela anterior executava `stopCityAutomaticNarrator()` ao desmontar, sem isolar o player da sessão seguinte.

A nova fase `reveal` aguardava o término do áudio para liberar o autopilot; como a narração não tocava nem concluía, `START_NIGHT` jamais era enviado, independentemente das confirmações de papel.

## Correção isolada

- No botão **Jogar novamente** do host automático, rearmar o Lucas dentro do gesto do usuário, antes de `REPLAY_GAME`, mantendo a política de autoplay do Android.
- Contabilizar uma geração por `armCityAutomaticNarrator`; a desmontagem de cenas antigas só pode interromper o player da geração que aquela cena possuía. Uma nova cena não perde o áudio recém-iniciado por uma desmontagem atrasada.
- Atualizar a geração da cena também quando ela própria oferece **Retomar narração**.
- Não alterar regras/papéis, autoridade da Room, privacidade, fluxo de votação ou modo prefeito humano.

## Evidência automatizada

- RED real: `CidadeDormeAutoUi.test.tsx` falhou — após clicar em Jogar novamente, apenas uma instância de áudio existia (esperadas duas).
- GREEN: o mesmo teste passou e comprovou áudio inicial da nova sessão ainda em reprodução após a desmontagem anterior e disparo `START_NIGHT` apenas depois de `onended` da nova voz e 4 confirmações.
- Focados: 24/24 PASS; TypeScript PASS.
- `npm test`: **849/849 testes, 144 arquivos, PASS**.
- `npm run lint`: PASS.
- `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`: PASS.
- `git diff --check`: PASS.
- `npx cap sync android` + Gradle `:app:assembleSecureProbe --offline`: PASS (JAVA_HOME Android Studio e ANDROID_HOME do SDK existente); configuração Android gerada e rastreada foi restaurada.

## APK e hardware

Somente o app experimental `com.galerows.app.secureprobe` foi atualizado com `adb install -r` nos três aparelhos Android físicos e no emulador, sem `pm clear` e sem tocar `com.galerows.app`/`com.galerows.app.lanlive`.

Após a instalação, quatro membros entraram na mesma Room LAN do S26 FE; todos marcaram READY, Cidade Dorme automático foi selecionado e a nova partida começou. A voz `01_identidade.mp3` apresentou `play_ok` e `ended` no S26 FE e zero reproduções nos convidados. A partida avançou com narrações sucessivas até a investigação privada, com cenas sincronizadas nos quatro.

**Gate residual:** o teste específico de clicar novamente em **Jogar novamente** no APK recompilado, percorrendo resultado da primeira rodada e início da segunda no mesmo lobby físico, não foi concluído nesta execução. O ciclo replay está coberto pelo teste de regressão automatizado; não registrar homologação física completa dessa transição até um segundo ciclo ponta a ponta.

## Isolamento

Nenhuma alteração na `main` e nenhum push/deploy. A instalação de teste é independente do aplicativo público.
