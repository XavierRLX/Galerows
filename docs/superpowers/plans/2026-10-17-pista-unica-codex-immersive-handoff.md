# Galerows — Handoff Codex: visual imersivo de Pista Única (17/10/2026)

## Baseline e responsabilidade

O usuário aprovou a opção A de pontuação: adivinhador certo **+2**, cada autor de pista válida **+1** se e somente se ele acertar. Primeiro o Remote Desktop Commander implementou fluxo/contrato, **depois** o Codex fica responsável pela experiência visual do jogo, como a identidade separada de Cidade Dorme e Impostor da Palavra. Utilizar o commit/branch de Pista Única que será informado ao criar o worktree Codex, nunca a main nem o worktree antigo.

Leia o plano `docs/superpowers/plans/2026-10-17-pista-unica-flow-scoring.md` e o código:
- `src/features/multiplayer/pistaUnicaLanGame.ts` e testes — motor LAN e payloads;
- `src/features/multiplayer/lan/lobby/PistaUnicaLanRound.tsx` e testes — interface funcional provisória (substituir visual, não lógica);
- `src/features/pista-unica/PistaUnicaPlayScreen.tsx` — modo um celular e revisão manual;
- `src/features/pista-unica/PistaUnicaResultScreen.tsx` e `PistaUnicaSetupScreen.tsx` — telas do modo compartilhado;
- `src/features/games/GameModeEntry.tsx` — entrada unificada já aprovada, não refazer;
- `src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.tsx`, `ImpostorImmersiveRound.tsx`, CSSs — referências técnicas de imersão e viewport;
- `public/assets/games/pista-unica.png` e `docs/brand/identidade-visual.md` — assets/brand existentes.

## Contrato de jogo LAN (não mudar)

1. `PistaUnicaLanPublic.step`: `writing → review → guessing → round-result → writing (próximo) → summary`; se nenhuma pista válida permanecer automaticamente ou após revisão, passa diretamente para `round-result`. Um adivinhador diferente por rodada, 3–12 participantes; host controla `NEXT_ROUND` e `END_GAME`.
2. `public.guesserId`, `public.reviewerId`, `round`, `totalRounds`, `submittedCount`, `requiredCount` são públicos. **Pistas (`public.clues`) só aparecem em `guessing` ou depois**; antes disso são `[]`. `excludedCount` só aparece após a confirmação. Não usar estado da UI como autoridade.
3. `PistaUnicaLanPrivate.kind='writer' | 'guesser'`. A palavra secreta (`private.target`) vai apenas aos autores, nunca ao adivinhador. A lista `private.reviewClues` é enviada APENAS ao revisor designado, durante a etapa `review`, e cada item tem `playerId`, `text`, `included`, `reason` (`'duplicate'|'answer'|'manual'|null`).
4. Revisão: `SET_CLUE_INCLUDED` com payload `{playerId, included:boolean}`, somente do revisor; pistas anuladas automaticamente por duplicidade ou igualdade à palavra **não podem ser reincluídas**. `CONFIRM_CLUES` com payload `null`. Host é o revisor se for autor de pista; se estiver adivinhando, outro autor é revisor (a UI precisa mostrar instruções diferentes). Convidados não revisores aguardam; **adivinhador nunca vê a palavra nem a lista privada de revisão**.
5. Autor escreve e envia `SUBMIT_CLUE` (`{text}`) uma vez; adivinhador envia `SUBMIT_GUESS` (`{text}`) apenas quando liberado. Conservar proteção de ocultar palavra ao perder foco/ir para background, reconexão e ações bloqueadas por busy/offline.
6. `lastResult` fornece `correct`, `target`, `guessedText`, `clueCount`, `excludedCount`, `creditedPlayerIds` e `awardedPoints`. Exibir +2 para adivinhador correto; +1 a cada autor sobrevivente; erro/sem dicas é 0. `public.scores` agrega pontos de TODAS as rodadas desta partida; não apresentar `awardedPoints` como se fosse placar total.
7. Sessão LAN soma no placar persistente somente após `END_GAME`, e a Room continua disponível para replay ou outro jogo. Os créditos podem superar 2 no total de uma partida Pista Única; não alterar isso.
8. Modo **1 celular**: `pass-clue → write-clue → review → guess → round-result → finished`. Todas as pistas duplicadas são anuladas, e as iguais à palavra também. Revisão manual permite editar/remover; se nenhuma válida, botão provisório `Concluir sem pistas válidas` encerra rodada com zero pontos. `PistaUnicaRoundResult.creditedPlayerIds?` é opcional para suportar save local legado.

## Direção visual desejada

Criar ambiente original de **jogo mobile presencial**, não site/app SaaS. Uma possível linha é **“Oficina das Pistas”**: mesa de cartas/dicas, painel verde-petróleo escuro, detalhes verde-lima `#D2F86A` e lavanda `#B8A0FF`, papeletas ilustradas, luz/sombra com parcimônia, estados de dicas `válida / repetida / igual à resposta / removida manualmente`, revelação dramática do palpite e dos pontos, contagem de jogadores que enviaram e grande protagonismo do adivinhador. Pode melhorar direção artística sem conflitar com a marca: não repetir a logo oficial em cada tela; usar identidade do jogo e suas ilustrações. Diferenciar-se de Cidade Dorme (suspense noturno) e Impostor (suspeita/violeta). **A mesma linguagem visual precisa servir aos modos 1 celular e LAN**, com comportamentos específicos de privacidade, sem duplicar lógica.

Priorizar: missão/identidade, autoria da pista privada, espera e progresso, revisor autorizado, pistas validadas, palpite, revelar acerto/erro e pontos, classificação/replay. Sem segunda sala ou lobby depois do READY. Layout nativo 320/375/430 e alturas pequenas, safe areas, acessibilidade, estados offline/reconexão, botão de retorno e confirmação de ações irreversíveis, animações respeitando reduced-motion.

## Limites e gates

- **Somente interface/UX**: não alterar `pistaUnicaLanGame.ts`, `pistaUnica.session.ts`, `persistentRoom.ts`, modelos de scoring, as regras de outros jogos, room transport, segurança ou contratos públicos/privados. Se achar problema de domínio, documentar e retornar para o executor responsável.
- Isolar worktree e branch, executar Superpowers, TDD na UI, testes para todas fases incluindo reviewer=host vs host=guesser, 0 pistas, pontuação, retomada/reconexão, host/convidado e os dois modos.
- Rodar suíte completa, typecheck, lint, build padrão/LAN e `git diff --check`. Se possível inspecionar visualmente em 320/375/430px sem mockar permissão de acesso a dados confidenciais.
- Commit local isolado, sem merge/push/deploy ou instalação APK. Gate físico LAN pendente.
