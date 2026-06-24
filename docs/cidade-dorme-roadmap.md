# Roadmap do Cidade Dorme

Atualizado em: 20 de junho de 2026

## Objetivo

Criar o jogo **Cidade Dorme** dentro do Galerows como um assistente offline para o mediador controlar partidas presenciais de dedução social.

O app deve ajudar o mediador a configurar a partida, sortear personagens, revelar funções individualmente, conduzir noite e dia, registrar ações secretas, resolver votações, eliminar jogadores e verificar vitórias automaticamente.

## Estado Atual

**Status:** FASE 12 concluída. Cidade Dorme está liberado no hub como jogo disponível.

Já existe uma base pura e testável em `src/features/cidade-dorme/`, com rotas, telas, resultado final, i18n, asset visual e exposição jogável no hub.

Arquivos criados na FASE 1:

- `cidadeDorme.types.ts`
- `cidadeDorme.roles.ts`
- `cidadeDorme.theme.ts`
- `cidadeDorme.rules.ts`
- `cidadeDorme.rules.test.ts`

Arquivos criados na FASE 2A:

- `cidadeDorme.setup.ts`
- `cidadeDorme.setup.test.ts`

Arquivos criados nas FASES 2B e 3:

- `cidadeDorme.session.ts`
- `cidadeDorme.session.test.ts`
- `cidadeDorme.store.ts`
- `cidadeDorme.store.test.ts`
- `useCidadeDormeInitialization.ts`
- `CidadeDormeHomeScreen.tsx`
- `CidadeDormeSetupScreen.tsx`
- `CidadeDormePlayScreen.tsx`

Arquivos criados na FASE 4:

- `cidadeDorme.stateMachine.ts`
- `cidadeDorme.stateMachine.test.ts`

Arquivos criados na FASE 5A:

- `components/NightIntroPhase.tsx`

Arquivos criados na FASE 5B:

- `components/KillerTurnPhase.tsx`

Arquivos criados na FASE 5C:

- `components/DoctorTurnPhase.tsx`

Arquivos criados nas FASES 5D, 5E, 6A e 7A:

- `components/DetectiveTurnPhase.tsx`
- `components/NightResolutionPhase.tsx`
- `components/DayDiscussionPhase.tsx`
- `components/VotingPhase.tsx`

Arquivos criados nas FASES 8 e 9:

- `components/MediatorHistoryPanel.tsx`
- `CidadeDormeResultScreen.tsx`

Arquivos refinados na FASE 10A:

- `cidadeDorme.rules.ts`
- `cidadeDorme.session.ts`
- `cidadeDorme.store.ts`
- `components/VotingPhase.tsx`
- `CidadeDormePlayScreen.tsx`

Arquivos criados ou refinados na FASE 10B:

- `cidadeDorme.copy.ts`
- `public/assets/games/cidade-dorme.webp`
- `src/i18n/locales/pt-BR/cidade-dorme.json`
- `src/i18n/locales/en-US/cidade-dorme.json`
- `src/i18n/locales/es-419/cidade-dorme.json`
- `src/i18n/index.ts`
- `src/features/games/games.registry.ts`
- `src/features/hub/GameCard.tsx`
- `src/app/routes.test.tsx`

Arquivos refinados na FASE 11:

- `cidadeDorme.types.ts`
- `cidadeDorme.rules.ts`
- `cidadeDorme.setup.ts`
- `cidadeDorme.session.ts`
- `cidadeDorme.store.ts`
- `components/DoctorTurnPhase.tsx`
- `components/NightResolutionPhase.tsx`
- `components/VotingPhase.tsx`
- `components/MediatorHistoryPanel.tsx`
- `CidadeDormeSetupScreen.tsx`
- `CidadeDormePlayScreen.tsx`
- `CidadeDormeResultScreen.tsx`
- `src/i18n/locales/pt-BR/cidade-dorme.json`
- `src/i18n/locales/en-US/cidade-dorme.json`
- `src/i18n/locales/es-419/cidade-dorme.json`
- `src/features/hub/GameCard.tsx`

Arquivos refinados na FASE 12:

- `cidadeDorme.types.ts`
- `cidadeDorme.session.ts`
- `cidadeDorme.store.ts`
- `cidadeDorme.stateMachine.ts`
- `components/KillerTurnPhase.tsx`
- `components/DoctorTurnPhase.tsx`
- `components/DetectiveTurnPhase.tsx`
- `components/NightResolutionPhase.tsx`
- `components/MediatorHistoryPanel.tsx`
- `CidadeDormePlayScreen.tsx`
- `src/i18n/locales/pt-BR/cidade-dorme.json`
- `src/i18n/locales/en-US/cidade-dorme.json`
- `src/i18n/locales/es-419/cidade-dorme.json`

Verificações da FASE 1:

- Teste unitário do módulo passou.
- Typecheck passou.
- Suíte completa passou.
- ESLint dos arquivos novos passou.

Verificações da FASE 2A:

- Presets de 4 a 12 jogadores passam em `canStartGame()`.
- Limites de jogadores foram centralizados.
- Hub corrigido para exibir Cidade Dorme como 4 a 12 jogadores, ainda `coming-soon`.

Verificações das FASES 2B e 3:

- Configuração visual cria sessão persistida.
- Revelação individual mostra apenas uma função por vez.
- Função fica escondida por padrão e precisa ser escondida antes de avançar.
- Estado visual de segredo visível não é persistido.
- Rotas internas foram adicionadas sem mudar o status `coming-soon` no hub.

Verificações da FASE 4:

- Transições válidas foram centralizadas em state machine pura.
- Revelação individual só avança para noite depois do último jogador.
- Turnos noturnos pulam Médico ou Detetive apenas quando desativados; se estiverem eliminados, o mediador recebe um turno de disfarce.
- Avanço de nova rodada reinicia ação noturna.
- Condição de vitória já leva a `gameOver` quando detectada pela state machine.
- Testes focados da state machine, sessão e store passaram.

Verificações da FASE 5A:

- Introdução da noite foi separada em componente próprio.
- Mediador consegue iniciar ações noturnas pela UI.
- Avanço `nightIntro` para `killerTurn` usa `advancePhase()` do store.
- `killerTurn` ainda é uma tela de confirmação, sem seleção de vítima.
- Testes do Cidade Dorme, typecheck e ESLint focado passaram.

Verificações da FASE 5B:

- Turno dos Assassinos foi separado em componente próprio.
- Mediador escolhe uma vítima entre jogadores vivos.
- A escolha salva `killerActorId` e `killerTargetId` em `currentNightAction`.
- Após confirmar a vítima, o app avança pela state machine para Médico, Detetive ou resolução.
- A tela lista nomes sem revelar funções secretas.
- Testes do Cidade Dorme, typecheck e ESLint focado passaram.

Verificações da FASE 5C:

- Turno do Médico foi separado em componente próprio.
- Mediador escolhe uma proteção entre alvos vivos válidos.
- A escolha salva `protectedPlayerId` em `currentNightAction`.
- Autoproteção é bloqueada quando a configuração estiver desligada.
- Repetição da proteção anterior é bloqueada quando a configuração estiver desligada e houver histórico anterior.
- Após confirmar a proteção, o app avança pela state machine para Detetive ou resolução.
- A tela lista nomes sem revelar funções secretas.
- Testes do Cidade Dorme, typecheck e ESLint focado passaram.

Verificações das FASES 5D, 5E, 6A e 7A:

- Turno do Detetive registra `detectiveTargetId` em `currentNightAction`.
- Turno do Detetive mostra o resultado em uma etapa privada antes de avançar.
- Resultado da investigação é calculado por `resolveNight()` como `suspect` ou `innocent`.
- Resolução da noite aplica morte, proteção e investigação sem revelar papéis ao grupo.
- Histórico interno da rodada recebe o resultado da noite para suportar repetição do Médico.
- Discussão do dia avança para votação.
- Votação agora é presencial e o mediador registra apenas quem saiu ou se houve empate.
- Empate registrado pelo mediador não elimina ninguém.
- Vitória é checada ao avançar depois da noite e depois da votação.
- Cidade, Assassinos e Coringa levam a `gameOver`.
- Testes focados do Cidade Dorme, typecheck e ESLint focado passaram.

Verificações das FASES 8 e 9:

- Histórico privado do mediador foi criado como painel recolhido.
- Histórico mostra alvo dos Assassinos, proteção do Médico, investigação do Detetive, morte/proteção da noite e resultado manual da votação.
- Resultado da votação agora fica registrado em `history.votingResult`.
- A tela de resultado final foi criada em `CidadeDormeResultScreen.tsx`.
- Rota `/games/cidade-dorme/result` foi adicionada.
- `CidadeDormePlayScreen` redireciona para o resultado quando a fase chega em `gameOver`.
- Resultado final mostra vencedor, sobreviventes, eliminados, papéis revelados e histórico privado.
- Ação de jogar novamente preserva jogadores e configurações, sorteando nova partida.
- Ação de voltar ao hub descarta a partida encerrada.
- Testes focados do Cidade Dorme, testes de rotas, typecheck e ESLint focado passaram.

Verificações da FASE 10A:

- Empate com regra `revoteTied` agora registra o empate e abre uma votação de desempate real.
- A votação de desempate aceita apenas os alvos empatados.
- A segunda votação pode eliminar normalmente e substituir o resultado provisório no histórico da rodada.
- Empate com regra `mediatorDecision` agora exige escolha explícita do mediador entre os alvos empatados.
- Escolha do mediador aplica eliminação ou skip quando skip estiver entre os empatados.
- O fluxo ainda não liberava o jogo no hub; publicação ficou para a FASE 10B.
- Testes focados do Cidade Dorme, typecheck e ESLint focado passaram.

Verificações da FASE 10B:

- Cidade Dorme foi alterado de `coming-soon` para `available` no hub.
- Cover visual próprio foi criado em `public/assets/games/cidade-dorme.webp`.
- Textos das telas do Cidade Dorme foram internacionalizados em `pt-BR`, `en-US` e `es-419`.
- Nomes, descrições e objetivos dos papéis são exibidos traduzidos na UI sem alterar `RoleKey` nem schema persistido.
- Textos do mediador foram revisados para instruções presenciais mais claras.
- Layouts de setup receberam pequenos ajustes mobile para reduzir risco de quebra em telas estreitas.
- Testes de hub, rotas e i18n foram atualizados.
- Blockers globais de lint em Mímica e Top 10 foram corrigidos com mudanças mínimas.
- `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passaram.
- Observação: validação em aparelho Android físico não foi executada neste ambiente e deve ser feita antes de submissão à Play Store.

Verificações da FASE 11:

- Coringa ficou desligado por padrão, mas segue configurável.
- Vitória do Coringa por votação encerra a partida.
- Revelar função ao morrer ficou desligado por padrão e só altera anúncios públicos durante a partida.
- Configuração de autoproteção do Médico ganhou limite de 1, 2, 3 ou sem limites por partida.
- Votação deixou de registrar voto por voto; o mediador marca apenas eliminado ou empate/ninguém saiu.
- Sessões antigas com fluxo de votação anterior são migradas para discussão do dia.
- Card do jogo no hub reforçado sem borda externa.

Verificações da FASE 12:

- Turno dos Assassinos mostra assassinos vivos, permite escolher quem age e remove apenas esse ator da lista de vítimas.
- Outros assassinos continuam podendo ser escolhidos como vítima.
- Médico e Detetive habilitados mas eliminados aparecem como turnos de disfarce para não revelar que saíram.
- Detetive vivo recebe uma etapa privada com resultado antes de o app avançar.
- Resolução da noite ganhou frase pronta para o mediador anunciar se houve assassinato ou não.
- Histórico privado registra o assassino que agiu.

## Princípios de Arquitetura

- Separar regra de jogo da interface.
- Separar tema visual da lógica.
- Usar `RoleKey` fixo para regras internas:
  - `citizen`
  - `killer`
  - `detective`
  - `doctor`
  - `jester`
- Usar `GamePhase` fixo para controlar fluxo:
  - `setup`
  - `revealRoles`
  - `nightIntro`
  - `killerTurn`
  - `doctorTurn`
  - `detectiveTurn`
  - `nightResolution`
  - `dayDiscussion`
  - `voting`
  - `voteResolution`
  - `gameOver`
- Criar funções puras para sorteio, votação, resolução da noite e vitória.
- Criar componentes pequenos por fase.
- Evitar componente gigante.
- Não quebrar jogos existentes.
- Não expor o jogo como disponível antes do fluxo mínimo estar jogável.

## Regras Base

Personagens iniciais:

- **Cidadão:** vota e tenta eliminar assassinos.
- **Assassino:** escolhe uma vítima à noite.
- **Médico:** protege alguém à noite.
- **Detetive:** investiga alguém à noite.
- **Coringa:** vence se for eliminado por votação, opcional.

Condições de vitória:

- Cidade vence se todos os assassinos forem eliminados.
- Assassinos vencem se assassinos vivos forem maiores ou iguais aos inocentes vivos.
- Coringa vence se for eliminado por votação.
- A vitória do Coringa encerra a partida.

Configurações necessárias:

- Médico pode ou não proteger a si mesmo.
- Quando puder se proteger, Médico tem limite de autocura por partida: 1, 2, 3 ou sem limites.
- Médico pode ou não repetir proteção na mesma pessoa.
- Função ao morrer pode ser revelada ou ocultada.
- Votação é conduzida presencialmente e o mediador registra eliminado ou empate/ninguém saiu.
- Empate não elimina ninguém.

## Roadmap de Desenvolvimento

### FASE 1 — Base do jogo

**Status:** concluída.

Entregas:

- Criar tipos principais.
- Criar lista fixa de papéis.
- Criar tema clássico.
- Criar helpers para jogadores, papéis e status.
- Criar funções puras iniciais:
  - `createRoleDeck`
  - `assignRolesToPlayers`
  - `getAlivePlayers`
  - `getAliveKillers`
  - `getAliveInnocents`
  - `canStartGame`
  - `resolveNight`
  - `resolveVotingOutcome`
  - `checkWinCondition`
- Criar testes unitários cobrindo sorteio, noite, votação manual, empate, médico e vitória.

Critérios de aceite:

- Módulo compila sem UI.
- Regras não dependem de nomes visuais.
- Tema não interfere na lógica.
- Testes cobrem os caminhos principais.

### FASE 2A — Configuração pura e presets

**Status:** concluída.

Entregas:

- Criar constantes compartilhadas de mínimo e máximo de jogadores.
- Criar `createDefaultCidadeDormeSettings`.
- Criar recomendação automática de quantidade de assassinos por tamanho de grupo.
- Criar resumo de quantidade de papéis por configuração.
- Criar avisos para composições arriscadas.
- Corrigir `games.registry.ts` para 4 a 12 jogadores mantendo `coming-soon`.
- Cobrir presets com testes unitários.

Critérios de aceite:

- Todos os presets de 4 a 12 jogadores são válidos para iniciar.
- Regras e UI futura usam os mesmos limites.
- O jogo segue indisponível no hub até existir fluxo mínimo jogável.

### FASE 2B — Configuração da partida na UI

**Status:** concluída.

Entregas:

- Criar `CidadeDormeHomeScreen.tsx`.
- Criar `CidadeDormeSetupScreen.tsx`.
- Reaproveitar `players.store`, `playerToParticipant` e convidados temporários.
- Permitir selecionar de 4 a 12 jogadores.
- Permitir adicionar convidados temporários.
- Configurar quantidade de assassinos.
- Ativar ou desativar Médico, Detetive e Coringa.
- Configurar regras:
  - revelar função ao morrer;
  - médico pode proteger a si mesmo;
  - limite de autocura do Médico;
  - médico pode repetir proteção;
  - Coringa opcional.
- Adicionar rotas iniciais, mas manter o jogo como `coming-soon` até haver fluxo jogável.

Critérios de aceite:

- Botão de iniciar só habilita quando `canStartGame()` for válido.
- Configuração inválida mostra erro claro.
- Nenhuma partida é criada com composição impossível.
- Jogos existentes continuam funcionando.

### FASE 3 — Sorteio e revelação individual

**Status:** concluída.

Entregas:

- Criar `cidadeDorme.store.ts`.
- Criar sessão inicial persistida.
- Sortear funções com `assignRolesToPlayers`.
- Criar tela de revelação individual segura.
- Exibir uma função por vez.
- Esconder função por padrão.
- Avançar para o próximo jogador somente depois de ocultar a função atual.
- Não persistir estado visual de segredo visível.

Critérios de aceite:

- Cada jogador vê apenas a própria função.
- A ordem de revelação é controlada pelo app.
- Ao terminar revelações, a partida avança para `nightIntro`.
- Fechar e abrir o app não reabre uma função já visível.

### FASE 4 — State machine

**Status:** concluída.

Entregas:

- Criar `cidadeDorme.stateMachine.ts`.
- Criar `cidadeDorme.stateMachine.test.ts`.
- Definir transições válidas entre fases.
- Criar helpers como:
  - `canTransitionToPhase`
  - `getNextPhase`
  - `advancePhase`
- Centralizar regras de avanço.
- Impedir que componentes manipulem fases de forma solta.

Critérios de aceite:

- Fluxo segue a ordem esperada:
  - configuração;
  - revelação;
  - introdução da noite;
  - assassino;
  - médico;
  - detetive;
  - resolução da noite;
  - discussão;
  - votação;
  - resolução da votação;
  - fim ou próxima noite.
- Transições inválidas são ignoradas ou retornam erro controlado.

Observações:

- A state machine já pula papéis noturnos desativados ou sem jogador vivo.
- `advanceRoleReveal()` agora usa a state machine para entrar em `nightIntro`.
- O store expõe `advancePhase()` para as próximas telas usarem sem manipular `phase` diretamente.

### FASE 5 — Fluxo da noite

**Status:** concluída.

Entregas:

- Criar componentes para:
  - `NightIntroPhase` — concluído na FASE 5A.
  - `KillerTurnPhase` — concluído na FASE 5B.
  - `DoctorTurnPhase` — concluído na FASE 5C.
  - `DetectiveTurnPhase` — concluído na FASE 5D.
  - `NightResolutionPhase` — concluído na FASE 5E.
- Exibir roteiro do mediador.
- Assassino escolhe vítima — concluído na FASE 5B.
- Médico escolhe protegido — concluído na FASE 5C.
- Detetive escolhe investigado — concluído na FASE 5D.
- Resolver noite com `resolveNight` — concluído na FASE 5E.
- Mostrar ao mediador se houve morte ou proteção — concluído na FASE 5E.
- Mostrar resultado da investigação apenas ao mediador — concluído na FASE 5E.

Critérios de aceite:

- Ordem noturna é sempre Assassino, Médico, Detetive.
- Médico respeita configurações de autoproteção e repetição.
- Detetive recebe resultado `suspect` ou `innocent`.
- Jogadores eliminados não aparecem como alvos válidos.
- Ações secretas não vazam para tela pública.

#### FASE 5A — Introdução da noite

**Status:** concluída.

Entregas:

- Criar `NightIntroPhase`.
- Exibir roteiro do mediador antes das ações secretas.
- Avançar de `nightIntro` para `killerTurn` usando a state machine.
- Persistir a nova fase ao iniciar ações noturnas.
- Mostrar tela provisória de `killerTurn` sem selecionar vítima ainda.

Critérios de aceite:

- A tela informa que o celular deve ficar com o mediador.
- O botão de iniciar ações noturnas muda a sessão para `killerTurn`.
- A próxima etapa continua claramente delimitada como FASE 5B.

#### FASE 5B — Turno dos Assassinos

**Status:** concluída.

Entregas:

- Criar `KillerTurnPhase`.
- Listar jogadores vivos como alvos.
- Registrar `killerTargetId` em `currentNightAction`.
- Avançar para Médico, Detetive ou resolução conforme state machine.
- Não mostrar papéis secretos na escolha.

Critérios de aceite:

- Apenas jogadores vivos aparecem como alvos.
- Confirmar vítima persiste a ação noturna.
- A UI não exibe papéis, times ou status secretos.
- O avanço respeita papéis especiais desativados.

#### FASE 5C — Turno do Médico

**Status:** concluída.

Entregas:

- Criar `DoctorTurnPhase`.
- Listar alvos válidos usando `canDoctorProtect`.
- Bloquear autoproteção quando a regra estiver desligada.
- Bloquear repetição da proteção anterior quando a regra estiver desligada.
- Registrar `protectedPlayerId` em `currentNightAction`.
- Avançar para Detetive ou resolução conforme state machine.

Critérios de aceite:

- Apenas jogadores vivos e válidos aparecem como alvos.
- Confirmar proteção persiste a ação noturna.
- A UI não exibe papéis, times ou status secretos.
- O avanço respeita Detetive desativado ou eliminado.

#### FASE 5D — Turno do Detetive

**Status:** concluída.

Entregas:

- Criar `DetectiveTurnPhase`.
- Listar jogadores vivos como investigáveis.
- Registrar `detectiveTargetId` em `currentNightAction`.
- Resolver ou preparar `detectiveResult` como informação privada do mediador.
- Avançar para resolução da noite conforme state machine.

#### FASE 5E — Resolução da noite

**Status:** concluída.

Entregas:

- Criar `NightResolutionPhase`.
- Resolver `currentNightAction` com `resolveNight`.
- Aplicar eliminação noturna quando a vítima não estiver protegida.
- Exibir proteção e morte apenas para o mediador.
- Exibir resultado do Detetive apenas para o mediador.
- Registrar resultado interno da rodada em `history`.

### FASE 6 — Fluxo do dia e votação

**Status:** concluída em fluxo mínimo.

Entregas:

- Criar fase de resultado da noite — concluído na FASE 5E.
- Criar fase de discussão — concluído na FASE 6A.
- Criar votação — concluído na FASE 6A.
- Registrar resultado manual da votação pelo mediador — concluído na FASE 11.
- Tratar empate como nenhuma eliminação — concluído na FASE 11.
- Eliminar jogador escolhido pelo mediador quando aplicável — concluído na FASE 11.

Critérios de aceite:

- Votação não registra voto por voto.
- Empate não elimina ninguém.
- Votação registra resultado de forma compatível com histórico privado.

### FASE 7 — Condições de vitória

**Status:** concluída em fluxo mínimo.

Entregas:

- Integrar `checkWinCondition` após noite e votação — concluído na FASE 7A.
- Encerrar partida quando cidade vencer — concluído na FASE 7A.
- Encerrar partida quando assassinos vencerem — concluído na FASE 7A.
- Encerrar partida quando Coringa vencer — concluído na FASE 11.

Critérios de aceite:

- Cidade vence quando não houver assassinos vivos.
- Assassinos vencem quando assassinos vivos forem maiores ou iguais aos inocentes vivos.
- Coringa vence ao ser eliminado por votação.
- Vitória paralela não encerra a partida automaticamente.

### FASE 8 — Histórico privado do mediador

**Status:** concluída.

Entregas:

- Registrar ações noturnas:
  - alvo do assassino;
  - proteção do médico;
  - investigação do detetive;
  - resultado da noite.
- Registrar votação:
  - votos;
  - skip;
  - empate;
  - eliminado.
- Registrar notas privadas do mediador, se necessário — adiado por não ser necessário para o fluxo atual.
- Criar visualização privada do histórico — concluído.

Critérios de aceite:

- Histórico não é mostrado em telas voltadas aos jogadores.
- Mediador consegue consultar rodadas anteriores.
- Ações secretas continuam privadas.

### FASE 9 — Resultado final

**Status:** concluída.

Entregas:

- Criar `CidadeDormeResultScreen.tsx` — concluído.
- Mostrar vencedor — concluído.
- Mostrar vitórias paralelas, se existirem — concluído.
- Mostrar lista de jogadores e personagens — concluído.
- Mostrar eliminados e sobreviventes — concluído.
- Mostrar resumo da partida — concluído.
- Criar ação para jogar novamente — concluído.
- Criar ação para voltar ao hub — concluído.

Critérios de aceite:

- Resultado é claro para mediador e grupo.
- Papéis são revelados no fim.
- Reiniciar preserva configuração quando fizer sentido.

### FASE 10 — Polimento e lançamento no hub

**Status:** concluída.

Entregas:

- Refinar empate `revoteTied` com uma votação de desempate real — concluído na FASE 10A.
- Refinar empate `mediatorDecision` com escolha explícita do mediador — concluído na FASE 10A.
- Revisar responsividade mobile — concluído em revisão de UI web/mobile.
- Revisar contraste e tamanhos de toque — concluído em revisão de UI.
- Melhorar textos do mediador — concluído.
- Adicionar microinterações e haptics — já existente nos pontos principais do fluxo.
- Criar ou escolher asset visual do jogo — concluído na FASE 10B.
- Adicionar traduções quando o fluxo estiver estável — concluído na FASE 10B.
- Atualizar `games.registry.ts` de `coming-soon` para `available` — concluído na FASE 10B.
- Validar fluxo completo em aparelho real — pendente apenas para checklist físico de release Android.
- Observação: regras de revotação, skip e vitória paralela do Coringa foram substituídas pela simplificação da FASE 11.

Critérios de aceite:

- Partida completa funciona offline.
- Jogo aparece no hub apenas quando jogável.
- Não há regressão nos jogos existentes.
- Build de produção passa.

#### FASE 10A — Desempate e decisão do mediador

**Status:** concluída.

Entregas:

- Criar resolução pura para decisão explícita do mediador em empates.
- Criar ação de sessão/store para iniciar revotação entre empatados.
- Criar ação de sessão/store para aplicar decisão do mediador.
- Restringir votos da revotação aos alvos empatados.
- Atualizar tela de resolução da votação para mostrar ações corretas por regra de empate.
- Cobrir regra e sessão com testes focados.

Critérios de aceite:

- Fluxos de desempate foram entregues na FASE 10A, mas removidos na FASE 11 para acelerar a partida presencial.
- Histórico da rodada mantém o resultado aplicado.
- Jogo continua indisponível no hub até a revisão visual e validação final.

#### FASE 10B — I18n, asset e liberação no hub

**Status:** concluída.

Entregas:

- Criar cover WebP horizontal para o card do hub.
- Registrar namespace `cidade-dorme` no i18n.
- Criar traduções `pt-BR`, `en-US` e `es-419`.
- Trocar textos hardcoded das telas de Cidade Dorme por `useTranslation('cidade-dorme')`.
- Exibir papéis traduzidos sem mudar tipos ou regras internas.
- Atualizar hub/registry/testes para Cidade Dorme disponível.
- Corrigir blockers globais de lint fora de Cidade Dorme.

Critérios de aceite:

- Cidade Dorme aparece no hub como jogo disponível.
- Card do hub usa asset visual real.
- Telas principais funcionam com os três idiomas suportados.
- Testes, typecheck, lint e build passam.
- Validação em aparelho físico fica registrada como etapa externa do checklist Android.

## Ordem Recomendada

1. Refinar empate `revoteTied` com uma votação de desempate real — concluído na FASE 10A.
2. Refinar empate `mediatorDecision` com escolha explícita do mediador — concluído na FASE 10A.
3. Revisar responsividade/textos do fluxo completo — concluído na FASE 10B.
4. Criar ou escolher asset visual do jogo — concluído na FASE 10B.
5. Validar em aparelho real antes de submissão à Play Store — pendente no checklist Android.

## Arquivos Planejados

Arquivos já criados:

- `src/features/cidade-dorme/cidadeDorme.types.ts`
- `src/features/cidade-dorme/cidadeDorme.roles.ts`
- `src/features/cidade-dorme/cidadeDorme.theme.ts`
- `src/features/cidade-dorme/cidadeDorme.rules.ts`
- `src/features/cidade-dorme/cidadeDorme.rules.test.ts`
- `src/features/cidade-dorme/cidadeDorme.setup.ts`
- `src/features/cidade-dorme/cidadeDorme.setup.test.ts`
- `src/features/cidade-dorme/cidadeDorme.session.ts`
- `src/features/cidade-dorme/cidadeDorme.session.test.ts`
- `src/features/cidade-dorme/cidadeDorme.store.ts`
- `src/features/cidade-dorme/cidadeDorme.store.test.ts`
- `src/features/cidade-dorme/cidadeDorme.stateMachine.ts`
- `src/features/cidade-dorme/cidadeDorme.stateMachine.test.ts`
- `src/features/cidade-dorme/useCidadeDormeInitialization.ts`
- `src/features/cidade-dorme/CidadeDormeHomeScreen.tsx`
- `src/features/cidade-dorme/CidadeDormeSetupScreen.tsx`
- `src/features/cidade-dorme/CidadeDormePlayScreen.tsx`
- `src/features/cidade-dorme/components/NightIntroPhase.tsx`
- `src/features/cidade-dorme/components/KillerTurnPhase.tsx`
- `src/features/cidade-dorme/components/DoctorTurnPhase.tsx`
- `src/features/cidade-dorme/components/DetectiveTurnPhase.tsx`
- `src/features/cidade-dorme/components/NightResolutionPhase.tsx`
- `src/features/cidade-dorme/components/DayDiscussionPhase.tsx`
- `src/features/cidade-dorme/components/VotingPhase.tsx`
- `src/features/cidade-dorme/components/MediatorHistoryPanel.tsx`
- `src/features/cidade-dorme/CidadeDormeResultScreen.tsx`
- `src/i18n/locales/pt-BR/cidade-dorme.json`
- `src/i18n/locales/en-US/cidade-dorme.json`
- `src/i18n/locales/es-419/cidade-dorme.json`
- `src/features/cidade-dorme/cidadeDorme.copy.ts`
- `public/assets/games/cidade-dorme.webp`
- `src/app/routes.test.tsx`
- `src/features/games/games.registry.ts`
- `src/i18n/index.ts`
- `src/features/hub/GameCard.tsx`

## Riscos Técnicos

- O fluxo pode virar um componente grande demais se as fases não forem separadas cedo.
- O histórico pode vazar informação secreta se for exibido junto de telas compartilhadas.
- A revelação individual precisa evitar persistir a função aberta.
- Regras do Coringa precisam ser claras para não conflitar com vitória da cidade ou dos assassinos.
- Configurações de Médico precisam ser aplicadas tanto na UI quanto na regra pura.
- O jogo já virou `available`; qualquer mudança futura precisa preservar o fluxo completo e o estado salvo compatível.

## Critério de Pronto do Jogo

O jogo está pronto para aparecer no hub -

- O mediador conseguir configurar uma partida.
- O app conseguir sortear funções válidas.
- Cada jogador conseguir ver sua função individualmente.
- A noite seguir a ordem correta.
- Assassino, Médico e Detetive conseguirem agir.
- A noite for resolvida corretamente.
- A cidade conseguir discutir e votar.
- Empate e skip forem resolvidos conforme configuração.
- Jogadores forem eliminados corretamente.
- Vitória da cidade, dos assassinos e do Coringa forem detectadas.
- Histórico privado estiver disponível para o mediador.
- Resultado final mostrar vencedor e papéis.
- O fluxo completo funcionar offline.
- Testes, typecheck e build passarem.
