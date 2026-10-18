# Galerows — Revisão de finalização do MVP (2026-10-18)

## Estado final e rastreabilidade

- Repositório de origem: `/Users/renanxavier/Documents/GitHub/galerows`.
- Trabalho isolado em `/Users/renanxavier/Documents/GitHub/galerows-mvp-app-completion`, branch `feat/mvp-app-completion-01`.
- Baseline integrado confirmado: `d8d81599de458dbfee1d8ac5bdd5a0b2420dedfb` (`feat/game-modes-ux-integration-01`).
- Foram examinados nove worktrees existentes, limpos; a branch `feat/ux-hub-header-brand` divergia do baseline e não o substituiu. Nenhum worktree alheio foi modificado intencionalmente.
- Trabalho em commits locais; **sem merge, push, deploy, upload, publicação de política ou alteração de assinatura/identificador/versão de produção**.
- Plano incremental: [2026-10-17-mvp-app-completion.md](../plans/2026-10-17-mvp-app-completion.md).
- Skills Superpowers não estavam expostas/encontráveis no ambiente usado; a sequência de inspeção, plano, testes RED/GREEN e verificação foi seguida sem alegar sua invocação. Revisão de práticas React foi aplicada.

## O que já existia

O baseline já continha home e catálogo, Minha Galera, modo de um celular, jogos Cidade Dorme/Impostor da Palavra/Pista Única, persistência local, tradução, aviso inicial de privacidade, Configurações, método `getInstalledAppVersion()`, integração Play Store, multiplayer LAN com descoberta/convite de seis dígitos/QR, Room Runtime, protocolo WSS e Gradle/Capacitor Android. Nenhum desses jogos, regras, protocolos ou credenciais foi reimplementado.

## Entregas implementadas

| Entrega | Resultado |
| --- | --- |
| 1. Sobre e suporte | Tela Configurações com identidade, jogo offline/LAN, plataforma, versão e build instalados via `@capacitor/app`; link de feedback com assunto/corpo contendo **somente versão, build e plataforma**; privacidade, avaliação na Play Store e três idiomas. Reutilizado serviço de versão e integração Play Store. |
| 2. Erros | Error Boundary de renderização com fallback amigável, retorno à home, feedback e repetição segura fora da rota LAN; alerta separado de rejeições assíncronas sem expor razões/segredos; provedores de sala permanecem montados quando um filho falha. Sem limpeza automática nem recriação de salas. |
| 3. Privacidade | `public/privacy.html`, aviso, tela interna e documentação Play Console revistos: armazenamento local, QR/câmera, dados entre aparelhos LAN, limpeza local, ausência de backend externo próprio. Nenhuma publicação efetuada. |
| 4. Primeiro uso | Três cartões compactos dispensáveis, exibidos na home depois do aviso de privacidade, com conclusão persistida, pular imediato e reabertura em Configurações; separado o carregamento da tela consultável para evitar warning do Vite. |
| 5. Ajuda LAN | Guia em Configurações e entrada de sala: criar/entrar, seis dígitos/QR, Wi-Fi/hotspot, sala não localizada, reconexão/saída; mensagens contextuais usam estados já existentes, sem protocolo paralelo. |
| 6. Tela ativa | Plugin nativo Capacitor 8 sem dependência extra/permissão, `FLAG_KEEP_SCREEN_ON` centralizado e limitado a partida local ativa ou fase LAN playing; limpeza em saída/background, reaplicação no retorno e chamadas nativas serializadas. |
| 7. QA | Suíte completa, análise estática, builds Vite padrão/LAN, Gradle/JVM, revisão visual, smoke Android nativo/emulador e offline; evidências e pendências classificadas abaixo. |

## Commits locais

1. `1468a50` — `feat(settings): show installed build and provide safe support feedback`
2. `306c6ee` — `feat(app): recover render crashes and surface async failures safely`
3. `9c0773f` — `docs(privacy): disclose LAN peer exchange and refresh in-app notice`
4. `a1843ee` — `feat(onboarding): add skippable first-use guide and settings entry`
5. `80e7333` — `feat(lan): add contextual connection help and troubleshooting guide`
6. `8230b9e` — `feat(android): keep screen awake only during active gameplay`
7. `52ffca5` — `perf(onboarding): lazy-load the settings guide separately`
8. Commit documental final deste relatório: consultar `git log -1` na branch.

## Evidência comparativa

| Verificação | Baseline documentado | Após alterações |
| --- | --- | --- |
| Vitest completo | 955 aprovados | **976/976 aprovados**, 163 arquivos (+21 casos) |
| TypeScript | aprovado | aprovado (`npm run typecheck`) |
| ESLint | aprovado | aprovado (`npm run lint`) |
| Vite padrão | aprovado | aprovado (`npm run build`), warning de import dinâmico eliminado no último ajuste |
| Vite LAN | aprovado | aprovado com `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1` |
| Gradle Debug | aprovado | **BUILD SUCCESSFUL**, APK Debug ~14 MB, com assets LAN sincronizados |
| JVM Android | registro anterior de sucesso | **37/37** testes, nove suítes XML, sem falhas |
| `git diff --check` | worktree limpo | aprovado no fechamento, incluindo os arquivos documentais staged |

Comandos reproduzíveis (a partir deste worktree):
```bash
npm test
npm run typecheck
npm run lint
npm run build
VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build
npx cap sync android
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest
git diff --check
```
No Mac foi utilizado JDK do Android Studio e `ANDROID_HOME=/Users/renanxavier/Library/Android/sdk`. Em um worktree com `node_modules` ligado simbolicamente, `cap sync` reescreveu `android/capacitor.settings.gradle` com caminhos específicos do Mac; esses caminhos foram corrigidos imediatamente e **não entraram em commit**. O Gradle emitiu avisos preexistentes de `flatDir` e deprecações para Gradle 9; nenhum erro de build permaneceu.

### UI e execução nativa

- Chrome headless usando `VITE_APP_PREVIEW=1`: primeira abertura, aviso de privacidade → guia dispensável; Configurações, guia, ajuda LAN, Minha Galera, home e setup de Cidade Dorme, Impostor da Palavra e Pista Única. **10 rotas × 3 larguras (320/375/430 px)**, 30 medições com `document.documentElement.scrollWidth === innerWidth`, sem `pageerror`; rolagem vertical esperada em páginas informativas. Não é teste da partida inteira nem do teclado virtual.
- Capturas da revisão visual: [Primeiro uso 320 px](assets/mvp-2026-10-18/first-run-guide-320.png), [Configurações 375 px](assets/mvp-2026-10-18/settings-about-375.png), [Ajuda LAN 430 px](assets/mvp-2026-10-18/lan-help-430.png). Capturas da prévia web mobile, não de telefone físico.
- Emulador Android 33 ARM64 `Galerows_LAN_4`: APK instalado com `adb install -r` (sem limpar dados). `dumpsys package` confirmou `com.galerows.app`, `versionName=1.0.6`, `versionCode=11` e `targetSdk=36`. O WebView exibiu em Configurações `1.0.6 / 11 / Android`, feedback, privacidade e botão da Play Store.
- Via WebView DevTools e `dumpsys window`: chamada nativa `ScreenAwake.setEnabled(true)` ativou `KEEP_SCREEN_ON`; `false` removeu a flag. Enviar o app para o background via HOME após ativar a flag e reabri-lo confirmou a limpeza no `Activity.onPause()`. O controle automático por rota/fase tem testes unitários; falta observação prolongada durante partida real em aparelho físico.
- Offline no emulador: Wi-Fi e dados móveis desligados temporariamente, sem rede conectada. Cidade Dorme carregou a tela de escolha de modo e regras a partir dos assets locais. Wi-Fi/dados foram restaurados para os valores anteriores. Não foram simulados dois celulares LAN.
- Testes direcionados incluíram erro de renderização/retry, gerência assíncrona, build/feedback com metadados mínimos, privacidade, guia, ajuda contextual e lifecycle da tela ativa.

## Relação completa de arquivos alterados antes do relatório

`A` = adicionado; `M` = modificado; nomes em relação a `d8d8159`:

```text
M android/app/src/main/java/com/galerows/app/MainActivity.java
A android/app/src/main/java/com/galerows/app/ScreenAwakePlugin.java
M docs/android-production-checklist.md
M docs/play-console-internal-test.md
A docs/superpowers/plans/2026-10-17-mvp-app-completion.md
M public/privacy.html
A src/app/ActiveGameAwakeManager.test.ts
A src/app/ActiveGameAwakeManager.tsx
M src/app/App.tsx
A src/app/AppErrorBoundary.test.tsx
A src/app/AppErrorBoundary.tsx
A src/app/activeGameAwakePolicy.ts
M src/app/routes.tsx
A src/features/multiplayer/lan/LanHelpScreen.test.tsx
A src/features/multiplayer/lan/LanHelpScreen.tsx
A src/features/multiplayer/lan/lanHelp.model.test.ts
A src/features/multiplayer/lan/lanHelp.model.ts
M src/features/multiplayer/lan/lobby/LanPersistentLobbyScreen.tsx
A src/features/onboarding/FirstRunGuide.test.tsx
A src/features/onboarding/FirstRunGuide.tsx
A src/features/onboarding/GuideCards.tsx
A src/features/onboarding/GuideScreen.tsx
A src/features/onboarding/guide.service.test.ts
A src/features/onboarding/guide.service.ts
M src/features/privacy/PrivacyNotice.tsx
M src/features/privacy/PrivacyScreen.tsx
M src/features/privacy/privacy.config.ts
A src/features/privacy/privacy.policy.test.ts
M src/features/privacy/privacy.service.ts
A src/features/settings/SettingsScreen.test.tsx
M src/features/settings/SettingsScreen.tsx
A src/features/settings/feedback.test.ts
A src/features/settings/feedback.ts
M src/i18n/locales/en-US/common.json
M src/i18n/locales/es-419/common.json
M src/i18n/locales/pt-BR/common.json
A src/lib/capacitor/app.test.ts
M src/lib/capacitor/app.ts
A src/lib/capacitor/screenAwake.test.ts
A src/lib/capacitor/screenAwake.ts
M src/lib/storage/storage.keys.ts
```

Além desses arquivos, esta entrega documental acrescenta o relatório e três PNGs em `docs/superpowers/reviews/assets/mvp-2026-10-18/`.

## Pendências e riscos reais (gates de distribuição)

1. **Aparelhos físicos, obrigatório antes da aprovação LAN:** host + convidado na mesma rede, descoberta, QR com câmera concedida/negada, convite de seis dígitos, hotspot sem internet, interrupção/retomada, final da partida, saída segura. Não marcar como PASS só por testes unitários/emulador.
2. **Ciclo real completo e aparelho pequeno:** percorrer setup → identidades → votação → resultado → home, retomar dados salvos, exclusão seletiva/total, idioma, acessibilidade/TalkBack, áreas seguras, teclado virtual e tela apagar/retomar durante partida. Os testes automatizados não substituem esses casos manuais.
3. **Política:** publicar **manualmente e com autorização** a versão revisada de `public/privacy.html` em `https://xavierrlx.github.io/Galerows/privacy.html`, então validar HTTPS/conteúdo/links. O repositório local não a publicou.
4. **Play Console/Data Safety:** reavaliar transmissão peer-to-peer, possíveis exceções e o formulário de segurança com o AAB final, conforme documentação oficial Google; ausência de servidor próprio não equivale a nenhuma transmissão. Revisar declarações/permissões no console.
5. **Build de distribuição:** os dois flags LAN devem estar habilitados no `vite build` **antes** do `cap sync android`; o build padrão deliberadamente não inclui a sala persistente. Validar o AAB assinado e incrementação de `versionCode` quando autorizado, sem alterar chaves ou assinatura nesta entrega.
6. **Integrações externas:** app de e-mail instalado, página da loja publicada, permissão de câmera, testadores reais e Play pre-launch report ainda exigem dispositivos/serviços externos. O feedback foi testado quanto ao conteúdo seguro do `mailto`, não à entrega real do e-mail.
7. **Avisos técnicos não bloqueantes:** Gradle aponta deprecações para Gradle 9; monitorar migração futura. Não foi adicionada telemetria nem captura remota de erros para evitar dados privados.

**Resultado:** entregas de código completas e commitadas localmente. MVP apto à **rodada de validação fechada assistida em aparelhos**, com os gates externos acima; **não declarado pronto para publicação em produção** antes dessas evidências.
