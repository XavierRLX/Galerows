# Galerows — Sala persistente e lobby multi-jogos (produto + arquitetura v0.1)

> **SUPERSEDE UX — 12/10/2026:** o documento mais recente `docs/galerows-games-modes-local-discovery-v0.2.md` estabelece catálogo como entrada principal, modos por jogo, salas descobertas na LAN, fallback QR e código visual de seis dígitos, sem senha ou comparação manual extra. As seções antigas sobre entrada obrigatória por código presencial e convite longo são **históricas**, não orientação de UX atual. **Persistem os invariantes de segurança**: Room/GameSession, host autoritativo, WSS, secrets privados e gate de autenticação antes do novo ingresso; não remover proteções existentes até revisão técnica aprovada. Plano: `docs/superpowers/plans/2026-10-12-games-first-discovery-gates.md`.

**Decisão de produto aprovada em 11/10/2026.** Este documento registra o novo comportamento-alvo do multiplayer. É **especificação, não implementação**. Nenhuma Task 7, integração de jogo ou descoberta de salas foi autorizada por este documento.

## 1. Objetivo e limites

Uma **sala** reúne participantes e permanece conectada durante várias **partidas**. O anfitrião pode escolher Impostor da Palavra, repetir a partida, voltar ao lobby, e futuramente escolher Adedonha, **sem recriar a sala, redistribuir o QR ou gerar novos playerIds**. A sala dura enquanto a autoridade do host existir e ele não encerrá-la; **não** existe recuperação após perda definitiva do processo do host, nem migração automática na V1.

Multiplayer exclusivamente em aplicativos instalados (Android primeiro, iOS depois), LAN/offline-first, mesma Wi-Fi ou hotspot sem WAN; jogos solo existentes não podem regredir. Modo online via backend é futuro e não integra este plano.

**Ordem dos consumidores reais:** Impostor da Palavra; Adedonha depois. Outros jogos só aparecem em catálogo multiplayer quando seu adaptador multiplayer for efetivamente implementado e aprovado. A propriedade `isAvailableOffline` do catálogo de jogos **não** significa compatibilidade com sala multiaparelho.

## 2. Experiência-alvo

### Fluxo anfitrião

1. **Multiplayer → Criar sala**: escolher nome opcional, iniciar host nativo e entrar no lobby como anfitrião local. Nome visual não é identidade/autorização.
2. Lobby mostra participantes (nome/apelido local, conexão, pronto/aguardando), quantidade/limite, QR/convite, código presencial **fora** do QR, e controles de acesso.
3. Anfitrião escolhe um jogo multiplayer suportado e suas configurações; a seleção é visível a todos.
4. Jogadores ficam prontos; host inicia se regras de quantidade/fase/configuração permitirem.
5. Jogo executa em telas específicas por jogador. Estado canônico/tempo/sorteio continuam na autoridade do host; informações secretas usam projeção privada.
6. Ao terminar: resultados → **Voltar ao lobby**, **Jogar novamente** ou **Escolher outro jogo**. Sala, conexões e membership são preservados; cada partida tem identidade e estado próprios.
7. **Encerrar sala** é ação separada de terminar uma partida: fecha conexões, revoga credenciais, invalida convites e deixa o estado final claro.

### Fluxo convidado

1. **Multiplayer → Salas próximas** (descoberta local futura), com **Ler QR** e **Digitar/colar convite** como caminhos disponíveis desde a V1.
2. Se a sala aparecer numa lista, mostrar apenas informações públicas e não secretas: apelido da sala, disponibilidade, ocupação e jogo/fase pública, quando anunciado. Não anunciar credencial de ingresso, token de retomada, papel ou palavra.
3. Ingresso exige WSS TLS pinado, código presencial comparado com a tela do host e admissão explícita; **descobrir uma sala não autoriza entrar nela**.
4. Convidado vê lobby, jogo selecionado, participantes e progresso. Host inicia, e a navegação de todos acompanha eventos autorizados, nunca decisões locais concorrentes.
5. Queda transitória: UI informa reconexão e retoma mesma identidade e snapshot de lobby/partida; saída voluntária definitiva é diferente de perder conexão.
6. Entrada durante uma partida: comportamento padrão **aguardar próxima partida no lobby**, sem alterar papéis ou regras secretas já sorteadas. Cada `GameAdapter` poderá definir sua própria política de participação quando formalmente especificada.

### Exemplos de cópia UX

- Sala aguardando: **Galera do Renan · 4 jogadores · Impostor da Palavra · Aguardando início**.
- Convidado desconectado: **Reconectando à sala…**; após esgotar tentativas, **Tentar novamente**.
- Fim de partida: **Partida encerrada · Voltar ao lobby**; o QR só é renovado quando necessário para novos convidados, não para trocar de jogo.
- Falha definitiva do host: **Não foi possível recuperar a sala**; não afirmar `roomClosed` recebido quando houve apenas perda de conexão.

## 3. Modelo de domínio alvo

**Room (persistente):**
- `roomId`, `hostPlayerId`, `roomName`, `phase` (`lobby | configuring | playing | results | closed`), `roomRevision` monotônica.
- `members[]`: `playerId`, apelido opcional, papel de sala `host | guest`, situação `connected | disconnected` (presence separada do membership), pronto/espera conforme fase.
- `selectedGameId` opcional e `currentGameSessionId` opcional; configurações do jogo selecionado somente após validação pela autoridade.

**GameSession (efêmera e subordinada):**
- `gameSessionId` único por partida, `gameId` suportado, `round/phase` específicas, participantes inscritos, regras/configurações validadas, estado canônico, projeções públicas e privadas, estado `preparing | running | completed | aborted`.
- Uma única GameSession ativa por Room na V1. Partida encerrada permanece apenas como resultado/histórico mínimo em memória até a política definida; **não** reusar estado secreto/revision de outra GameSession.
- Relacionamento: **1 Room → 0..N GameSessions sequenciais**. Sala e jogadores sobrevivem à criação/destruição de partidas; **partidas não sobrevivem à destruição da sala**.

### Estado e autoridade

- **Somente host autoritativo** muda jogo, configurações, inicia/encerra partida e encerra sala. Guests podem definir `READY`, enviar comandos válidos do jogo e `LEAVE_ROOM` de seu próprio membership.
- Operações de `RoomLifecycle` são distintas de comandos do `GameAdapter`; não colocar regras de Impostor/Adedonha no core.
- Cada comando de jogo vincula-se inequivocamente à `gameSessionId` atual (campo protocolar ou envelope versionado a decidir no design técnico). Comando atrasado da sessão anterior **não** modifica jogo novo; retry idempotente mantém `commandId` estável e não é reexecutado.
- Revisões/snapshots/eventos devem permanecer consistentes durante `lobby → jogo → results → lobby` e troca de `GameAdapter`: adotar um sequenciamento autoritativo verificável e `resync` privado. Não reiniciar `roomRevision` ao trocar jogos. Definir se `gameRevision` separada ajuda antes de implementar.
- Cada cliente recebe somente dados públicos e o próprio private state. Trocar de jogo remove/zera o private state anterior na apresentação e na réplica; segredo antigo não pode vazar via logs, snapshots, eventos ou tela.
- Uma entrada no meio da partida não deve retroativamente invalidar um sorteio de papéis; a política inicial é espera para próxima partida.
- Limites de participantes vêm da **capacidade multiplayer real** de cada jogo, não apenas do cadastro histórico dos jogos solo; impedir início com jogadores insuficientes/excedentes, respeitar desconectados e prontos.

## 4. Como encaixar no código existente (sem assumir implementação pronta)

**Código real auditado em 11/10/2026:**
- `AuthoritativeRoomRuntime` recebe um `GameAdapter` fixo no construtor, mantém membership/revision/deduplicação/barreiras.
- `LanRoomHost` conecta este runtime aos peers nativos, convite, admission e retomada.
- `LanRoomSession` e `ClientReplica` recuperam a projeção autorizada; UI `LanRoomScreen` é experimento com adapter de contador.
- Não existe lobby persistente multi-jogos, descoberta automática nem comando `LEAVE_ROOM` real na LAN.

**Fronteira proposta:** uma camada `RoomCoordinator` / `RoomLifecycle` autoritativa **acima do jogo** mantém membership, room phase e seleção; hospeda uma GameSession gerenciada com `GameAdapter` específico. A LAN/WSS, identidade, código presencial e credenciais continuam invariantes. Na fase de design técnico, comparar **(a)** composição com envelope `Lobby + GameSession` e **(b)** estratégia de runtime com adapter delegante; provar preservação de roomRevision, deduplicação e projeção privada antes de escolher. **Não** recriar/fechar `LanRoomHost` ou reemitir identidade TLS quando se troca de jogo.

A UI deve navegar pelo estado autoritativo: descoberta/ingresso → lobby → interface do jogo → resultado → lobby. Stores e rotas são apresentação, nunca autoridade ou meio de sincronização.

## 5. Descoberta de salas próximas (incremento separado)

Objetivo: listar **salas anunciadas na LAN**, não jogadores remotos nem matchmaking público. **MVP da sala persistente não depende da descoberta automática**: primeiro entregar lobby e mudança de partida com QR/manual; adicionar descoberta em etapa posterior.

- Avaliar NSD/mDNS no Android e suporte real em hotspot Samsung; pode exigir multicast/locks/permissões e o hotspot pode bloquear discovery. Testar S23↔S25 FE, Wi-Fi com/sem WAN; iOS requer validação própria com Bonjour e permissões de rede local.
- Anúncio deve conter apenas identificação pública efêmera de sala, protocolo/versão, endereço/porta e metadados públicos mínimos. **Nunca** `inviteToken`/`capability`, credencial de retomada, canonical/private state.
- Um anúncio descoberto é **não confiável**. A UI não deve aceitar fingerprint/autenticidade anunciada sem comparação física. O protocolo existente exige `hello` com capacidade de convite; portanto **descoberta → entrar com um toque não é possível com o contrato atual sem novo fluxo seguro**. Antes de implementá-lo, projetar admissão derivada de solicitação/aceite pelo host e/ou ticket efêmero entregue após verificação, preservando pinning e prova presencial. Não substituir autenticação por SSID/IP/nome.
- Não fazer varredura agressiva de IP, desabilitar TLS ou transmitir credenciais via broadcast. Fallback QR/manual deve permanecer plenamente utilizável se multicast/discovery falhar.

## 6. Saída, ausência e falhas

- `LEAVE_ROOM` explícito, autenticado e idempotente: remover membership, invalidar a credencial daquele jogador, liberar vaga e projetar revisão/evento aos demais; um peer não remove outro. Confirmar erro/ACK e consistência em perda de resposta.
- Desconexão transitória **não** executa `LEAVE_ROOM`: preserva membership e opção de retomar (Android Keystore).
- Definir política de inatividade/desconexão prolongada e direito do host de remover jogador com confirmação e autorização; não confundir presença com membership.
- Ao terminar apenas um jogo, **não** executar leave, revogação nem `roomClosed`. Ao encerrar Room, executar fechamento completo já existente.
- Host em segundo plano/perda de processo: a V1 não promete sobrevivência do host; comunicar queda claramente e não promover outro host automaticamente.

## 7. Invariantes e testes de aceitação

1. Dois aparelhos ingressam sem WAN, entram no mesmo lobby e preservam `roomId`/`playerId` em `jogo A → resultado → lobby → jogo B`.
2. Host controla `SELECT_GAME`, `CONFIGURE_GAME`, `START_GAME`, `RETURN_TO_LOBBY` e encerramento; guests não conseguem falsificar esses comandos.
3. State machine rejeita início em fase errada, número de jogadores inválido, comandos atrasados de GameSession antiga, e duplicata/replay que cause novo sorteio.
4. `LEAVE_ROOM` remove membro/credencial; queda de socket preserva membership para resume; ambos incrementam/projetam revisões conforme contrato.
5. Projeções privadas são isoladas durante início, troca de jogo e reconnect; eventual `Snapshot` não revela segredos alheios/de jogos anteriores.
6. Admissão protegida e verificação presencial continuam obrigatórias. Descoberta não permite ingresso sem autorização.
7. UI e testes de acessibilidade mostram seleção, estado `ready`, lobby, jogo, resultados e erros; app sem multiplayer continua íntegro.
8. Teste físico futuro com host + 2 convidados para isolamento privado quando houver terceiro aparelho; simulação determinística não é rotulada como prova física.

## 8. Status e sequência

**Aprovado como intenção de produto:** sala persistente multi-jogos, lobby, host controlando seleção, convidados acompanhando jogo e retorno ao lobby, fluxo opcional de salas próximas. **Ainda sujeito a design técnico:** modelo exato de projeções e revisões; protocolo da descoberta/ingresso de um toque; política de desligamento/background; teto de participantes; remoção pelo host; identidade/apelidos; regras de empate/pronto/join em cada jogo.

Sequência de execução recomendada:
1. **PL-00:** design técnico e testes de contrato da evolução do runtime, sem código funcional.
2. **PL-01:** `LEAVE_ROOM` definitivo + distinção de desconexão; TDD e prova física.
3. **PL-02:** lifecycle de lobby, autoridade host, seleção e GameSession de teste; TDD e prova física entre partidas fictícias.
4. **PL-03:** UI de lobby e navegação persistente com QR/convite existentes.
5. **PL-04:** spike de descoberta NSD/mDNS com alternativa segura de admissão e fallback QR; somente implementar discovery com evidência física.
6. **Release gate atualizado:** repetir hardening/segurança/manifesto e ensaio físico pós-mudanças; **não** declarar Task 7 existente concluída.
7. **Primeiro GameAdapter real:** Impostor da Palavra após validar ruleset/fila de impostores; Adedonha depois, com testes multi-jogos.

**Não iniciar códigos, migrações, servidores de internet, iOS ou novos jogos somente pela existência deste documento.**
