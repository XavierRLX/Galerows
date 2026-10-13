# G6 — Pista Única LAN: plano de implementação (12/10/2026)

Autorizado pelo usuário após G5E, sem segundo aparelho. Respeitar `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`; preservar todas as alterações locais e untracked; não tocar main, nem commit/push/deploy/install/dependências.

## Reuso do modo solo
Pista Única local (`src/features/pista-unica/pistaUnica.session.ts`) exige 3–12 participantes, categorias palavras/filmes/séries, adivinhador rotativo, cada outra pessoa escreve uma pista até 48 caracteres, pistas normalizadas e repetidas excluídas e 1 ponto para acerto do adivinhador, 1 rodada por jogador.

## Adaptação LAN com segredos por jogador
- `RegisteredMultiplayerGame` 'pista-unica' com host authoritative, 3–12; config categorias de enum (sem opção vazia, repetidas, desconhecidas).
- GameSession mantém lista de participantes e `targetQueue` gerada e embaralhada no host por `ctx.random`; uma rodada por participante, cada um adivinha uma vez, inclusive host.
- `writing`: adivinhador **não recebe** alvo; demais recebem apenas alvo pelo `projectPrivate`, submetem `SUBMIT_CLUE` individualmente em seus dispositivos; host não pode forçar pista de terceiros. `projectPublic`: turno, progresso e contagem, **sem alvo, textos nem resultado futuro**.
- Pistas duplicadas removidas pela mesma `normalizeClue/getVisiblePistaUnicaClues` do jogo solo; normalização acentos/pontuação/caixa. Conservar apenas a primeira ocorrência distinta. `guessing`: expõe somente pistas únicas ao grupo e aceita `SUBMIT_GUESS` **apenas do adivinhador**. Texto exato da resposta alvo somente em `round-result`/`summary`.
- `round-result`: anuncia alvo e se acertou; host `NEXT_ROUND` avança ao próximo adivinhador e zera pistas, sem revelar o próximo alvo; fim `summary`; `END_GAME` somente na summary. `awardPoints` G5E 0/1 por participante, computado no estado host no final, sem payloads de placar enviados por convidados.
- Evitar banner de palavra secreta na UI sem intenção explícita; esconder em blur/background ou mudança de etapa/reconexão; desabilitar comandos offline.
- Tratamento de zero pistas válidas, jogadores que saem/entram durante GameSession, comandos duplicados/stale, limites de frame 16KiB e mínimo/máximo de jogadores.

## Testes G6
RED→GREEN: adapter Room com jogadores 3..12, projeções sem vazamento para adivinhador e pública; autorizações/submissão duplicada; categorias; deduplicação e diferentes acentos/caixa; fluxo de todas rodadas + game summary + G5E awards e pontuação acumulada; host adivinhador e guest adivinhador; último round; impedimento END prematuro; client replay; late join; frame sizes. UI: desbloquear revelação somente escritor, ocultação em blur e reconexão, adivinhador não vê alvo, host controls, summary e integração lobby.
Gates: `npm test`, typecheck, lint, build release padrão/experimental, git diff --check. Relatório com honestidade: simulado, sem homologação física G5C. Sem G7 Cidade Dorme nesta etapa.
