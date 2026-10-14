# Galerows — Melhorias aprovadas de lobby e Impostor

Data: 14/10/2026. Estado: implementação e regressão automatizada concluídas em workspace isolado; pendente aplicar no repositório vivo e homologar aparelhos.

## Isolamento e segurança do trabalho

- Repositório vivo: `/Users/renanxavier/Documents/GitHub/galerows`, branch `feat/ux-hub-header-brand`, HEAD `8ec6a01`, com alterações locais pré-existentes.
- O servidor de teste `vite --host 0.0.0.0 --port 4182` atende quatro dispositivos em uma Room real. Alterar o código servido agora dispararia HMR que pode encerrar a Room.
- O trabalho foi feito em `/tmp/galerows-ux-20261014`, gerado pela cópia do código atual (incluindo alterações não commitadas), excluindo `node_modules`, `.git` e artefatos. `node_modules` é um symlink de leitura/execução da dependência do repositório.
- NÃO foi feito commit, push, merge, checkout, reset, stash, install Android, sync Capacitor, reconfiguração de serviço, deploy ou fechamento da Room.
- Exportar somente os arquivos modificados para um staging durável fora do repo, com manifesto e hashes de baseline. Aplicar quando a Room de quatro pessoas tiver terminado.

## Lobby

- `SET_DISPLAY_NAME`: comando autoritativo de membro autenticado, aceita somente `{name}`, 1–32 caracteres após normalização, recusa controles, não autoriza alterar o `playerId` alheio; altera apenas o próprio `displayName` e o mesmo registro no placar.
- UI para editar o próprio nome. O nome fica salvo em `@capacitor/preferences`, chave `galerows:lan:myDisplayName`, e reaplica na próxima sala, sem bloquear admissão em caso de falha de armazenamento.
- Host mantém role e o identificador discreto `Host` na partida e `Anfitrião` na lista.
- Lista de participantes inicialmente fechada, acionada por resumo compacto `Jogadores · N`; overlay fecha ao tocar fora, tem rolagem interna e botão de fechamento.
- Placar disponível no topo ao expandir o ícone de troféu; começa a aparecer quando existe pontuação.
- `REPLAY_GAME` host-only: após `END_GAME` aceita replay direto sem voltar ao lobby, conserva membros, configuração e placar acumulado, cria ID de GameSession e segredos novos. Recusa se estiver desconectado algum participante da partida.
- `Voltar ao lobby` continua separado de `Jogar novamente`, e o retorno para o lobby exige comando existente `RETURN_TO_LOBBY`.

## Impostor LAN

- Perguntas guiadas: agora a mesma pergunta por GameSession é distribuída a todos, e é exibida no estado público como texto inofensivo; o host pode trocá-la antes de liberar o voto via `NEXT_QUESTION`. Perguntas espontâneas presenciais são sempre permitidas.
- Quando todos visualizam a identidade, um banner avisa o grupo; `DRAW_FIRST_SPEAKER` é host-only, escolhe aleatoriamente outro primeiro jogador sem mudar a identidade secreta.
- `scoringMode` opcional `classic|individual`; ausência significa `classic`, mantendo compatibilidade do fluxo anterior. UI expõe ambas as opções.
- No modo individual, cada voto correto de não impostor = +1. Se a maioria absoluta dos participantes acertar, quem votou corretamente ganha +1 adicional. Impostor recebe +1 se escapar da acusação final e +1 se acertar a palavra.
- Após votação individual, nova fase `final-guess` não revela o segredo da palavra; apenas o impostor tem permissão de enviar palpite, e o host pode encerrar sem palpite. Depois o resultado mostra pontuação. Em rodada clássica, a fase segue como antes.
- Runoff continua existindo após empate; última votação define os acertos. END_GAME registra pontos somente uma vez.

## Um celular (sem votação digital)

- Pergunta guiada igual para todos, com troca no início de cada rodada; ordem de primeira fala pode ser novamente sorteada.
- Aviso `Todos visualizaram` após todos passarem o único celular.
- Configuração de pontos `classic|individual` opcional e sessão schema v1 preservada (campos novos opcionais).
- Pontuação individual: amigos votam presencialmente como antes. Após a tentativa de adivinhar a palavra, só UMA pessoa marca quais votaram corretamente; não há envio de voto por celular individual.
- +1 por acerto, +1 extra para acertadores com maioria absoluta, +1 impostor se acusado coletivo errado, +1 por palavra correta.
- Testes de sessão legada sem `scoringMode` e sem temporizador continuam válidos.

## Evidências

- TDD RED antes de implementar: três testes do núcleo LAN falharam como esperado; testes de pergunta compartilhada e pontos locais também falharam antes das mudanças.
- Núcleo LAN: `impostorUserEnhancements.test.ts` (3).
- Painéis de lobby: `LobbyCompactPanels.test.tsx` (3).
- Modo local: `impostorManualScoring.test.ts` (2); regressão modificada para pergunta única.
- Regressão completa: **731/731 testes em 125 arquivos PASS** (`/tmp/galerows-ux-final-suite.log`).
- Verificação FINAL, após os últimos ajustes de UI: `npm test` PASS **731/731**, `npm run lint` PASS sem avisos, `npm run typecheck` PASS, build LAN (`VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`) PASS. Logs: `/tmp/galerows-ux-release-tests.log`, `/tmp/galerows-ux-release-lint.log`, `/tmp/galerows-ux-release-types.log`, `/tmp/galerows-ux-release-build.log`.
- TypeScript PASS; LAN build PASS (`VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`, `/tmp/galerows-ux-final-build.log`), com ajustes cosméticos posteriores a revalidar antes de aplicar.
- Não foi feita homologação física dos novos componentes. Na última inspeção dos quatro dispositivos, S23 apresentava somente o host (1 membro); S26 FE, Moto G6 e emulador mostravam os 4 membros de uma Room anterior, mas estado **Sem conexão**. A causa dessa alteração de sessão não está diagnosticada. O servidor Vite original seguia ativo em 4182; não foram copiados arquivos de implementação para o repositório servido.

## Gates seguintes

1. Concluído: regressão e build final aprovados; exportar manifesto durável com hashes e cópias dos 22 arquivos novos/alterados.
2. Usuário encerra a Room de quatro dispositivos ou autoriza seu reinício; só então aplicar arquivos do pacote de staging ao repo vivo após validar hashes baseline, e sem sobrescrever mudanças concorrentes.
3. Homologação real em S23 + S26 FE + Moto G6 + emulador: nomes persistentes, painéis roláveis e clique fora, pergunta unificada, sorteio, replay, votos e bônus.
4. Revisar Git e separar commits pequenos. Não publicar iOS nem declarar release pública sem gate físico.
