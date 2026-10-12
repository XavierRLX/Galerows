# Galerows — PL-02B: prova física Android LAN v2 + fechamento de segurança

**Data:** 12/10/2026 (BRT). **Subgate:** PL-02B, integração nativa física da Room persistente. **Resultado:** PASS na prova de dois jogos sintéticos, resync implícito, resume e leave, sem WAN. **PL-02B completo para os jogos reais? NÃO.**

## Fonte, Git e escopo

- Repositório: `/Users/renanxavier/Documents/GitHub/galerows`, branch `feat/multiplayer-lan-task1-wss`.
- HEAD inicial/final deste subgate: `e6859c1` (`feat: add Galerows landing page and visual identity`). O agente anterior mudou HEAD de `c284ff8` para `e6859c1` **antes** desta execução; não houve reset, reversão, commit, merge ou push aqui.
- Todas as alterações locais dos subgates de admissão, comandos/resync e resume/leave foram preservadas.
- A landing já possuía `landing.css` rastreado no novo HEAD. O antigo bloqueio de Vite desapareceu; nenhum arquivo de landing foi editado neste subgate.
- Executor: Remote Desktop Commander, sem Codex nesta execução.
- Escopo **somente** Room v2 em jogos sintéticos (`toy` e `counter`). Não ativados jogos reais, LAN discovery, PL-03 ou Task 7.

## Reforço de segurança implementado (TDD)

Arquivo `lanPersistentRoomHost.ts`: se a revogação nativa de `LEAVE_ROOM` falhar com resultado incerto, o membro fica marcado `leaving` e bloqueado contra `commandV2` / `resumeHello`. Se o único peer autorizado se desconectar antes de retry/reconciliação, agora o **host encerra o servidor WSS inteiro** (*fail closed*), em vez de manter o membro sem caminho de revogação recuperável e um servidor ainda acessível. O host não promete saída confirmada ao cliente.

- RED observado: `lanPersistentResumeLeave.test.ts`, novo teste `fails closed if revocation is uncertain...`, `native.stop` não era chamado.
- GREEN observado após correção na transição `disconnected`.
- Novo teste `resumes during toy A ... counter B`: resume na GameSession A com a mesma projeção privada do convidado, revisão maior, depois limpeza de dados de A e criação de B sem segredo herdado.
- Falha simulada + perda de socket ainda não tem caminho de retry após o fechamento da Room por desenho: requer novo ingresso em outra Room; não é anunciada reconciliação espontânea.

## Probe física isolada

- Screen: `src/features/multiplayer/lan/LanPersistentRoomProbeScreen.tsx`.
- Flag exclusiva para Android: `VITE_LAN_ROOM_V2_PROBE=1`; rota `/__lan-room-v2` em `src/app/routes.tsx`, carregamento lazy.
- Build específico: `VITE_LAN_ROOM_V2_PROBE=1 npm run build`, `cap copy android`, `./gradlew :app:assembleSecureProbe --offline`.
- APK de probe de pacote **separado**: `com.galerows.app.secureprobe`, Debuggable, não substitui `com.galerows.app` nem reutiliza seu sandbox de dados.
- Script de ensaio: `scripts/lan/pl02b-v2-physical.mjs` (CDP WebView em forward local ADB; sem dependências externas; recebe target host na porta 9222 e guest na 9223). Não imprime token de convite, token de resume ou valor dos segredos privados. O código de verificação do host foi fornecido ao formulário do convidado para teste presencial do canal; não foi registrado em claro.
- Sem flags no app normal: probe e rota não devem ser empacotadas em Release.

## Rede e aparelhos reais

| Papel | Dispositivo ADB | Interface | Endereço |
| --- | --- | --- | --- |
| Host | Galaxy S23 `RXCX705P3JR` | `swlan0` (hotspot ativo) | `10.245.112.98/24` |
| Guest | Galaxy S25 FE `RXGL30N4F3F` | `wlan0`, conectado a `S23 de Renan` | `10.245.112.245/24` |

- `ping` guest → host: 1/1 resposta na mesma sub-rede.
- **Sem WAN na tabela de roteamento:** `ip -4 route` em ambos tinha somente `10.245.112.0/24`; `ip -6 route show default` vazio nos dois. Isso comprova que o ensaio dependeu somente da rota LAN; não demonstra estado absoluto de todos os rádios/serviços.
- Os dois dispositivos carregaram `https://localhost/__lan-room-v2` em WebViews Android no pacote `.secureprobe`.
- Automação de UI usou CDP em `127.0.0.1:9222` e `:9223` via `adb forward ... localabstract:webview_devtools_remote_<pid>`, sem acesso remoto de terceiros.

## Segunda execução física — PASS (verificações reforçadas)

| Etapa | Evidência observada |
| --- | --- |
| Início do host | Room criada, certificado/pin e convite v2 disponíveis no host |
| Admissão v2 | Guest entra com código presencial, revision 2, 2 members |
| Toy A playing | Revision **7**, sessão `lan-v2-synthetic-probe:game-1`; guest `hasPrivate: true` |
| Drop + resume durante Toy A | Revision **9**; mesma GameSession, mesma membership, `hasPrivate: true` |
| Resultados → lobby | Revision **11**, sessão removida, `hasPrivate: false` |
| Counter B playing | Revision **16**, sessão `lan-v2-synthetic-probe:game-2`, `hasPrivate: false` |
| `INCREMENT` guest | Status `accepted`; após evento, revision **17** no host e no guest |
| Leave terminal v2 | Status `left_confirmed`; revision **18**, host tem 1 membro |
| Stop host | Status `room_closed` verificado após aguardar conclusão real |

- Resultado final do script: `PHYSICAL_V2_PASS steps=9`.
- Um ensaio anterior também passou; o segundo exige explicitamente revisão >=17 após `INCREMENT` e estado `room_closed` após `stop`, para descartar falso positivo por atualização assíncrona de UI.
- Não foi feita comparação física do **valor** da chave secreta entre host e guest; testes TS simulados cobrem a distinção de privados e limpeza de segredo. A prova física cobre a *existência*/ausência de estado privado correto ao longo das transições, sem registrar seu conteúdo.

## Regressão e proteção do Release comum

- `npm test`: **504/504 Vitest** aprovados em **83 arquivos** (inclui testes novos da landing versionada).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build` normal **sem** `VITE_LAN_ROOM_V2_PROBE`: PASS.
- `cap copy android` **executado novamente após o build normal**, restaurando assets Android padrão.
- `./gradlew :app:testSecureProbeUnitTest :app:assembleRelease --offline`: **BUILD SUCCESSFUL**.
- XML JUnit: **34/34 testes**, 8 suites, 0 falhas ou erros.
- SHA-256 do APK Release normal: `06b9a73ee2b2c36bcbb88df103e6ced0a070898c88c58e402299e0cb8ba299d2` (pós-commit da landing/identidade visual).
- `git diff --check`: **PASS** na auditoria final, branch ainda `feat/multiplayer-lan-task1-wss`, HEAD `e6859c1`.
- **Release normal verificado:** 0 ocorrências de `/__lan-room-v2` e `lan-v2-synthetic-probe` em `dist/assets` e nos assets copiados para Android; nenhum chunk `LanPersistentRoomProbeScreen` em ambos.
- Não realizar deploy, commit ou push antes do gate de revisão.

## Reprodução controlada (somente projeto e aparelhos autorizados)

1. Na branch correta, compilar com a flag `VITE_LAN_ROOM_V2_PROBE=1 npm run build` e executar `npx cap copy android`.
2. Na pasta `android`, executar `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew :app:assembleSecureProbe --offline`.
3. Instalar `app/build/outputs/apk/secureProbe/app-secureProbe.apk` nos dois Samsung via `adb -s <serial> install -r ...`, sem substituir o package `com.galerows.app`.
4. Confirmar LAN comum, ausência de default route, e abrir o package `com.galerows.app.secureprobe` nos dois.
5. Criar dois ADB forwards locais para os respectivos sockets `webview_devtools_remote_<pid>`, com portas Mac 9222 (S23 host) e 9223 (S25 FE guest).
6. Executar `node scripts/lan/pl02b-v2-physical.mjs`; script devolve `PHYSICAL_V2_PASS steps=9` apenas se todos os passos e revisões passarem. Não mostrar convite/segredo em logs.
7. **Obrigatório:** executar novamente `npm run build` sem a flag e `npx cap copy android` para restaurar os assets normais, compilar o Release e verificar a ausência da rota e chunk de probe.

## Pendências após subgate

1. Auditar races pouco frequentes com desconexão durante `resumeAckV2`, indisponibilidade do Android Keystore, timeout de confirmação de leave e custo de projeções sucessivas; definir política de sala longa/TLS 24h e credencial de 2h.
2. Validação de terceiro convidado e duas credenciais distintas sob transporte físico real; além de desafios de carga.
3. Integração final dos fluxos de multiplayer reais, seus adapters e UX sem ampliar escopo de PL-02B; só depois iniciar os gates da primeira experiência de jogo publicável.
4. Revisão de segurança / persistência dos três subgates prévios e deste; organizar commits **apenas com autorização**. Não incluir os arquivos da landing no commit de multiplayer.
