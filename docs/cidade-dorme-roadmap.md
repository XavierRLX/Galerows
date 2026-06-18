# Roadmap do Cidade Dorme

Atualizado em: 18 de junho de 2026

## Objetivo

Criar o jogo **Cidade Dorme** dentro do Galerows como um assistente offline para o mediador controlar partidas presenciais de dedução social.

O app deve ajudar o mediador a configurar a partida, sortear personagens, revelar funções individualmente, conduzir noite e dia, registrar ações secretas, resolver votações, eliminar jogadores e verificar vitórias automaticamente.

## Estado Atual

**Status:** FASE 1 concluída.

Já existe uma base pura e testável em `src/features/cidade-dorme/`, sem rotas, telas ou exposição no hub.

Arquivos criados na FASE 1:

- `cidadeDorme.types.ts`
- `cidadeDorme.roles.ts`
- `cidadeDorme.theme.ts`
- `cidadeDorme.rules.ts`
- `cidadeDorme.rules.test.ts`

Verificações da FASE 1:

- Teste unitário do módulo passou.
- Typecheck passou.
- Suíte completa passou.
- ESLint dos arquivos novos passou.

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

### FASE 2 — Configuração da partida

**Status:** planejada.

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
- Criar presets automáticos por quantidade de jogadores.
- Adicionar rotas iniciais, mas manter o jogo como `coming-soon` até haver fluxo jogável.

Critérios de aceite:

- Botão de iniciar só habilita quando `canStartGame()` for válido.
- Configuração inválida mostra erro claro.
- Nenhuma partida é criada com composição impossível.
- Jogos existentes continuam funcionando.

### FASE 3 — Sorteio e revelação individual

**Status:** planejada.

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

**Status:** planejada.

Entregas:

- Criar `cidadeDorme.stateMachine.ts`.
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

### FASE 5 — Fluxo da noite

**Status:** planejada.

Entregas:

- Criar componentes para:
  - `NightIntroPhase`
  - `KillerTurnPhase`
  - `DoctorTurnPhase`
  - `DetectiveTurnPhase`
  - `NightResolutionPhase`
- Exibir roteiro do mediador.
- Assassino escolhe vítima.
- Médico escolhe protegido.
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

1. Finalizar FASE 2 para ter entrada e configuração.
2. Implementar FASE 3 para transformar configuração em sessão real.
3. Implementar FASE 4 antes de crescer o fluxo de telas.
4. Implementar FASE 5 e FASE 6 em ciclos pequenos.
5. Integrar FASE 7 assim que noite e votação existirem.
6. Adicionar histórico e resultado final.
7. Polir e só então publicar no hub.

## Arquivos Planejados

Arquivos já criados:

- `src/features/cidade-dorme/cidadeDorme.types.ts`
- `src/features/cidade-dorme/cidadeDorme.roles.ts`
- `src/features/cidade-dorme/cidadeDorme.theme.ts`
- `src/features/cidade-dorme/cidadeDorme.rules.ts`
- `src/features/cidade-dorme/cidadeDorme.rules.test.ts`

Arquivos prováveis nas próximas fases:

- `src/features/cidade-dorme/cidadeDorme.store.ts`
- `src/features/cidade-dorme/cidadeDorme.stateMachine.ts`
- `src/features/cidade-dorme/useCidadeDormeInitialization.ts`
- `src/features/cidade-dorme/CidadeDormeHomeScreen.tsx`
- `src/features/cidade-dorme/CidadeDormeSetupScreen.tsx`
- `src/features/cidade-dorme/CidadeDormePlayScreen.tsx`
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

