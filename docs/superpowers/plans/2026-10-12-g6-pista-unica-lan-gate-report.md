# Galerows — G6 Pista Única LAN | Gate de implementação (12/10/2026)

## Resultado

**G6 — CODE + AUTOMATED GATE: PASS.**
**G6 — LAN PHYSICAL: PENDENTE.** Testes de duas ou mais conexões físicas, Wi-Fi/hotspot/mDNS, câmera QR, app Android instalado, iOS e compatibilidade entre plataformas não realizados. Não confundir simulações da Room com testes de redes reais.

Branch e baseline preservados: `feat/multiplayer-lan-task1-wss`, `fd8cc5c`. `main` permanece `fbfb342`. Não foi criado commit, push, merge, deploy, APK, instaladas dependências ou alterado hardware. Todas as mudanças pré-existentes G0–G5E e arquivos untracked foram preservados.

## Decisões de regras (mesma Pista Única solo, adaptada a celulares pessoais)

- 3–12 jogadores, opções de categorias Palavras, Filmes e Séries. O host escolhe categorias; cada GameSession tem uma rodada por participante, com adivinhador rotativo (inclui anfitrião).
- Palavra secreta é selecionada e guardada no estado do host; **somente autores de pistas** recebem alvo via snapshot `privateState`. Adivinhador não recebe target ID, palavra nem pista alheia antes de `guessing`; `projectPublic` durante escrita inclui apenas progresso, categorias não expostas como segredo. Cada pista de até 48 caracteres é escrita no próprio celular com revelação explícita do alvo. Não aceitar pista vazia nem duplicidade do mesmo remetente.
- Quando todos os autores submeterem, o host filtra automaticamente duplicidades pela função `getVisiblePistaUnicaClues` do jogo solo (acentos, caixa, espaços, pontuação), preservando a primeira pista válida de cada termo. Essa adaptação não exige que o anfitrião veja cartas de outras pessoas quando ele for o adivinhador.
- Adivinhador envia `SUBMIT_GUESS` do próprio telefone; host decide acerto pelo texto normalizado (`normalizeClue`). Resultado revela resposta somente depois da tentativa; o anfitrião autoriza `NEXT_ROUND`. `END_GAME` bloqueado antes de `summary`, inclusive para host.
- Cada acerto vale 1 ponto para o adivinhador (máximo de 1 por participante por GameSession). Pontuação confiável é gerada por `awardPoints` do adapter e integrada ao G5E ao concluir a partida. Room e membership continuam entre GameSessions, histórico apenas efêmero.
- O estado de jogo é projetado com isolamento por jogador e limite LAN de 16KiB por frame. Novos integrantes aguardam o próximo jogo, sem receber alvo da rodada em curso.
- UI mantém segredo oculto por padrão; religa a ocultação em blur/background, mudança de rodada/fase, perda de conexão e nova GameSession. Botões e formulário são bloqueados quando a conexão é interrompida.

## Código

- **Novo** `src/features/multiplayer/pistaUnicaLanGame.ts` — adapter/reducer da partida com fases `writing`, `guessing`, `round-result`, `summary`, target privados, filtragem compartilhada e award G5E.
- **Novo** `src/features/multiplayer/lan/lobby/PistaUnicaLanRound.tsx` — apresentação por participante, input de pistas, palpite, revisão automática, resposta/resultado e sumário.
- `src/features/multiplayer/persistentRoom.ts` — adiciona G6 à barreira autoritativa de `END_GAME` (summary obrigatório).
- `src/features/multiplayer/lan/lobby/RoomSessionProvider.tsx` — registra adapter junto ao Impostor e fixtures sintéticas no runtime host experimental.
- `src/features/multiplayer/lan/lobby/lobbyView.ts` — inclui Pista Única no catálogo LAN e mínimo de três participantes.
- `src/features/multiplayer/lan/lobby/LobbyRoomView.tsx` — seleção, categorias, tela real de G6, preserva fluxo sintético e Impostor G5A.
- `src/features/multiplayer/lan/lobby/lobby.css` — visuais responsivos para editor de pistas/resultado.
- **Novos testes** `src/features/multiplayer/pistaUnicaLanGame.test.ts` (7); `src/features/multiplayer/lan/lobby/PistaUnicaLanRound.test.tsx` (4); `src/features/multiplayer/lan/lobby/LobbyRoomView.pistaLan.test.tsx` (2).
- Plano: `docs/superpowers/plans/2026-10-12-g6-pista-unica-lan-plan.md`.

## Evidências de TDD e gate

1. Teste RED de adapter: import `./pistaUnicaLanGame` inexistente; após implementação, 6 de 7 passaram e 1 falhou porque `END_GAME` prematuro retornava `invalid_payload`. Ajustado Room para rejeitar `END_GAME` G6 prematuro com `invalid_phase`; todos 7 passaram.
2. Teste RED de interface: import `./PistaUnicaLanRound` inexistente; após implementação, **4/4 PASS**.
3. Testes de integração seleção/configuração/navegação ao novo jogo: **2/2 PASS**.
4. `npm test` após integração: **625/625 PASS em 102/102 arquivos** (inclui todos os jogos solo, Impostor LAN, G5E e regressões LAN).
5. `npm run typecheck` e `npm run lint`: **PASS** após todos os arquivos/testes.
6. `npm run build` padrão: **PASS** (inclui testes de conteúdo). Varredura do bundle `dist/assets` e dos assets Android Release existentes por comandos LAN novos e rotas experimentais: **PASS — nenhuma inclusão detectada**.
7. Vite experimental `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1`, `--emptyOutDir --outDir /tmp/galerows-g6-experimental`: **PASS**. Confirmados `SUBMIT_CLUE` e `SUBMIT_GUESS` nos chunks experimentais.
8. `git diff --check`: **PASS**, branch e baseline verificados.

## Gate físico e riscos restantes

- G5C/G6 físico: conexão de aparelhos 3+ jogadores reais ou 2 aparelhos+simuladores, descoberta automática/código curto/QR, privacidade real no Android task switcher, comportamento em background, perda/reconexão durante envio, chegada tardia, proteção contra cliente adulterado, roteadores multicast e hotspot.
- G6 estrutura JS validada **somente com o host em execução**; não há backend remoto nem histórico permanente. O jogo pode aguardar indefinidamente um autor desconectado até sua reconexão (o usuário priorizou não perder a sala e não avançar sem jogadores); gate físico pode motivar regra de desistência.
- Validação visual manual em aparelhos 320–430px ainda pendente; testes de UI de JSDOM não substituem isso.
- G7 **Cidade Dorme LAN** não iniciado nesta etapa. Implementação iOS LAN nativa ainda pendente para App Store; não declarar pronta para publicação.
