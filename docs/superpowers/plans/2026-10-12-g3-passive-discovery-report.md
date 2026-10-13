# Galerows — G3 descoberta passiva de salas LAN (12/10/2026)

**Status:** Implementado em código / compilação PASS / testes ADIADOS a pedido do usuário / gate físico NÃO HOMOLOGADO.

## Autorização e baseline
O usuário liberou continuar o desenvolvimento sem segundo aparelho e pediu "deixe os testes depois". A implementação avançou do G2 para **G3 passivo apenas**. Branch `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`; `main` preservada. Modificações locais e arquivos untracked G0/G1/G2 mantidos. Sem reset, commit, push, merge, deploy, APK instalado, atualização remota, dependência nova, alteração do fluxo de autenticação ou uso do segundo telefone.

## Entregas

1. **Anúncio nativo WSS v2:** `LanRoomNsdPublisher.java` publica serviço `_galerows._tcp.` no `NsdManager` com porta do socket seguro e TXT **somente** `app=galerows` / `v=2`. Nome efêmero de 10 caracteres alfanuméricos provenientes de room UUID, sem ID canônico. **Não publica invite/capability, resume token, host fingerprint, chave privada, segredo de cartas, snapshot, senha, código de segurança ou conteúdo da Room.** Falha mDNS não afeta WSS.
2. **Vinculação ao host:** `LanServerPlugin.java` publica apenas depois de abrir servidor **secure v2**, não v1 nem cleartext; remove anúncio em `shutdown()`, expiração watchdog e destruição do plugin Android. Protocolo de frame, pinning TLS, runtime, credentials e transporte v1 não foram alterados.
3. **Descoberta passiva:** `LanRoomDiscoveryPlugin.java` registrado em `MainActivity.java`, com `startScan/stopScan`, eventos `found/lost/error`, resolução serializada, limites de fila e nome, validação de versão/TXT pública, limpeza de listeners/cache e Wi-Fi multicast lock durante scan. Endpoint/IP/tokens **não** são retornados ao JS nem usados para auto-join. Falsas descobertas ainda devem ser tratadas como dados não autenticados.
4. **Manifest permissions:** `ACCESS_WIFI_STATE` e `CHANGE_WIFI_MULTICAST_STATE` adicionados para multicast local. `targetSdk=36`: sem solicitação prematura de `ACCESS_LOCAL_NETWORK`; revisão obrigatória se migrar para target 37+. Fontes: Android Developers `NsdManager`, `Local network permission`.
5. **UI games-first:** `lanRoomDiscovery.ts` e `LanRoomDiscoveryList.tsx`; seção de **Salas próximas** ao entrar na tela nativa experimental. Inicia busca automaticamente, oferece Atualizar, estados carregando/sem salas/erro, remove cards no service lost, pausa scan quando app é ocultado e encerra ao sair da view. CSS responsivo em `lobby.css`.
6. **QR fallback e segurança:** card encontrado oferece **Ler QR** do anfitrião; texto/manual e verificação presencial PL-03 existentes permanecem no mesmo formulário. Não há entrada por mDNS, TOFU, código público de seis dígitos como senha, remoção de confirmação nem bypass de identidade.
7. **Copy:** bloco LAN da home atualizado, sem prometer ingresso automático.

## Compilação / verificações (não são testes funcionais)

- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- `./gradlew :app:compileSecureProbeJavaWithJavac --offline`: **BUILD SUCCESSFUL**; o compilador observou API `NsdManager.resolveService` depreciada, a ser modernizada após matriz de APIs/SDK; não falhou a compilação.
- Build web padrão: **PASS**; guard `dist/assets` não encontrou UI ou plugin experimental G3.
- Build experimental `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1` isolado em `/tmp/galerows-g3-final-experimental`: **PASS**, código de descoberta confirmado no chunk `LanPersistentLobbyScreen`.
- `git diff --check`: **PASS**.
- **NÃO EXECUTADOS:** `npm test`, JUnit, Android instrumentado, instalação APK, descoberta real em mDNS, captura de tráfego e teste de dois telefones. Nada marcado PASS nesses itens. A contagem histórica de 577 testes pertence ao G2.2, não ao G3.

## Gate futuro obrigatório — testes adiados

1. Simular serviço falso, TXT inválido/incompatível, nomes longos, duplicatas, `serviceLost` após `serviceFound`, callbacks de resolução tardios, erro NSD, retry e cleanup da UI; assegurar que dados anunciados não transportam segredos.
2. Android JUnit para publicação somente em v2, stop/expiration/onDestroy, permissões e simulação NSD, versões de API.
3. Dois Android reais na mesma Wi-Fi e hotspot, sem internet, AP isolation/multicast bloqueado, scanner permission denied, rede alternada, múltiplos anúncios, foreground/background, service expiry, QR fallback, TLS pinning e admission; preservar G2 guest `sala→catálogo→sala`.
4. Validar `targetSdk 36` e planejar migração `37` (Android 17) com permission/picker; revisar uso de `NsdManager.resolveService` deprecado.
5. Protocolo G4 **não autorizado**: código de seis dígitos será filtro público, nunca segredo; ingressar em sala desconhecida com um toque só após threat model e aprovação separada.

## Gates
- **G2:** implementação prévia e compilação; dois dispositivos e estabilidade física PENDENTES.
- **G3:** IMPLEMENTED / COMPILE PASS / TESTS DEFERRED / NO PHYSICAL SIGNOFF.
- **G4/G5 naquele gate:** não iniciados; nenhum modo LAN de jogo real liberado.

## Decisão posterior — G4-lite aprovado para conveniência, sem testes físicos

Após este relatório, o proprietário autorizou explicitamente uma entrada simplificada com **6 dígitos**, com exigência de segurança leve para grupos de amigos na mesma rede, e manteve os testes para depois. Essa decisão autoriza apenas o **G4-lite**, não certifica G2/G3, não libera produção e não autoriza G5. A implementação e os riscos aceitos (incluindo código visível na LAN e primeira identidade TLS anunciada sem verificação independente) estão documentados em `docs/superpowers/plans/2026-10-12-g4-lite-six-digit-report.md`. Esta anotação preserva o histórico das restrições anteriores.
