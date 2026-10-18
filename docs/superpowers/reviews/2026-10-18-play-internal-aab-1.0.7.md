# Galerows — pacote assinado para teste interno na Google Play

**Data:** 2026-10-18
**Branch:** `feat/mvp-app-completion-01`
**Commit de código usado para gerar o bundle:** `c93b3b6`, com a alteração de versão Android registrada depois em `12271a8` (o código funcional e recursos empacotados são idênticos aos da árvore após esse commit).
**Identificador:** `com.galerows.app`
**Versão:** `1.0.7` — **versionCode:** `12`
**SDK:** min 24 / target 36
**Modalidade:** *release* assinado para teste interno; não enviado à Play Console.

## Artefato para upload

`/Users/renanxavier/Documents/GitHub/galerows-release-artifacts/galerows-1.0.7-vc12-play-internal-20261018.aab`

- **Tamanho:** 11.317.791 bytes
- **SHA-256:** `58270e3cdaf2d1704db59422b21768a5c64798034c2ddf5fd3b296ca11deceeb`
- Arquivo `.sha256` correspondente salvo ao lado do bundle.
- Cópia independente da pasta de build, fora do Git.

Este **é o pacote novo** com o MVP finalizado e com as melhorias de UX do Pista Única, diferente do AAB de 17/10 da versão `1.0.6 (11)`.

## Procedimento executado

1. Auditado o worktree limpo no commit `c93b3b6`, com as três melhorias do Pista Única já integradas ao MVP.
2. Confirmada a configuração original de assinatura de upload em `galerows/android/`; a mesma chave foi copiada para arquivos **locais ignorados pelo Git**, permissões `0600`, sem expor senhas nem gravar credenciais em commits.
3. Alteradas apenas `versionName` de `1.0.6` para `1.0.7` e `versionCode` de `11` para `12` em `android/app/build.gradle`.
4. Executados `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`, `npx cap sync android` e `./gradlew --no-daemon :app:bundleRelease :app:testReleaseUnitTest`, usando o JDK do Android Studio.
5. O Gradle concluiu `BUILD SUCCESSFUL` e executou `signReleaseBundle`, `lintVitalRelease` e `minifyReleaseWithR8`.
6. `jarsigner -verify` retornou `jar verified`; a inspeção de integridade ZIP não encontrou corrupção.
7. SHA-256 do **certificado de upload** coincide com o AAB assinado de 17/10:
   `F3:F7:AD:79:7F:05:82:44:5E:4C:95:E7:E7:FC:AE:68:FD:98:00:34:29:DD:64:A3:18:0D:3C:E2:AB:2D:DF:51`.
8. Manifesto `release` empacotado: package `com.galerows.app`, versão `1.0.7 (12)`, target API 36, sem `android:debuggable=true`. Permissões declaradas: INTERNET, ACCESS_WIFI_STATE, CHANGE_WIFI_MULTICAST_STATE, CAMERA, VIBRATE, ACCESS_NETWORK_STATE e permissão interna dinâmica do pacote.
9. `npm test` passou **994/994** (165 arquivos); `npm run typecheck` e `npm run lint` passaram; testes Android/JVM release **37/37** (9 relatórios XML).
10. Desfeita **somente** a alteração automática de caminhos de worktree em `android/capacitor.settings.gradle`; o arquivo não portátil não foi incluído no commit. O bundle já estava compilado e assinado antes dessa restauração.

**Observação:** O `bundletool` disponível no cache Gradle é uma biblioteca sem manifesto Java executável e, por isso, sua CLI standalone não pôde ser invocada. O AAB foi validado por Gradle, `jarsigner`, integridade ZIP e manifesto Android; a aceitação pela Play Console depende do upload real. O `jarsigner` pode emitir avisos de cadeia de certificado própria/sem carimbo de tempo em chaves de upload, sem invalidar `jar verified`.

## Como carregar na Play Console

1. Entrar em https://play.google.com/console e selecionar **Galerows**.
2. Escolher **Testar e lançar → Teste interno** (os nomes das opções podem variar).
3. Criar uma nova versão e enviar **exatamente** o AAB `galerows-1.0.7-vc12-play-internal-20261018.aab`.
4. Se a Play Console informar que o **versionCode 12 já foi usado**, interromper o envio e gerar outro bundle com versionCode ainda não utilizado — **não renomear** o arquivo como solução.
5. Preencher notas da versão, indicar testadores, conferir avisos da Console e disponibilizar o teste quando autorizado.
6. Verificar que o Google reconhece o certificado de upload. Em aplicativos com Play App Signing, o certificado de assinatura instalado pela Play Store pode diferir do certificado de upload; isso é esperado.
7. Instalar o app pelo convite de testador e testar atualização/abertura, modos 1 celular e LAN.

## Pendências independentes do AAB

- A política pública em `https://xavierrlx.github.io/Galerows/privacy.html` respondia HTTPS 200, mas **não correspondia** à última `public/privacy.html` local na auditoria. Publicar o texto atualizado e conferir antes de liberar testers em escala.
- Revisar as declarações de **Segurança dos dados**, política, conteúdo, classificação e público-alvo na Console.
- Preparar e conferir screenshots, gráfico promocional e descrições da ficha de loja.
- Validar o processamento do novo AAB no Google Play e os testes de instalação distribuída.
- Testes físicos em celulares foram informados pelo usuário, mas a validação de upload e aprovação pela Play não pode ser atribuída a um teste físico.

**Restrições respeitadas:** sem merge na `main`, push, deploy, Play Console upload ou publicação da política; chaves e senhas não versionadas.
