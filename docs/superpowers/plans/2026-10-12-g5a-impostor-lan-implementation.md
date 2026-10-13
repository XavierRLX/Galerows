# G5A — Impostor da Palavra no multiplayer LAN
Data: 2026-10-12; branch `feat/multiplayer-lan-task1-wss` HEAD `fd8cc5c`.

Objetivo: integrar o primeiro jogo real na Room persistente v2, sem mexer no fluxo local de um só aparelho, e manter 3 modos de impostor: sem palavra, dica e palavra alternativa, com duas conversas: uma palavra/perguntas guiadas.

## Decisões de escopo
- Host cria sala G4-lite, convida 2–11 amigos, escolhe Impostor da Palavra, configura `impostorMode`/`conversationMode`. Cada participante marca Pronto. Host inicia após 3–12 jogadores conectados e prontos.
- Host (autoridade Room) escolhe palavra e impostor em memória. Projeções WSS isolam cartas por `playerId`; cada telefone revela sob clique e volta a ocultar ao perder foco. O host nunca vê cartas de guests por ser anfitrião. No modo `alternate-word`, o impostor recebe só palavra alternativa, sem indicação antecipada de papel (mesmo comportamento local).
- Após os jogadores confirmarem que viram suas cartas, host inicia rodadas de pistas (cada um dá uma palavra ou responde à pergunta exibida). Debate falado presencial. Host registra acusado; se o grupo erra, impostor vence. Se acerta, impostor faz UMA tentativa de descobrir a palavra original; acertou => rouba vitória. Errou => grupo vence. Host pode encerrar sem chute após desconexão.
- MVP LAN: uma rodada por GameSession, com resumo, pontos da rodada e RETURN_TO_LOBBY. Rodadas seguintes são novas sessões isoladas da mesma Room. Não copiar estado da store solo, estatísticas/ads locais ou dados de jogos anteriores.
- Host mantém início/fim/moderação, mas comandos são autorizados por role no runtime, não só UI. Separar segredo de jogo público; nunca revelar palavra, impostorId ou alternative no snapshot público antes do resumo.
- Mantém `toy/counter` sintéticos apenas no ambiente experimental, sem alterar rotas release ou WSS v1/2.
- Testes físicos e suítes completas **adiados a pedido do usuário**. Executar compilação TS/ESLint/build, documentar evidências e pendências; não afirmar gate físico aprovado.
- Sem commit/push/merge/deploy/APK install; preservar G0–G4, untracked e `main`.

## Gate posterior
Testar modos, 3–12 jogadores, seleção/pronto, revelação privada e blur, papel host/guest, reconexão sem vazamento, troca de GameSession, voto inválido, chute correto/incorreto, pontuação, adversários em LAN, nova rodada e limites de frame/Android.
