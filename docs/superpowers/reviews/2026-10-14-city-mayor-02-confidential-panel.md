# CITY-MAYOR-02 — Painel e consulta confidencial do prefeito

Data: 2026-10-14. Branch: `feat/cidade-dorme-core-01`.
Worktree isolado: `/Users/renanxavier/Documents/GitHub/galerows-city-core`.
Spec aprovada: `docs/superpowers/designs/2026-10-14-cidade-dorme-prefeito-traitor-jester.md`.
Dependência concluída: `CITY-MAYOR-01` (`88e0ba0`).

## Escopo entregue

- Painel do prefeito humano aparece somente quando o host seleciona `Cidade Dorme / Com prefeito`. É diferente da interface dos jogadores, sem botão de papel próprio ou opção de votar.
- Status da fase, número de jogadores vivos/conectados, quantidade de papéis confirmados e de votos emitidos, instruções para narrar e comandos permitidos da fase.
- Roteiro em destaque acionado por `Repetir instrução`, para leitura **humana**. Não reproduz som nem implica narrador automático implementado.
- Comandos LAN `PAUSE_CITY` e `RESUME_CITY` disponíveis apenas ao prefeito designado, com validação no core; durante pausa, nenhum papel é confirmado, voto é enviado, ação noturna é processada ou fase avança. Sala e resultado histórico permanecem intactos.
- Consulta `Consultar papéis e ações` exige confirmar que o dispositivo está privado. A interface pede `OPEN_MAYOR_SECRETS` no escopo Room, recebe projeção autenticada somente no host e mostra papéis, vivos/eliminados, ordem de sucessão e ações noturnas realizadas.
- `CLOSE_MAYOR_SECRETS` encerra a autorização; a UI oculta imediatamente em fechar, perda de foco ou app em segundo plano. A própria visualização fecha após no máximo 30 segundos a partir da abertura, sem reiniciar contador por rerender.
- No servidor, a autorização também expira após 30 segundos pelo relógio da Room; desconexão limpa a autorização, e reconexão não reabre a consulta. Abrir novamente após a expiração cria nova projeção e prazo.
- Dados da consulta são de projeto `projectModerator` exclusivo do jogo Cidade Dorme; não entram em `projectPublic`. `privateState` de convidado continua contendo apenas sua identidade permitida. Host-jogador do modo automático não possui consulta.
- Comandos de consulta fora da fase de jogo, com payload não-nulo, emitidos por convidados ou host no modo automático são rejeitados.

## TDD / regressão

- RED antes do código: três testes de consulta e isolamento quebraram inicialmente (`/tmp/city-mayor2-red.log`), testes da UI falharam sem o componente (`/tmp/city-mayor02-ui-red.log`), teste de expiração falhou sem TTL (`/tmp/city-mayor02-expiry-red.log`), teste de pausa falhou antes do comando (`/tmp/city-mayor02-pause-red.log`), teste de repetição falhou antes do controle (`/tmp/city-mayor02-repeat-red.log`).
- GREEN e integração: `cidadeDormeMayorAuthority.test.ts`, `CidadeDormeMayorPanel.test.tsx` e `LobbyRoomView.cidadeLan.test.tsx`.
- Regressão final: `npm test` — **768/768 testes, 131 arquivos PASS** (`/tmp/city-mayor02-release-tests.log`).
- `npm run typecheck` PASS (`/tmp/city-mayor02-release-type.log`).
- `npm run lint` PASS sem erros (`/tmp/city-mayor02-release-lint.log`). Havia problema de `react-hooks/set-state-in-effect`; correção incluiu callback/tempo absoluto, remontagem no contexto da Room.
- Build LAN `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` PASS (`/tmp/city-mayor02-release-build.log`).
- `git diff --check` PASS. Gate final: `0/0/0/0/0`.

## Limites e riscos restantes

- A consulta é projetada somente ao host autenticado na Room, mas, durante a janela autorizada, informações confidenciais estão em sua memória e na UI. O usuário deve evitar expor a tela. A remoção imediata da tela não implica apagamento forense da memória.
- A duração de 30 segundos no servidor é aplicada a novas projeções/snapshots; o cliente também encerra a visualização local com timeout e comando CLOSE.
- A pausa impede comandos do núcleo enquanto ativa, mas a sincronização de áudio, clocks de fases e recuperação automática de host não foram implementadas.
- As configurações LAN de médico/autoproteção e a narração automática com áudio offline ainda NÃO têm paridade/implementação total.
- Sem teste físico do painel em quatro ou cinco dispositivos. Cinco dispositivos são necessários para prefeito dedicado + quatro jogadores atuais; os testes presentes são automatizados.
- Nenhuma modificação na `main`, push, deploy, `capacitor sync`, instalação de APK ou troca da versão Live dos aparelhos.

## Próxima tarefa

`CITY-SETTINGS-01` — paridade de configurações e validações com modo de um celular (incluindo regras de proteção e 1–3 integrantes assassinos), testes de compatibilidade de configurações antigas, UX de configuração condensada no lobby. Depois `CITY-ORCHESTRATION-01`: UI imersiva e narração/áudio offline sincronizados entre aparelhos.
