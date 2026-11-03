# Galerows — AAB 1.0.8 (13) com Home v3.1 para teste interno

**Data:** 2026-10-18 · **Entrega:** preparação técnica para Google Play Teste interno; sem upload, push ou publicação.

## Baseline e isolamento

- `main` e `origin/main` em `6c6081e`, contendo `b02229b` (Home v3.1 como launcher mobile) e `6c6081e` (atalho Minha Galera: “Criar • Entrar”), além do MVP/Pista Única e do pacote anterior.
- Novo worktree isolado `/Users/renanxavier/Documents/GitHub/galerows-play-internal-home-v3-1`.
- Branch `release/play-internal-home-v3-1-01` criada a partir de `6c6081e`.
- Commit `8df8e1d`: alteração **somente** de `android/app/build.gradle`, `versionCode=13`, `versionName=1.0.8`.
- `main`, branch MVP e demais worktrees inalterados.

## AAB para o Codex e Play Console

**ARQUIVO EXATO:**

`/Users/renanxavier/Documents/GitHub/galerows-release-artifacts/galerows-1.0.8-vc13-play-internal-home-v3-1-20261018.aab`

- `applicationId = com.galerows.app`
- `versionName = 1.0.8`
- `versionCode = 13`
- `minSdk = 24`
- `targetSdk = 36`
- **Tamanho:** 11.317.804 bytes
- **SHA-256:** `56a25c3f34b15866f3a6bb8437db1a054cf184eed4b1022480de8649a26f4b0b`
- Arquivo SHA-256 independente: `galerows-1.0.8-vc13-play-internal-home-v3-1-20261018.aab.sha256` ao lado do AAB.
- Fonte: `main` em `6c6081e` + a atualização Android de versão do commit `8df8e1d`.

**Não usar o AAB anterior** `galerows-1.0.7-vc12-play-internal-20261018.aab`, pois não inclui a Home v3.1.

## Validação executada

- `npm test`: **998/998**, 165 arquivos, aprovado.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`: aprovado.
- `npx cap sync android`: aprovado, ativos LAN incluídos.
- Android Studio JDK / SDK: `./gradlew --no-daemon :app:bundleRelease :app:testReleaseUnitTest` — `BUILD SUCCESSFUL`, R8 minificado, `lintVitalRelease` e `signReleaseBundle` executados.
- Testes Android/JVM release: **37/37** aprovados.
- `jarsigner -verify`: `jar verified`.
- SHA-256 do certificado de upload igual ao AAB 1.0.7 anterior: `F3:F7:AD:79:7F:05:82:44:5E:4C:95:E7:E7:FC:AE:68:FD:98:00:34:29:DD:64:A3:18:0D:3C:E2:AB:2D:DF:51`.
- Manifesto Android empacotado: `com.galerows.app`, versão `1.0.8 (13)`, target SDK 36, release não depurável.
- ZIP AAB íntegro e cópia final idêntica ao arquivo assinado original, confirmado via SHA-256.
- Arquivos da Home e do lobby LAN presentes no projeto Android; verificação cruzada de web assets confirmou conteúdo distinto da release 1.0.7.
- Arquivos locais `keystore.properties` e `galerows-upload-key.jks` reutilizados somente no worktree e ignorados pelo Git; não foram criadas novas chaves nem incluídas credenciais em commits.
- `android/capacitor.settings.gradle` foi regenerado com caminhos locais pelo sync; alteração automática restaurada **após a compilação** para manter o worktree portátil e limpo.

## Próximo passo — instruções para Codex

1. Usar **este AAB 1.0.8 (13)** como candidato à faixa **Teste interno** da Google Play Console.
2. Verificar na Play Console se o aplicativo com pacote `com.galerows.app` já existe, estado do Play App Signing, configurações da faixa, testadores, e se `versionCode=13` está livre. A criação do AAB local **não comprova** disponibilidade do versionCode na Play.
3. Verificar política de privacidade pública vs `public/privacy.html`; preparar atualização conforme dados reais do aplicativo LAN/câmera/armazenamento, sem deploy automático.
4. Preparar descrições, ícone 512×512, feature graphic 1024×500 e capturas de tela reais da **Home v3.1**, com identidade e textos atuais.
5. Preparar matriz fundamentada de Segurança dos dados, anúncios, público-alvo, classificação, permissões e declarações de conteúdo, para revisão e aprovação humana.
6. Não fazer upload, disponibilizar a testadores, publicar, push ou deploy sem autorização explícita do responsável pelo app. Não gerar ou trocar keystore.
7. Se a Console rejeitar `versionCode=13` por uso anterior, parar e solicitar autorização para gerar novo versionCode e AAB correspondente.

## Pendências

- AAB **não foi enviado** para a Play Console; a aceitação e compatibilidade com o app cadastrado dependem da validação pelo Google.
- Declarações legais, privacidade pública, loja e seleção de testadores dependem de preparação/revisão pela etapa seguinte.
- Não houve testes físicos novos nesta geração do AAB; aproveitam-se somente os testes físicos prévios informados pelo usuário, com escopo específico da Home v3.1 não atestado aqui.
