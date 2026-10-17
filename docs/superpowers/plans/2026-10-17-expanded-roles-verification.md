# Cidade Dorme — Verificação final da expansão (17/10/2026)

## Baseline
- Worktree: `/Users/renanxavier/Documents/GitHub/galerows-city-expanded-roles`.
- Branch: `feat/cidade-dorme-expanded-roles-01`.
- HEAD inicial: `3becef4` (Cidade Dorme MVP fechado).
- Alterações locais existentes foram preservadas e revisadas; nenhum merge, push ou deploy.

## Gate automatizado (executado após as correções de regressão)
- `npm test -- --reporter=default`: **148 arquivos, 876 testes PASS, 0 FAIL**.
- `npm run typecheck`: **exit 0**.
- `npm run lint`: **exit 0**.
- `npm run build`: **exit 0**.
- `git diff --check`: **exit 0**.
- `cd android && ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :app:compileDebugJavaWithJavac --offline --no-daemon --console=plain`: **exit 0**, 120 tarefas UP-TO-DATE. JAVA_HOME = Android Studio JBR.

## Mídias
- 8 WebP de personagens (1024×1536) existentes no worktree, sem novos assets gerados externamente.
- MP3 `16_vigia.mp3` e `17_resultado_vigia.mp3` encontrados e validados. Os 15 anteriores continuam intactos.

## Revisão
- Preset de 7 jogadores corrigido para 1 Assassino + 1 Traidor, com testes de sucessão.
- `jesterCount` prevalece sobre o booleano legado; toggle local sincroniza ambos.
- Botão de simulação da fase do Vigia adicionado à condução humana.
- Configurações LAN novas exigem Médico e Detetive; sessões antigas preservadas.
- Evidência detalhada em `docs/superpowers/reviews/2026-10-17-city-expanded-roles-review.md`.

## Limitações e arquivos excluídos de commit
- Android passou apenas no compileDebugJavaWithJavac UP-TO-DATE. Sem APK instalado, testes físicos, emulação LAN ou validação UX presencial.
- `android/capacitor.settings.gradle` modificado antes da retomada: arquivo gerado que referencia node_modules de outro worktree; permanecerá fora dos commits.
- Scripts auxiliares `.city-expanded-*.py` permanecerão preservados sem versionamento.
