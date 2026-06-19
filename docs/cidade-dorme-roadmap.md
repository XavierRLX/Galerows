# Roadmap do Cidade Dorme

Atualizado em: 18 de junho de 2026

## Objetivo

Criar o jogo **Cidade Dorme** dentro do Galerows como um assistente offline para o mediador controlar partidas presenciais de dedução social.

O app deve ajudar o mediador a configurar a partida, sortear personagens, revelar funções individualmente, conduzir noite e dia, registrar ações secretas, resolver votações, eliminar jogadores e verificar vitórias automaticamente.

## Estado Atual

**Status:** FASE 5C concluída.

Já existe uma base pura e testável em `src/features/cidade-dorme/`, sem rotas, telas ou exposição jogável no hub.

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
- Turnos noturnos pulam Médico ou Detetive quando desativados ou eliminados.
- Avanço de nova rodada reinicia ação noturna e votos temporários.
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
- A escolha salva `killerTargetId` em `currentNightAction`.
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
- No modo `instant`, a vitória do Coringa encerra a partida.
- No modo `parallel`, o Coringa vence em paralelo e a partida pode continuar.

Configurações necessárias:

- Médico pode ou não proteger a si mesmo.
- Médico pode ou não repetir proteção na mesma pessoa.
- Função ao morrer pode ser revelada ou ocultada.
- Votação pode permitir skip.
- Empate pode gerar nenhuma eliminação, nova votação ou decisão do mediador.

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
  - `resolveVoting`
  - `checkWinCondition`
- Criar testes unitários cobrindo sorteio, noite, votação, empate, skip, médico e vitória.

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
  - permitir skip;
  - regra de empate;
  - médico pode proteger a si mesmo;
  - médico pode repetir proteção;
  - modo de vitória do Coringa.
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

**Status:** em andamento. FASE 5C concluída.

Entregas:

- Criar componentes para:
  - `NightIntroPhase` — concluído na FASE 5A.
  - `KillerTurnPhase` — concluído na FASE 5B.
  - `DoctorTurnPhase` — concluído na FASE 5C.
  - `DetectiveTurnPhase`
  - `NightResolutionPhase`
- Exibir roteiro do mediador.
- Assassino escolhe vítima — concluído na FASE 5B.
- Médico escolhe protegido — concluído na FASE 5C.
- Detetive escolhe investigado.
- Resolver noite com `resolveNight`.
- Mostrar ao mediador se houve morte ou proteção.
- Mostrar resultado da investigação apenas ao mediador.

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

**Status:** próxima.

Entregas:

- Criar `DetectiveTurnPhase`.
- Listar jogadores vivos como investigáveis.
- Registrar `detectiveTargetId` em `currentNightAction`.
- Resolver ou preparar `detectiveResult` como informação privada do mediador.
- Avançar para resolução da noite conforme state machine.

### FASE 6 — Fluxo do dia e votação

**Status:** planejada.

Entregas:

- Criar fase de resultado da noite.
- Criar fase de discussão.
- Criar votação.
- Permitir voto em jogador vivo.
- Permitir skip se configurado.
- Resolver votação com `resolveVoting`.
- Tratar empate conforme regra:
  - nenhuma eliminação;
  - nova votação;
  - decisão do mediador.
- Eliminar jogador mais votado quando aplicável.

Critérios de aceite:

- Votos inválidos são ignorados ou bloqueados pela UI.
- Skip só aparece quando permitido.
- Empate respeita configuração escolhida.
- Votação registra resultado de forma compatível com histórico.

### FASE 7 — Condições de vitória

**Status:** planejada.

Entregas:

- Integrar `checkWinCondition` após noite e votação.
- Encerrar partida quando cidade vencer.
- Encerrar partida quando assassinos vencerem.
- Encerrar partida quando Coringa vencer em modo `instant`.
- Registrar vitória paralela do Coringa em modo `parallel`.

Critérios de aceite:

- Cidade vence quando não houver assassinos vivos.
- Assassinos vencem quando assassinos vivos forem maiores ou iguais aos inocentes vivos.
- Coringa vence ao ser eliminado por votação.
- Vitória paralela não encerra a partida automaticamente.

### FASE 8 — Histórico privado do mediador

**Status:** planejada.

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
- Registrar notas privadas do mediador, se necessário.
- Criar visualização privada do histórico.

Critérios de aceite:

- Histórico não é mostrado em telas voltadas aos jogadores.
- Mediador consegue consultar rodadas anteriores.
- Ações secretas continuam privadas.

### FASE 9 — Resultado final

**Status:** planejada.

Entregas:

- Criar `CidadeDormeResultScreen.tsx`.
- Mostrar vencedor.
- Mostrar vitórias paralelas, se existirem.
- Mostrar lista de jogadores e personagens.
- Mostrar eliminados e sobreviventes.
- Mostrar resumo da partida.
- Criar ação para jogar novamente.
- Criar ação para voltar ao hub.

Critérios de aceite:

- Resultado é claro para mediador e grupo.
- Papéis são revelados no fim.
- Reiniciar preserva configuração quando fizer sentido.

### FASE 10 — Polimento e lançamento no hub

**Status:** planejada.

Entregas:

- Revisar responsividade mobile.
- Revisar contraste e tamanhos de toque.
- Melhorar textos do mediador.
- Adicionar microinterações e haptics.
- Criar ou escolher asset visual do jogo.
- Adicionar traduções quando o fluxo estiver estável.
- Atualizar `games.registry.ts` de `coming-soon` para `available`.
- Validar fluxo completo em aparelho real.

Critérios de aceite:

- Partida completa funciona offline.
- Jogo aparece no hub apenas quando jogável.
- Não há regressão nos jogos existentes.
- Build de produção passa.

## Ordem Recomendada

1. Implementar FASE 5D: seleção do Detetive e resultado privado.
2. Implementar FASE 5E: resolução da noite com `resolveNight`.
3. Implementar FASE 6 em ciclos pequenos para discussão e votação.
4. Integrar histórico privado do mediador.
5. Integrar resultado final e só então publicar no hub.

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

Arquivos prováveis nas próximas fases:

- `src/features/cidade-dorme/CidadeDormeResultScreen.tsx`
- `src/features/cidade-dorme/components/*`
- `src/i18n/locales/pt-BR/cidade-dorme.json`
- `src/i18n/locales/en-US/cidade-dorme.json`
- `src/i18n/locales/es-419/cidade-dorme.json`

Arquivos globais a alterar futuramente:

- `src/app/routes.tsx`
- `src/features/games/games.registry.ts`
- `src/lib/storage/storage.keys.ts`
- `src/i18n/index.ts`

## Riscos Técnicos

- O fluxo pode virar um componente grande demais se as fases não forem separadas cedo.
- O histórico pode vazar informação secreta se for exibido junto de telas compartilhadas.
- A revelação individual precisa evitar persistir a função aberta.
- Regras do Coringa precisam ser claras para não conflitar com vitória da cidade ou dos assassinos.
- Configurações de Médico precisam ser aplicadas tanto na UI quanto na regra pura.
- O jogo só deve virar `available` quando uma partida completa puder terminar.

## Critério de Pronto do Jogo

O jogo estará pronto para aparecer no hub quando:

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
