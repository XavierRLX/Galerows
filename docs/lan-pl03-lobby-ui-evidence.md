# Galerows — PL-03: UI de lobby persistente, etapa de integração

> **ADENDO de fechamento, 12/10/2026 (prevalece sobre as pendências históricas abaixo):** o S25 FE voltou ao ADB, e **a UI PL-03 foi aprovada fisicamente no S23 e S25 FE, duas execuções de 12/12 etapas**, com Wi-Fi compartilhado, QR PNG decodificado, entrada manual segura, troca de jogos sintéticos e retomada após desligamento real do Wi-Fi convidado. Corrigidos por TDD o QR de 300px e a seleção indevida de hotspot versus Wi-Fi. A webcam/câmera do convidado ainda **não** escaneou o QR fisicamente. Detalhes em `docs/lan-pl03-lobby-physical-2026-10-12.md`. O texto antigo de HOLD corresponde à etapa anterior ao ensaio.

**Data:** 12/10/2026 (BRT). **Branch:** `feat/multiplayer-lan-task1-wss`. **Baseline antes de iniciar:** `7f99feb` (PL-02B encerrado). **Escopo:** UI Android de Room v2 com jogos sintéticos (`toy` e `counter`), sem integração do Impostor da Palavra, Adedonha, descoberta de salas ou matchmaking.

## Fonte visual: identidade própria Galerows

Referência principal: logo e assets já existentes em `public/assets/brand/`, além da landing de `src/features/landing/LandingPage.tsx` e `landing.css`. Paleta herdada: grafite `#101014`, lima `#D2F86A`, lilás `#B8A0FF`; tipografias Bricolage e DM Sans já licenciadas/disponíveis no próprio repositório. Sem fontes novas ou dependências npm.

Consultada a skill externa **UI UX Pro Max** (diretrizes de acessibilidade, alvos de toque 44×44px, mobile-first, hierarquia, estados e movimento reduzido). A sugestão genérica de alterar o branding para rosa/Russo One/3D pesado **não** foi aplicada: prioridade é consistência com a identidade já aprovada. Também consultadas as skills Superpowers **test-driven-development** e **verification-before-completion**; testes RED/GREEN e regressão são documentados abaixo.

## Implementação entregue

Arquivos novos sob `src/features/multiplayer/lan/lobby/`:

- `LanPersistentLobbyScreen.tsx`: escolha criar/entrar; convite v2 manual ou leitura QR; confirmação presencial do código TLS; ligação real com `LanNativeHost`, `LanPersistentRoomHost` e `LanPersistentGuestAdmission`; gestão host/guest, refresh de snapshots, comandos e reconexão; encerramento com confirmação; erros em português orientados à recuperação.
- `LobbyRoomView.tsx`: apresentação por papel, lista de até 12 memberships com presença/pronto, seleção pelo host e configuração dos dois jogos sintéticos, botão Ready, início habilitado somente quando condições do runtime estiverem satisfeitas, estado de partida, resultados, retorno ao mesmo lobby e ação explícita de fechar Room separada de finalizar jogo.
- `lobbyView.ts`: modelo derivado de `RoomSnapshotV2` com estado do host e convidado, catálogo estritamente sintético e configuração validada. Não cria estado concorrente ao RoomCoordinator.
- `lobby.css`: design adaptativo 320px+, cards, fontes/cores da marca, foco visível, touch targets, redução de movimento e tratamento de carregamento/erro.
- Testes dedicados: `lobbyView.test.ts`, `LobbyRoomView.test.tsx` e `LanPersistentLobbyScreen.test.tsx`.

Roteamento exclusivo sob **`VITE_LAN_PERSISTENT_LOBBY_UI=1` e `Capacitor.isNativePlatform()`** em `src/app/routes.tsx`. Rota privada `/__lan-lobby-v2`. Build padrão não deve incluir esse chunk, rota ou marcador CSS.

### Decisões de privacidade e integração

- `RoomSnapshotV2.privateState` vem exclusivamente da projeção autenticada do jogador atual. Na UI, carta secreta só aparece mediante toque em **Revelar minha carta**; nunca exibir token de retomada.
- Desconexão do convidado remove `privateState` e `gamePublicState` de snapshots antigos no estado da UI; desabilita ações de jogo enquanto não retoma a sessão.
- Convite descartável é rotacionado pelo host após admissão. A UI acompanha `host.currentInvite` e gera **automaticamente novo QR e texto manual** para próximos convidados. A atualização é guardada pela capacidade mais recente contra corridas assíncronas.
- Só o anfitrião pode selecionar/configurar/iniciar/encerrar rodada e voltar ao lobby. Convidados podem marcar pronto e executar comandos de jogo autorizados.
- Nenhuma ação de UI implica jogar Impostor/Adedonha de verdade; ambos os adapters continuam artificiais e isolados.
- Cenários negativos: sem endereço LAN, convite inválido, verificação TLS incorreta, timeout, não pronto, offline/reconnect, saída versus fechamento permanente.

### TDD aplicado

- `lobbyView`: permissões host/guest, presença, ready, start gate, configuração.
- `LobbyRoomView`: visibilidade role-based, confirmação de ação, sigilo de carta, retorno sem fechar Room, desabilitação sem transporte ativo.
- `LanPersistentLobbyScreen`: entrada/QR/manual, criação do host, fluxo de configuração e botão iniciar desabilitado com 1 jogador.
- **RED → GREEN 1 (teste físico S23):** falta de endereço IPv4 no Wi-Fi recém-ligado dava erro genérico; novo teste exige orientação `Ative o Wi-Fi...`, falhou antes e passou após correção.
- **RED → GREEN 2 (admissão):** host v2 rotacionava convite nativo após ingresso, mas QR/texto da UI não eram atualizados. Integração simulada com `joinRequestV2` e `admissionAckV2` detectou stale QR; após correção acompanha convite atual sem reutilizar token consumido.

## Verificação física

- Teste experimental isolado no **Galaxy S23**, via pacote Android **`com.galerows.app.secureprobe`**; app principal **`com.galerows.app` não foi instalado/sobrescrito**. Primeira abertura e tela inicial visíveis em `/tmp/galerows-pl03-s23.png` no Mac de testes.
- Primeira tentativa de criar sala após habilitar Wi-Fi retornou erro de ausência de interface por não ter IPv4 ainda (corrigido feedback). Repetição com `wlan0` ativo criou o host nativo v2; screenshot da sala com `revision=1`, presença anfitrião e escolha de jogos em `/tmp/galerows-pl03-host2-s23.png`. Fotos locais NÃO exibem token/QR completo.
- **S25 FE:** não detectado pelo ADB na etapa visual. **Não afirmar E2E de PL-03 UX com dois dispositivos.** A prova anterior do transporte PL-02B com dois aparelhos não certifica automaticamente a nova UI PL-03.
- Exemplo da montagem isolada: `VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build && npx cap copy android` e `cd android && JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew :app:assembleSecureProbe --offline`.

## Restrições / próximos gates

- Esta etapa não deve habilitar UI nova no Release ou alterar `main`.
- Ainda falta ensaio UI real S23 ↔ S25 FE com QR, READY dos dois, partida toy A, retorno, counter B, drop/resume, saída/fechamento, capturas responsivas em múltiplas larguras e inspeção de navegação por leitor de tela no Android.
- Não iniciar PL-04 (descoberta), PL-05 (Release/security) ou PL-06 (Impostor da Palavra real) por consequência implícita desta entrega.
- Preserve projeto LAN v1, sem bibliotecas UI externas, backend público, contas ou cloud.

## Regressão final

Verificação fresca após concluir os ajustes de UI, atualização automática de convite e mensagens de rede:

| Comando/gate | Evidência |
| --- | --- |
| `npm test` | **534/534 PASS**, 88 arquivos |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` padrão | PASS |
| `npx cap copy android` sem flag | PASS |
| Guard `/__lan-lobby-v2`, `LanPersistentLobbyScreen`, `pl03-entry` em `dist/assets` e assets Android | **RELEASE_LOBBY_FLAG_GUARD_PASS**: ausentes |
| Android `:app:testSecureProbeUnitTest` | **36/36 PASS**, 9 suites, 0 erros/falhas |
| Android `:app:assembleRelease --offline` | **BUILD SUCCESSFUL** |
| `git diff --check` | PASS |
| SHA-256 APK Release padrão | `cfe403e8f4bbb5bf660d530ad835e5822ab4016a3a27ba0ff13e0d1cd5c8614d` |

**Decisão de gate:** UI/CODE/RELEASE-GUARD PASS; PL-03 **PARTIAL / HOLD no subgate físico de dois Android**. Não confundir com Release pública, nem declarar todo o PL-03 concluído enquanto não executar o fluxo físico entre S23 e S25 FE.
