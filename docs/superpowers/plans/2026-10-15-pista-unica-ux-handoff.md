# Galerows — Pista Única LAN | Handoff para o próximo ciclo (15/10/2026)

## Contexto e baseline

Os três jogos LAN definidos para o MVP são **Impostor da Palavra**, **Pista Única** e **Cidade Dorme**. Impostor e Cidade Dorme tiveram ciclos recentes de UX imersiva/fechamento. **Pista Única já existe e já passou por uma partida real LAN em 3 aparelhos físicos**, conforme `docs/superpowers/plans/2026-10-13-three-android-physical-gate.md`. Logo, o terceiro ciclo não é uma implementação do zero: é auditoria de experiência, modernização do fluxo e verificação de regressão.

**Fonte do encerramento anterior:** `docs/superpowers/reviews/2026-10-15-cidade-dorme-final-closeout.md`, a partir do commit `b1e0838` na `feat/cidade-dorme-auto-orchestration-01`.

**Abrir um novo branch/worktree para o terceiro ciclo somente no início da execução**, partindo do baseline que contém o Cidade Dorme encerrado (não da `main` defasada). Não tocar arquivos alterados/untracked em `feat/ux-hub-header-brand` sem auditoria e uma decisão explícita de integração. Nenhum push/merge/deploy automático.

## Regras/contratos existentes que não podem regredir

- `src/features/multiplayer/pistaUnicaLanGame.ts`: reducer/adapter autoritativo no host; 3–12 jogadores, categorias Palavras/Filmes/Séries, uma vez como adivinhador por jogador.
- `src/features/multiplayer/lan/lobby/PistaUnicaLanRound.tsx`: UI atual (pistas individuais, desafio secreto, resposta e transição).
- `src/features/multiplayer/lan/lobby/LobbyRoomView.tsx` e `lobbyView.ts`: configuração da sala e integração do jogo.
- Segredo fica **somente no snapshot privado** de cada autor, nunca no do adivinhador até a fase apropriada. Pistas com até 48 caracteres; normalização remove duplicatas. Palpite é enviado pelo próprio adivinhador; pontos computados pela Room, não pelo cliente.
- Pontuação compartilhada com Impostor/Cidade Dorme, entrada de novos membros apenas na próxima rodada e limite de frame LAN de 16 KiB.
- O relatório G6 inicial diz que o host autoriza `NEXT_ROUND`; uma eventual automação dessa transição altera regras de UX e precisa de especificação e testes, não de alterações oportunistas.

## Próximo ciclo proposto — ordem e gates

**P0 — Auditoria sem alteração de código**
- Validar `git status --short --branch`, ancestry, worktrees, pacote Android instalado e código fonte efetivo; não confundir o app de teste `com.galerows.app.secureprobe` com o app público ou com o servidor Vite das outras worktrees.
- Ler o fluxo atual em `PistaUnicaLanRound.tsx`, `pistaUnicaLanGame.ts`, `LobbyRoomView.tsx`, testes G6 e `docs/superpowers/plans/2026-10-12-g6-pista-unica-lan-plan.md`.
- Mapear cada tela do **host/adivinhador** e dos **autores**, nas fases `writing → guessing → round-result → summary`; identificar cliques redundantes, esperas sem feedback e diferenças de UX frente aos dois jogos encerrados.

**P1 — Especificação UX, aprovação antes da implementação**
- Tela de identidade/rodada no próprio aparelho, sem segundo lobby; cartão secreto somente para autores e sempre oculto por padrão, inclusive após background.
- Exibir com clareza o adivinhador atual, quem ainda precisa enviar pista, o status de entrega e o momento em que a tentativa está liberada; não divulgar pistas privadas antes do momento correto.
- Feedback de pista vazia, inválida, duplicada, indisponível, timeouts e reconexão; resultado visível para todos sem vazamento antes da hora.
- Manter host jogador e progresso da sala; decidir explicitamente se `NEXT_ROUND` continuará manual ou será autorizado pelo host automaticamente após tempo/ACK.
- Preferir experiência mobile imersiva e consistente com Impostor/Cidade Dorme, com critérios verificáveis em 320/375/430 px e acessibilidade.

**P2 — TDD e mudanças pequenas**
- Testes RED/GREEN do adapter somente se houver regra de jogo nova; priorizar `PistaUnicaLanRound.test.tsx`, `LobbyRoomView.pistaLan.test.tsx` e regressões de `pistaUnicaLanGame.test.ts`.
- Verificar comportamento de troca de fase e reinício de `GameSession` (inclusive replay/volta ao lobby), desmontagem de UI, eventos repetidos e cancelamento de ações antigas. Não reutilizar a solução de áudio do Cidade Dorme se Pista Única não tem narrador.
- Confirmar invariantes de privacidade entre projeções pública/privada e rejeição de comandos fora de fase no host.

**P3 — Gates físicos e encerramento**
- `npm test`, `npm run typecheck`, `npm run lint`, build LAN com `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`, `git diff --check`.
- Smoke em S26 FE, S23 e Moto G6 + emulador quando fizer sentido: 3 rodadas, papéis rotativos, envio de todas as pistas, deduplicação, acerto/erro, `NEXT_ROUND`, resultado, placar e retorno à mesma sala.
- Medir reconexão, entrada tardia e layout nas larguras reais. Evidências sem registrar palavras secretas, QR assinado ou fingerprints.
- Commit por gate concluído; sem alteração de `main`, app público ou deploy sem decisão de integração.

## Critérios de aceite para o terceiro ciclo

O proprietário conclui uma partida de Pista Única com os 3+ jogadores em celulares separados, sem precisar explicar o fluxo manualmente, com segredo preservado, etapas claras, pontuação certa e opção de continuar na mesma sala. Artefatos esperados: relatório de auditoria P0, spec UX aprovada, testes RED/GREEN, gate físico e closeout. **Não começar implementação na presente tarefa de encerramento do Cidade Dorme.**

## Prompt de retomada sugerido

> Continue o Galerows pelo terceiro ciclo de UX multiplayer: Pista Única LAN. Leia `docs/superpowers/reviews/2026-10-15-cidade-dorme-final-closeout.md` e `docs/superpowers/plans/2026-10-15-pista-unica-ux-handoff.md`. Use Remote Desktop Commander e Superpowers, audite todas as worktrees e preserve alterações locais. Parta do baseline fechado de Cidade Dorme `b1e0838`, criando branch/worktree isolada. Primeiro faça somente P0 (auditoria do adapter e fluxo real de Pista Única), reporte riscos e proposta de UX. Não codifique nem publique antes de um gate de design.
