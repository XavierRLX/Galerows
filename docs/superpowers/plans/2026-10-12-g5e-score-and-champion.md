# G5E — placar LAN acumulado e campeão (execução sem segundo aparelho)

## Escopo autorizado
Usuário autorizou continuar sem segundo dispositivo; G5C físico fica pendente. Desenvolver no Mac via TDD um placar autoritativo de sessão (uma Room, várias GameSessions) com pontuação acumulada, participação individual e ganhos de equipe atribuíveis por adapter, pódio final e empate, sem banco/contas/histórico permanente. Atestar resultado apenas por testes automatizados até verificação física.

## Design
- Pontos são **calculados pelo adapter do jogo dentro do host**, nunca enviados em payload pelo cliente. Cada adapter jogável fornece pontuação **0–2 por jogador por partida** no encerramento. Testes sintéticos (`toy`/`counter`) continuam sem pontuar. Impostor pontua 2 para vencedor solo, 1 para cada integrante vitorioso do grupo.
- `Room` possui histórico mínimo em memória da **competição da sala**: partidas pontuadas e placar por playerId. Novos membros começam em zero, desconexão não remove dados e saída terminal mantém placar com nome estável. Contar pontuação **exatamente uma vez** no `END_GAME`; `RETURN_TO_LOBBY` limpa segredos da GameSession, não o placar.
- `FINISH_SESSION` é comando de Room **só para host** e **apenas lobby após pelo menos uma partida pontuada**; bloqueia novas partidas, anuncia todos os líderes empatados, não fecha automaticamente o socket da sala. O botão de encerrar sala existente continua independente.
- Scoreboard público pequeno em `RoomStatePublicV2`; sem armazenamento permanente ou secrets; snapshots e eventos sujeitos ao limite de 16KiB.
- UI do lobby: mostrar placar ordenado, número de partidas, botão `Encerrar disputa` somente no lobby pelo host, campeão(s), bloqueio de seleção de novos jogos quando finalizada. Ações de RoomSessionProvider seguem o caminho autenticado existente.
- G6 Pista Única / G7 Cidade Dorme usarão o mesmo contrato de awards de 0–2 pontos, inclusive múltiplos vencedores por equipes.

## Gates
1. RED/GREEN: simular Impos 3+ jogadores + novas rodadas, não duplificar `END_GAME`, preservar score entre lobby, manter pontos de ausentes, final empate, guest unauthorized, comandos tardios, sem pontos sintéticos, payload inválido, projeções iguais sem segredos, snapshot 12 jogadores.
2. UI testes e regressão dos 601 atuais.
3. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` padrão e experimental, `git diff --check`.
4. Relatório gate. Branch `feat/multiplayer-lan-task1-wss` HEAD `fd8cc5c`, preservar main e tudo o que já está sujo. **Não** instalar/deploy/commit/push/merge, nem iniciar G6 sem concluir e revisar.
