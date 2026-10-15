# CITY-AUTOPILOT-01 — Narração automática e orquestração do Cidade Dorme

**Data:** 2026-10-15
**Branch isolada:** feat/cidade-dorme-auto-orchestration-01
**Base:** 0f7a9da (Cidade Dorme imersivo pós-lobby)
**Worktree:** /Users/renanxavier/Documents/GitHub/galerows-city-orchestration
**Plano:** docs/superpowers/plans/2026-10-15-city-autopilot-01.md

## Âmbito entregue

- Apenas o modo **Todos jogam / automatic** usa o planejador de fases. O modo **Prefeito humano / mayor** conserva a autoridade manual, o painel privado e as regras pré-existentes. Configurações LAN antigas sem conductionMode mantêm sua compatibilidade manual.
- O toque real em **Iniciar partida**, no dispositivo host, inicializa a narração. A reprodução ocorre somente no host; os demais jogadores acompanham a legenda pública derivada da fase autoritativa.
- O planejador puro decide OPEN_PHASE, START_NIGHT, START_DISCUSSION, START_VOTE, RESOLVE_VOTE, NEXT_NIGHT e END_GAME. Apenas o host envia comandos à Room; o servidor valida a fase, a participação e tempos mínimos, inclusive se o host estiver jogando. Os comandos repetidos são amortecidos no cliente e o redutor rejeita saltos inválidos.
- Novas barreiras servidor-side bloqueiam KILL, PROTECT, INVESTIGATE e CAST_VOTE até que a instrução inicial seja liberada. A interface imersiva também oculta os alvos antes da autorização e retira os controles de avanço manual do host-jogador.
- Nova fase **detective-result**: o Detetive acessa a informação **somente na projeção privada** e confirma ACK_INVESTIGATION. A confirmação depende da liberação do host e do tempo mínimo; outros jogadores enxergam apenas que a investigação está sendo lida.
- Áudio offline: 14 arquivos AAC/M4A no total; adicionados detective-result, morning-death, morning-survived, vote-eliminated e vote-tie. A legenda inclui o nome do eliminado quando existente. Quando existe uma voz portuguesa **instalada localmente no aparelho**, a API speechSynthesis pode falar o nome; se não houver, a instrução genérica gravada e o nome na tela continuam disponíveis, sem rede/TTS externo.
- Reprodução única por GameSession/phaseEventId. O host espera o término da fala gravada e eventual complemento local, além do tempo mínimo, para dar andamento à fase. Voz interrompida por perda de foco / background não pode liberar um comando automaticamente; há **Retomar narração** em gesto explícito.
- O período de discussão é de cerca de 35 s, votação espera todos os votos, anúncio do resultado tem intervalo mínimo, detetive exige leitura/aceite, e o capítulo inicial passou de ~1,6 s para ~3,2 s.
- Amanhecer e apuração não são pulados quando a noite ou o voto determinam o vencedor. O resumo final mostra os papéis e o histórico de cada rodada com tentativa do assassino, alvo do médico, investigação, empate e votos.
- Repetir a proteção do mesmo jogador em noites consecutivas passou a ser permitido por padrão, independentemente dos limites separados de autoproteção.
- O estado autoritativo preserva até 40 rodadas internamente; por limite de **16 KB** do protocolo, o resumo público apresenta **as últimas 12 rodadas** e informa quando rodadas antigas foram omitidas. O projeto ainda não fornece paginação de histórico, portanto não se deve anunciar consulta de todo o histórico em partidas excepcionalmente longas.

## Evidência TDD e validação

Foram observadas falhas RED antes de cada implementação nos testes de redutor/autopilot, interface de voto e pista do Detetive, continuidade de áudio, reprodução com voz local, bloqueio da tela enquanto a narração não termina, retomada após blur, e tamanho de snapshot (40 rodadas, 12 participantes, até 12 votos/rodada). Os cenários passaram a GREEN após ajustes.

**Gates completos finais (última execução):**
- npm test: **829/829 aprovados; 141/141 arquivos** — /tmp/city-autopilot-final2-tests.log
- npm run typecheck: **PASS** — /tmp/city-autopilot-final2-ts.log
- npm run lint: **PASS sem erros/avisos** — /tmp/city-autopilot-final2-lint.log
- VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build: **PASS** — /tmp/city-autopilot-final2-build.log
- git diff --check: **PASS** — todos com exit code 0

O motor de outros jogos, incluindo Impostor, foi coberto pela regressão e seus arquivos de implementação não foram modificados.

## Riscos e gates restantes

1. **Android físico:** não foram instalados APKs ou executadas partidas completas com esta branch. Necessário testar o S23 host+jogador, S26 FE, Moto G6 e emulador na mesma Room após integração controlada. Medir fim do áudio, autorização das ações e desvio das legendas.
2. **Áudio mobile:** o gesto de Iniciar partida solicita autorização de áudio, mas WebView pode negar reprodução em determinados estados. Confirmar comportamento de voz local, volume, perda e retomada de foco, chamada recebida e reconexão em cada modelo.
3. **Reconexão:** não há migração do host nem eleição de outro anfitrião; sem host conectado, a Room não consegue avançar. Retomar narração requer gesto para prevenir saltos silenciosos.
4. **Histórico:** resumo público limitado a 12 últimas rodadas para cumprir 16 KB; se for obrigatório recuperar todas as rodadas em jogos de muitos empates, implementar consulta paginada autenticada.
5. **UX:** tempos de fala/intervalos são ponto inicial para homologação, não foram cronometrados em hardware. A voz macOS gerada localmente deverá ser revisada por naturalidade e licença de redistribuição antes de distribuição comercial.
6. **Segurança:** o histórico e as ações confidenciais não são enviados à projeção pública antes do resumo; o prefeito conserva consulta privilegiada separada.
7. **Isolamento:** sem alterações em main, na branch Live feat/ux-hub-header-brand ou no servidor Live 4183; sem push, merge, deploy, Capacitor sync ou reinstalação.
