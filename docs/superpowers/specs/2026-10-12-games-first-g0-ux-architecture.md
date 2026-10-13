# Galerows — G0: proposta de UX games-first e ciclo de vida LAN

**Data:** 12/10/2026 · **Status:** PROPOSTA PARA REVISÃO; **G1 não autorizado**.
**Branch auditada:** `feat/multiplayer-lan-task1-wss` · **baseline:** `fd8cc5c6f9f4a943cbeea214f3da2da58caf57dc` · working tree inicial limpa.
**Escopo:** design/documentação exclusivamente; nenhum arquivo executável, dependência, WSS, NSD, jogo real, release ou automação física alterados.
**Fontes normativas:** `docs/galerows-games-modes-local-discovery-v0.2.md`, `docs/superpowers/plans/2026-10-12-games-first-discovery-gates.md`; invariantes PL-03 e `docs/multiplayer-persistent-lobby-spec.md`.
**Segurança:** leitura obrigatória de `2026-10-12-g0-lan-discovery-security-review.md` antes de qualquer projeto de ingresso.

## 1. Auditoria factual do código

| Arquivo / componente | Constatado no HEAD | Consequência |
| --- | --- | --- |
| `src/app/routes.tsx` | Índice encaminha a `/__lan-lobby-v2` sob `VITE_LAN_PERSISTENT_LOBBY_UI=1` e Android nativo; catálogo só quando não há probes prioritários | G1 separa navegação games-first das rotas de probes; `/` sempre `HubScreen`, mesmo na flag nova, preservando isolamento de build |
| `HubScreen.tsx` / `GameCard.tsx` | Favoritos, recente/descobrir, ordenação de sessão, anúncios e haptics; card disponível abre diretamente `game.route` | Não substituir Hub nem interromper o fluxo atual; preservar telemetria local, ads e ordenação |
| `HubHeader.tsx` | Ícone Galerows, hero violeta, atalhos galera/ranking/configurações | Ações de LAN entram como bloco compacto após header, sem remover ações preexistentes |
| `games.registry.ts` / `games.types.ts` | `status`, `minPlayers`, `maxPlayers`, `isAvailableOffline`; nenhuma capacidade LAN | Capacidade de modo deve ser explícita e testada; limites de catálogo não são regras autorizativas de Room |
| `LanPersistentLobbyScreen.tsx` | Possui `hostRef`, `runtimeRef`, `guestRef`, `sequence`, `roomRef`, QR, snapshot e ações; cleanup do `useEffect` chama `guest.disconnect()` e `host.stop()` no unmount | **Bloqueio crítico:** nunca habilitar retorno ao catálogo antes de extrair ownership do transporte da tela |
| `LobbyRoomView.tsx` / `lobbyView.ts` | UI já tem ready, participantes, host/guest, resultado, QR e encerramento; catálogo local apenas `toy`/`counter` | Reaproveitar linguagem/comportamentos, não projetar adapter real ou lista LAN a partir dos sintéticos |
| `lanPersistentInvite.ts` / `lanPersistentGuestAdmission.ts` | Convite v2 contém IP/porta/fingerprint/capability; conexão pinada e código manual de verificação do host; resume com cofre nativo | Código visual de seis dígitos é outra entidade; não substituir capability nem retirar verificação por alteração de UI |
| `src/app/App.tsx`, `useNativeAppSetup.ts` | `BrowserRouter` no app; back Android usa `history.back()` ou `AppLifecycle.exit()`; não há owner de Room acima das rotas | Provider de sessão próximo à raiz, política própria para back/exit e foreground/background |
| `AdedonhaSetupScreen.tsx`, `AdedonhaPlayScreen.tsx` | Geração/importação de **QR de categorias e letra**, com folha e pontuação **locais por aparelho** | QR Adedonha não é convite WSS; não afirmar sala LAN nem modo compartilhado comprovado. Preservar fluxo atual com cópia específica |
| `ImpostorDaPalavraSetupScreen.tsx` | Setup de 3–12 participantes no fluxo offline local | Preservar modo de aparelho compartilhado; LAN futura terá sessão, regras e privados distintos |
| `src/features/landing/LandingPage.tsx` | `id="inicio"` é âncora da vitrine web; logo usa `galerows-logo.svg` | **Distinção:** `/inicio` referida na direção visual não é rota nativa atual. Home nativa real é `/` (Hub). Reutilizar identidade, não redirecionar app à landing |

**Evidência histórica, não reexecução G0:** `docs/lan-pl03-lobby-physical-2026-10-12.md` registra 12/12 etapas em Galaxy S23 + S25 FE (duas execuções), 537/537 Vitest e 37/37 JUnit. O mesmo documento diz explicitamente que **a câmera física não foi usada** no teste QR; houve decodificação de PNG, não validação óptica por câmera. Não afirmar o contrário sem evidência nova. Não há jogo real LAN.

## 2. Brainstorming: alternativas de navegação

| Critério | A — catálogo + ações compactas (RECOMENDADA) | B — home dividida em abas Jogos/Salas | C — hub de multiplayer como primeiro painel |
| --- | --- | --- | --- |
| Primeiro contato | Hero/logo e jogos continuam dominantes | Exige entender abas | Empurra LAN antes do jogo |
| Criar/entrar | Duas ações no topo, Voltar à sala contextual | Acessadas via aba Salas | Ações em destaque máximo |
| Partida ativa | Barra discreta fixa/inline de retorno | Indicador na aba | Sessão rouba espaço dos jogos |
| Regressão de favoritos/ads | Baixa, conserva `HubScreen` | Média, altera navegação central | Alta |
| Descoberta, QR e erro | Tela dedicada com espaço suficiente | Dentro de aba ou rota secundária | Painel pode ficar congestionado |
| Custo/riscos | Baixos em G1; owner isolado em G2 | Médios | Alto conflito com games-first |

**Escolha proposta: A.** A home é catálogo; o usuário não precisa decidir sobre conexão para abrir um jogo. Salas têm tela própria; o bloco LAN tem no máximo dois CTAs simultâneos + chip/barra contextual de retomada. Variante B pode ser reconsiderada após teste de usabilidade, caso salas se tornem destino mais frequente que jogos. Variante C rejeitada para este produto.

## 3. Wireflows mobile-first (esboços textuais, não mock implementado)

### 3.1 Home `/` — 320 / 375 / 430 px

```text
┌────────────────────────────────────┐
│ [LOGO GALEROWS]      Galera · Ajustes│
│ A resenha começa aqui              │
├────────────────────────────────────┤
│ [Voltar à sala · 3/5 · Reconectando?]│ <- só quando Room/membership recuperável
│                                     │
│ Jogue com a galera                  │
│ [Entrar em sala] [Criar sala]       │ <- 320px: empilhar se rótulos comprimirem
│                                     │
│ Jogos para a galera                 │
│ [Impostor da Palavra      ▶]        │
│  Neste celular · LAN em preparação  │
│ [Adedonha                ▶]         │
│  Folha no celular · LAN em preparação│
│ [Demais cards existentes  ▶]        │
└────────────────────────────────────┘
```

- **Sem Room:** ocultar inteiramente Voltar à sala. **Room desconectada mas recuperável:** mostrar “Retomar conexão” com estado verdadeiro, sem prometer conexão atual.
- **Na home com Room ativa:** cards continuam navegáveis, mas escolher `Jogar neste celular` durante partida LAN não pode apagar o privado nem assumir função de host: aviso explícito de **experiência separada**, sem LEAVE implícito.
- **768px:** área de ações horizontal e grade existente de duas colunas; não introduzir sidebar obrigatória nem ultrapassar `AppShell.max-w-2xl`.
- Design tokens reutilizados: grafite `#101014`, lima `#D2F86A`, lilás `#B8A0FF`, tipografia Bricolage/DM Sans da UI PL-03 e assets reais. O header nativo violeta existente pode evoluir gradualmente sem reconstrução total.

### 3.2 Entrar em sala — fluxo quando NSD for aprovado (não G1)

```text
/ → Entrar em sala → /salas/entrar
                     ├─ "Buscando salas nesta rede..." (início automático)
                     ├─ lista: [Nome · jogo/aguardando · 2/5 · Entrar]
                     ├─ sala cheia/em jogo: estado + CTA permitido pelo host
                     ├─ 0 encontradas: "Não encontramos salas nesta rede"
                     ├─ descoberta bloqueada/permissão negada: explicação + solução
                     ├─ conexão falhou / mudou a rede: tentar novamente
                     └─ [Ler QR Code] [Digitar código de 6 dígitos]
```

- Código `004 201` filtra **somente salas já descobertas**; após digitar, normalizar seis caracteres (não converter em número); se houver colisão, mostrar desambiguação, nunca escolher automaticamente.
- **Sem descoberta:** o código não encontra endpoint; explicar e direcionar ao QR. QR autenticado carrega endpoint completo e funciona sem anúncio, desde que a conectividade IP entre aparelhos exista; isolamento AP pode bloquear também o socket e deve ser reportado.
- **Entrada com um toque** é meta de UX, **não** característica liberada do protocolo atual; em host não reconhecido dependerá da decisão de segurança G4. Não desenhar CTA operacional antes desse aceite.
- Entrar, Criar, Retomar e modo de jogo nunca podem abrir duas Rooms simultâneas; se já houver sessão ativa, oferecer Voltar ou Sair/Encerrar com confirmação, sem takeover silencioso.

### 3.3 Jogo e escolha de modo

```text
/ → Card do jogo
    ├─ apenas um fluxo funcional → rota atual diretamente
    └─ dois modos realmente prontos → Escolha como jogar
         ├─ Jogar neste celular → rota offline/compartilhada original
         └─ Cada um no seu celular (LAN) → sala atual / criar / entrar
                                              └─ host seleciona jogo na Room
```

**G1 não exibirá `Cada um no seu celular` como CTA habilitado nos jogos reais:** nenhum adapter existe. Mostrar texto `LAN em preparação` informativo (não botão funcional) quando pertinente e manter abrir jogo no clique como hoje. A seleção de modo com dois CTAs só surge após o adapter LAN real ser certificado, salvo uma decisão explícita de separar fluxo local já existente.

**Adedonha é exceção importante:** o fluxo presente é folha **local individual** que pode receber categorias/letra por QR de configuração, sem sessão de jogo multiaparelho sincronizada. Rótulo recomendado agora: “Jogar com minha folha”; futuramente oferecer “Cada um no seu celular (LAN)” somente com adapter real. Não mapear indiscriminadamente `sharedDevice=true`; compartilhamento físico de um aparelho entre participantes ainda não foi validado nesse jogo.

### 3.4 Room e resultados

```text
Criar sala → Lobby host → Escolher jogo compatível → Regras → Prontos → Partida
Entrar     → Lobby guest → Host seleciona         → Pronto  → Partida
Ambos: lobby/jogo ↔ [Ver jogos] ↔ catálogo ↔ [Voltar à sala]
Host: Partida → Resultados → Lobby → Novo jogo (mesma Room, nova GameSession)
Guest: Partida → Resultados → Aguarda host
Saída explícita: guest LEAVE_ROOM / host Encerrar sala com confirmação
```

Navegar a `/`, voltar Android, abrir Configurações, trocar card ou alternar foreground **não** envia `LEAVE_ROOM`, `closeRoom`, `host.stop()` nem `guest.disconnect()` como efeito de desmontagem. `Voltar à sala` abre o estado autoritativo atual, não um lobby novo.

## 4. Estados, feedback e componentes

| Superfície | Estados obrigatórios | Comportamento |
| --- | --- | --- |
| Ações LAN home | desabilitado por plataforma/flag, sem Room, Room ativa, recuperável, host encerrado | Microcópia correta; nenhuma sala fictícia; não criar segunda conexão por double-tap |
| Descoberta | inicializando, procurando, encontradas, vazia, permissão negada, multicast bloqueado, rede ausente, mudança de rede, erro, atualização manual | Fallback QR sempre acessível; distinguir “nenhuma anunciada” de “não foi possível descobrir”; timeout comunicativo, sem spinner eterno |
| Card de sala | aguardando, configurando, em jogo, resultados, cheia, desconhecido/stale, incompatível, acesso fechado | Mostrar nome sanitizado, pessoas, jogo público e estado; ação compatível com host; revalidar tudo no ingresso |
| Ingresso | conectando TLS, aguardando admissão, versão errada, host não confiável, room cheia, fail/retry, ingresso confirmado | Nenhum segredo em toast/log; rollback sem membership parcial |
| Room | ativa, resync, guest offline recuperável, host ausente, host definitivamente fechado com evidência | Privados ocultos durante desconexão; ações autoritativas, sem badge “conectado” otimista |
| Modos | disponível, em preparação, incompatível, desabilitado por flag | Não confundir status de jogo, modo local, LAN e licença premium |

**Componentes propostos e responsabilidade única:** `HomeRoomActions` (CTAs + status seletor), `GameModeEntry` (decide abrir rota ou escolher modo), `GameModeSheet` (quando ≥2 opções funcionais), `NearbyRoomsScreen` (estados e descoberta somente apresentação), `NearbyRoomCard` (informações públicas), `LanJoinFallbacks` (QR/código), `ActiveRoomBanner` (status/retomar), `RoomSessionProvider` (observação e comandos), `RoomSessionManager` (owner da conexão). Reutilizar `GameCard` e `LobbyRoomView`; os nomes são propostas para G1/G2, não arquivos criados.

**Acessibilidade/medidas:** ≥44×44 CSS px de toque, foco visível, VoiceOver/TalkBack, texto não dependente apenas da cor, `aria-live` moderado para busca e reconexão, `prefers-reduced-motion`, layout 320/375/430/768 sem scroll lateral; modal devolve foco ao disparador, back Android fecha modal antes de sair da rota. Metas a medir em teste, **sem SLA inventado**: toques até sala, tempo percebido de busca, taxa de descoberta, sucesso QR, reconexão e falsos badges.

## 5. Arquitetura G2 proposta — owner persistente acima das rotas

```text
App (monta uma vez por processo)
 └─ RoomSessionProvider / única instância RoomSessionManager
     ├─ RoomSessionManager (lifecycle host ou guest; recursos nativos)
     │   ├─ host: LanNativeHost + LanPersistentRoomHost + runtime/coordinator v2 EXISTENTES
     │   └─ guest: LanPersistentGuestAdmission + LanSecureNativeClient EXISTENTES
     ├─ snapshot de UI SOMENTE leitura, derivado do estado do owner
     └─ BrowserRouter → AppRoutes
          ├─ / → HubScreen → ActiveRoomBanner
          ├─ /salas/entrar → discovery view (G3)
          ├─ /salas/criar → comando create na sessão
          ├─ /salas/atual → LobbyRoomView (sem owning stop no unmount)
          └─ /games/:id → rotas locais preservadas
```

**A separação principal:** `RoomSessionManager` é owner **da conexão cliente/host**, nunca uma segunda autoridade da Room. `AuthoritativeRoomRuntimeV2` / `RoomCoordinatorV2` permanecem a única verdade canônica do host; no guest, `ClientReplicaV2` é a projeção autorizada, sem copiar private state para stores de games locais. Provider expõe snapshot imutável/derivado e ações serializadas, assinado via `useSyncExternalStore` ou mecanismo equivalente testável. Contexto de UI não instancia cliente/host e nunca executa cleanup nativo ao navegar.

**Contrato público preliminar:**
```ts
type RoomSessionView =
  | { status: 'none' }
  | { status: 'connecting' | 'reconnecting'; roomId?: string; role?: 'host' | 'guest' }
  | { status: 'active'; roomId: string; role: 'host' | 'guest'; playerId: string; snapshot: RoomSnapshotV2 }
  | { status: 'interrupted' | 'closed' | 'failed'; roomId?: string; reason: string; canResume: boolean }

interface RoomSessionManager {
  getSnapshot(): RoomSessionView
  subscribe(listener: () => void): () => void
  createRoom(options: { preferHotspot: boolean }): Promise<void>
  joinWithExistingInvite(serializedQr: string, verifyHost: () => Promise<string>): Promise<void>
  resumeExistingRoom(): Promise<void>
  sendRoomCommand(command: { type: string; payload: unknown }): Promise<void>
  leaveRoom(): Promise<void>       // guest, efeito terminal
  closeRoom(): Promise<void>       // host, efeito terminal
  disposeOnAppExit(): Promise<void> // nunca associado a unmount de rota
}
```

Esta interface é **um contrato de intenção**, não código pronto para execução: `verifyHost` permanece exigido no ingresso atual e não representa código de seis dígitos. G2 detalha action envelope autenticado, `gameSessionId`, controle de corrida e transições, sem criar transporte paralelo.

**Invariantes de lifecycle:** uma instância por processo e uma Room por instância; operações start/join/resume protegidas contra corrida/duplicação; troca de rota apenas detach de listener; `host.stop()` apenas `closeRoom()` explícito ou descarte definitivo seguro; `guest.disconnect()` apenas falha/transporte/reconexão ou saída efetiva, sem `LEAVE_ROOM` implícito; `LEAVE_ROOM` revoga membro; network loss preserva membership e vault; reentrada pela UI gera resync; mudança de rede invalida endpoints até rede verificável; eventos atrasados e snapshots anteriores nunca reexibem privados.

**Foreground/background Android:** voltar à home dentro do app ≠ colocar app em background ≠ matar processo. Navegação não fecha Room; em background o host pode ter WebSocket suspenso/encerrado por Android (Doze/process kill). Sem foreground service autorizado nem migração de host, **não prometer disponibilidade contínua** em segundo plano ou após morte do processo. Configurar política Android de lifecycle, limpar timers/listeners sem matar Room, testar Activity recreation, back/exit e reconnect físico em G2. Após morte definitiva do host, não recriar `roomId` e fingir Room existente.

## 6. Capacidade explícita de cada jogo

Não inferir a partir de `isAvailableOffline`, `status` ou `minPlayers`. Propor registro tipado separado para UX e gate real do adapter:
```ts
type ModeAvailability = 'available' | 'comingSoon' | 'unsupported'
type GameModes = {
  sharedDevice: ModeAvailability
  localPersonalSheet: ModeAvailability
  lanRoom: ModeAvailability
  solo: ModeAvailability
}
type GameModeDefinition = { gameId: string; modes: GameModes; lanAdapterId?: string }
```

`lanRoom='available'` exige simultaneamente adapter real, aprovação do gate e flag apropriada; não basta mudar a string. Uma fonte central de capacidades com função de resolução deve conectar flags + build + integração real e ser testada. O display `comingSoon` **não é clicável**.

| Jogo | Base verificada | Projeção futura |
| --- | --- | --- |
| Impostor da Palavra | Jogo local de passagem do aparelho (3–12) | `sharedDevice: available`, `lanRoom: comingSoon` |
| Adedonha | Folha individual local; QR compartilha configuração, não estado da Room | `localPersonalSheet: available`, `sharedDevice: unsupported` até validação específica, `lanRoom: comingSoon` |
| Terceiro ainda não escolhido | Nenhum adapter registrado | **Sem disponibilidade LAN** até escolha explícita e implementação |
| Outros games disponíveis | Rotas locais mantidas com regras próprias | `lanRoom: unsupported` sem indicação de funcionalidade falsa |
| `toy` / `counter` | Apenas adapters sintéticos PL-03 | Nunca cards do catálogo público |

## 7. Próximos gates e provas RED→GREEN previstas (não executadas no G0)

**G1 — Home/modes/roteamento, sem descoberta:** criar capacidades tipadas e testes de resolução; preservar `/` sempre Hub; HomeRoomActions com flags independentes; escolher modo só quando genuinamente disponível; não oferecer CTA de join LAN sem segurança. RED: índice sob flag mostrando lobby, badge LAN falsa, favorito/ads/regressão, voltar de jogo, teclado/reduced-motion. GREEN: home preservada, placeholders honestos. Executar `npm test`, `npm run typecheck`, `npm run lint`, build padrão e asset guard; nenhuma dependência nova nem NSD.

**Regra de entrega parcial de G1:** ações Entrar/Criar, quando habilitadas **somente no build experimental**, podem abrir o ingresso existente PL-03 sem prometer descoberta automática; o retorno a uma Room ativa não pode ser apresentado como funcional antes de G2. Se não houver `RoomSessionManager` persistente, ocultar `Voltar à sala` e não permitir navegar para a home a partir de uma Room sem explicar que o fluxo experimental atual encerra a sessão. Nunca lançar um CTA visual sem ação real, nem classificar fluxo PL-03 como versão UX final.

**G2 — Room owner persistente:** mover recursos do `LanPersistentLobbyScreen` para manager raiz por TDD, removendo `stop()/disconnect()` do cleanup de rota. RED: host e guest sobrevivem `lobby → / → lobby`, mesmo `roomId/playerId`, privado isolado, sem segundo socket, resume, background e back Android; GREEN após testes TS, Gradle e físicos em dois Samsung. Não alterar contrato seguro de ingresso.

**G3 — descoberta passiva apenas:** NSD/mDNS, metadado público versionado, permissão e multicast conforme SDK, TTL/collision/isolamento, teste físico e fallback. **Sem ingresso automático**.

**G4 — admissão simples:** **BLOQUEADO** até aprovação separada do threat model e prova de vínculo seguro da identidade TLS. Código de seis dígitos é filtro local, jamais credencial.

**G5 — jogos reais:** Impostor, Adedonha, terceiro definido depois. Cada adapter separado das stores locais, testes privados e gate de release de três aparelhos.

## 8. Critérios de revisão do proprietário

1. Aprovar variante A (catálogo como home, ações LAN compactas, retorno contextual) e rótulos do modo Adedonha.
2. Aprovar arquitetura de owner acima de rotas, com `G1` independente de `G2` e sem claims de background garantido.
3. Aprovar “código de seis dígitos filtra descoberta” + “QR fallback independente”; decidir ingresso sem confirmação manual em análise de segurança separada.
4. Confirmar que terceiro jogo permanece escolha futura e **não autoriza** badge LAN agora.

**DECISÃO ATUAL:** apenas proposta revisável. Nenhum aceite de segurança, de G1 ou de implementação WSS/NSD é inferido deste documento.
