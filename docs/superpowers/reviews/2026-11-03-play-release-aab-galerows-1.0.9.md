# Galerows — AAB de produção assinado 1.0.9 / vc14

**Data:** 03/11/2026
**Estado:** gerado, testado, assinado e pronto para upload manual na Play Console. **Ainda não enviado à Play Store.**

## Fonte e integração

- Main remota de base `b60363a` (preservadas as correções da landing, favicon, manifest e privacidade no GitHub Pages).
- Release interna 1.0.8 `1c162a2` incorporada ao histórico antes das alterações.
- Implementação aprovada da Home/coverflow: commit `e493bba`.
- Versão do `package.json`: `1.0.9`. Android `applicationId=com.galerows.app`, `versionName=1.0.9`, `versionCode=14`.
- Nenhuma configuração `com.galerows.app.dev`, `android/app/src/live`, túnel ADB ou `server.url` foi incluída na release. O app continua offline-first; a variante Dev no S25 FE permanece isolada.

## Novidades

- Card “Minha Galera” reduzido, preservando a identidade e o acesso à criação/entrada em salas.
- Descoberta de jogos em carrossel com movimento contínuo, perspectiva 3D, deslize, inércia, navegação circular e bolinhas dinâmicas.
- Todos os 10 jogos disponíveis exibidos diretamente na Home em miniaturas de 5 × 2; sem botão de expansão.
- Dimensões adaptáveis à altura e à largura do dispositivo, com áreas seguras superior e inferior no Android.
- Integração sobre a release 1.0.8: sem remover jogos, multiplayer LAN, regras, rotas ou ajustes de privacidade existentes.

## Validação realizada

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: **1.011 testes / 167 arquivos, PASS** (incluindo correções da `main` remota e novos fluxos da Home).
- `npm run build`: PASS.
- `cap sync android`: seis plugins oficiais sincronizados; configuração Android verificada sem servidor remoto.
- `./gradlew :app:bundleRelease --no-daemon`: **BUILD SUCCESSFUL**, tarefa `app:signReleaseBundle` executada.
- Bundle ZIP: `unzip -tq` PASS; `jarsigner -verify` retorna `jar verified`. O modo `-strict` emite alertas esperados por certificado de upload autoassinado e pela estrutura ZIP do bundle (não equivale a erro de assinatura no modo padrão).
- SHA-256 do certificado de upload: `F3:F7:AD:79:7F:05:82:44:5E:4C:95:E7:E7:FC:AE:68:FD:98:00:34:29:DD:64:A3:18:0D:3C:E2:AB:2D:DF:51`, igual ao documento da release 1.0.8.
- Nenhuma chave, senha ou credencial incorporada ao repositório.

## Artefato final na máquina local

**Arquivo pronto para selecionar no upload de App Bundle da Play Console:**

`/Users/renanxavier/Desktop/Galerows-Releases/galerows-1.0.9-vc14-play-signed.aab`

Checksum ao lado do arquivo: `galerows-1.0.9-vc14-play-signed.aab.sha256`.

**SHA-256 do AAB:**
`4696b74ca1c1aabbe9cd8c5c5d1312bd1cdc4456397273ea839a44ef3fbb32df`

O arquivo foi comparado byte a byte à saída Gradle em `android/app/build/outputs/bundle/release/app-release.aab`.

## Próxima etapa e restrições

1. Na Play Console, selecionar o app `com.galerows.app`, faixa **Teste interno** e criar uma nova versão.
2. Enviar o AAB **1.0.9 / 14** e verificar a aceitação do código de versão, assinatura e eventuais alertas de políticas.
3. Revisar as notas de versão e, somente após conferência, publicar na faixa desejada.

**Não houve upload, publicação, alteração de testadores ou atualização remota da Play Console.** A verificação local não comprova que o `versionCode=14` ainda esteja disponível no inventário remoto.

### Sugestão de notas de versão (pt-BR)

> Galerows com uma nova experiência de descoberta: jogos em carrossel interativo, seleção rápida dos 10 jogos na Home e layout ajustado para diferentes tamanhos de tela. Melhorias visuais e de navegação, preservando os modos de jogo existentes.
