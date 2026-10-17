# Pista Única — Regras, revisão e pontuação (17/10/2026)

## Objetivo aprovado

Atualizar **o fluxo e a lógica**, mantendo a parte visual imersiva para o Codex em fase posterior. Um adivinhador por rodada; demais autores enviam uma pista cada. Pistas iguais normalizadas entre si: **TODAS** são anuladas (sem privilegiar o primeiro envio). Pistas com texto exatamente igual à palavra secreta (ignorando acento, caixa e pontuação) também são anuladas. Uma pista pode ser removida manualmente na etapa de revisão. Adivinhador que acertar: +2; **cada autor de pista válida que sobrevive à filtragem e à revisão: +1, somente se o adivinhador acertar**. Sem acerto / nenhuma pista válida: 0 para todos. O adivinhador não pode inspecionar a palavra antes do resultado.

## Decisões de domínio

- Em modo 1 celular: a etapa de revisão atual é preservada e o facilitador pode editar ou remover pistas; revisão sem dicas válidas permite encerrar rodada sem pontuação. O filtro de duplicata e igualdade à resposta independe do estado de inclusão.
- Em LAN, introduzir etapa `review` entre `writing` e `guessing` com `reviewerId` entre os autores (host se ele for escritor; caso contrário o primeiro escritor na ordem da sala). O revisor só pode desligar/religar manualmente uma pista que não foi automaticamente invalidada; ninguém pode religar duplicatas nem pistas iguais à palavra. A lista de revisão, incluindo autoria, permanece **somente** no snapshot privado do revisor. Snapshot público não inclui palavra nem textos de pistas até `guessing`.
- Com todas as pistas invalidadas automaticamente: terminar sem palpite e sem pontos, evitando espera impossível. Com todas removidas manualmente: `CONFIRM_CLUES` termina sem palpite e sem pontos. Após confirmação com pistas ativas, fase `guessing`. Toda autorização validada no runtime, nunca na UI.
- Pontos por autor concedidos exclusivamente a pistas únicas, não igual à palavra e não excluídas manualmente. `awardedPoints` por jogador integra resultado de rodada, `creditedPlayerIds` informa os autores pontuados. Pontos da sessão só transferem ao placar acumulado no `END_GAME` autorizado; não duplicar contagens de Room.
- Evitar rupturas de persistência: extensões opcionais de resultado local devem aceitar sessões gravadas do schema 1. Não permitir inconsistência de pontuação em histórico.

## Tarefas TDD

1. **Local filter / score:** criar testes RED no `pistaUnica.session.test.ts` para duplicatas todas anuladas, igualdade à resposta, remoção manual, +2/+1 por autor ao acertar, sem prêmio ao errar, zero pistas e rotação. Implementar no domínio `pistaUnica.session.ts`, tipos e chamada atual no fluxo. Atualizar teste antigo.
2. **LAN rules:** RED em `pistaUnicaLanGame.test.ts` e `threeGamesRoomIntegration.test.ts` para escrita→revisão, privacidade (guesser/host), exclusão manual autorizada, filtros automáticos, premios corretos por autor, 3–12 jogadores, proteção do deck e limite de frame. Implementar no adapter `pistaUnicaLanGame.ts`. Corrigir testes que ainda usam fluxo antigo.
3. **LAN UI funcional mínima:** adicionar controles de revisão e mensagens de pontos em `PistaUnicaLanRound.tsx`, sem nova identidade visual. Manter render como trecho de lobby atual; TDD com `PistaUnicaLanRound.test.tsx`. Respeitar snapshot privado.
4. **Fechamento:** Vitest integral, TypeScript, lint, build padrão e build LAN com flags, `git diff --check`; documentar contrato do Codex com estados, comandos, payloads e objetos públicos/privados, como desenhar telas sem alterar runtime. Commit só na branch/worktree `feat/pista-unica-scoring-review-01`, sem merge/push/deploy.

## Exclusões

Nenhuma alteração à home, modos, outros jogos, animações, imagens ou CSS imersivo. Não instalar APK nem afirmar homologação física. Codex receberá handoff ao final.
