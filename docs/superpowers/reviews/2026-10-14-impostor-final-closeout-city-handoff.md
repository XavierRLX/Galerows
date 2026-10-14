# Galerows — Encerramento do Impostor e transição para Cidade Dorme

Data: 14 de outubro de 2026. Branch: `feat/ux-hub-header-brand`.

## Aprovação do produto

**Impostor da Palavra: CLOSED / APPROVED BY PRODUCT OWNER para o escopo acordado.**

O usuário autorizou explicitamente encerrar o jogo depois das alterações finais **sem executar uma rodada manual de aceitação**. Portanto, `CLOSED` descreve o encerramento funcional do escopo e a aceitação do responsável pelo produto; **não** significa que houve homologação física final nem que o multiplayer está certificado para distribuição pública. Gates físicos e de publicação continuam separados.

## Ajustes finais entregues

1. Reveal privado LAN (`ImpostorImmersiveRound`) e modo de 1 celular (`ImpostorDaPalavraPlayScreen`): ocultação automática da palavra ou identidade após **5.000 ms**, com cancelamento de timeout em desmontagem/mudança de fase e possibilidade de nova consulta enquanto a fase permitir. LAN preserva ocultação imediata ao perder foco/ficar desconectado.
2. LAN `ImpostorLanPublic.result.impostorGuessedCorrectly`: derivação no servidor, a partir do palpite confirmado e da palavra real com normalização de acentos. Exibido **somente após resultado público**, sem vazamento durante votação. Quando o modo individual está ativo, a tela informa explicitamente **+1 ponto extra**. No modo local o bônus usa `lastRoundResult.finalGuessCorrect`.
3. Cabeçalho compacto do lobby com ID curto da sala, indicador **verde pulsante se conectado** e **vermelho se desconectado**. Mantém texto de acessibilidade e aviso de perda de conexão; `prefers-reduced-motion` desliga pulso. A página não rola, mas a área de configurações permite rolagem interna quando o conteúdo supera a altura física da tela.
4. Guia detalhado dentro da sala (`ImpostorRulesGuide`): explicação de **Sem palavra**, **Com dica**, **Palavra alternativa**, duas formas de pista, fases da rodada, voto individual LAN, desempate, palpite, pontuação clássica e por acertos. Abre para convidados e anfitrião, fecha tocando fora, botão de fechamento ou Escape/Android Back, sem sair da Room.

## Evidências de desenvolvimento

- Os cinco testes de `ImpostorFinalUx.test.tsx` foram escritos e falharam primeiro; passaram após implementação.
- Testes extras: ocultação após 5 s no modo de 1 celular e bônus correto mesmo quando a galera venceu; ambos passaram.
- Regressão antiga de `RoomSessionGuestNavigation` exigiu recolocar aviso visível quando desconectado; 11/11 testes direcionados passaram depois.
- Suíte final (reexecutada após a correção): **738/738 testes aprovados em 126 arquivos**, `npm test`, em `/tmp/galerows-im-final-gate-test.log`.
- TypeScript: `npm run typecheck` PASS, em `/tmp/galerows-im-final-gate-type.log`.
- ESLint: `npm run lint` PASS, sem erros ou avisos, em `/tmp/galerows-im-final-gate-lint.log`. Build LAN: `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` PASS, em `/tmp/galerows-im-final-gate-build.log`. `git diff --check` PASS. O comando final de gates retornou `0/0/0/0/0`.
- A aplicação LAN Live roda com Vite na porta 4182 no Mac; após mudanças de código, sua atualização em Android é por live reload. Isso não equivale a instalar ou homologar um novo APK nativo.
- **Nenhum novo teste manual físico deste conjunto foi reivindicado.**

## Fora do escopo e limites

- Não recriar ou mudar o modo de votação; votação presencial permanece no modo de 1 celular, individual no LAN.
- Não promover `main` ou publicar release sem autorização separada.
- Não misturar arquivos antigos não rastreados em commits de encerramento.
- Homologação real e compatibilidade de telas menores: explicitamente dispensadas para este fechamento pelo usuário; se houver regressões em aparelhos, tratar como manutenção posterior.

## Cidade Dorme — próxima frente

Inventário já existente:
- Core LAN: `src/features/multiplayer/cidadeDormeLanGame.ts`, com validação de 4–12 jogadores, papéis secretos, assassino, médico, detetive, coringa opcional; fases `reveal`, `killer-turn`, `doctor-turn`, `detective-turn`, `morning`, `discussion`, `voting`, `vote-result` e `summary`.
- UI LAN: `src/features/multiplayer/lan/lobby/CidadeDormeLanRound.tsx`, já integrado à Room, mas usa painel de rodadas dentro do lobby, ao contrário da tela imersiva de Impostor.
- Testes principais: `src/features/multiplayer/cidadeDormeLanGame.test.ts` e `src/features/multiplayer/lan/lobby/CidadeDormeLanRound.test.tsx`.
- Jogo de 1 celular: `src/features/cidade-dorme/`, com fluxo e regras próprias.

**Próxima tarefa sugerida: CITY-UX-01 (Discovery + Design + Contract Gate)**: auditar UX de Cidade Dorme, comparar papéis e fases entre os modos, preservar ações secretas/estado autoritativo no host, planejar tela imersiva com transições `noite → amanhecer → conversa → votação → resultado`, fluxo do jogador eliminado e retorno à mesma sala; escrever critérios de aceitação e testes red antes de implementar. Não reutilizar o fluxo de Impostor como se as regras dos dois jogos fossem iguais.
