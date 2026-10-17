# Impostor da Palavra — LAN imersivo e votação individual

Implementação realizada em 2026-10-14 na branch feat/ux-hub-header-brand, sem commit.

## Fluxo

1. Na Room existente, o anfitrião escolhe Impostor da Palavra, salva modo, tipo de dica e timer opcional, e espera todos ficarem prontos.
2. START_GAME cria uma GameSession nova na mesma Room. Os participantes entram direto na identidade, com contagem visual de 3 segundos baseada no início registrado pelo host.
3. Cada aparelho recebe apenas o seu segredo por projeção privada. A carta pode ser consultada repetidamente até a votação. A primeira revelação gera ACK_BRIEFING, idempotente.
4. Quando todos viram, aparece o aviso para falarem pistas em voz alta, sem mudar de tela. O anfitrião pode iniciar o cronômetro e depois abrir a votação.
5. START_VOTING só é aceito do host com todos presentes e vistos. Cada jogador seleciona e confirma um voto autenticado, definitivo, pelo próprio celular; voto e conteúdo da carta ficam ocultos durante a apuração.
6. Após todos votarem, o vencedor é calculado pelo host. Em empate, segundo turno com empatados; persistindo, vence o impostor. A UI mostra resultado para todos.
7. O anfitrião registra pontuação com END_GAME e depois volta todos ao lobby com RETURN_TO_LOBBY. Ninguém recria Room.

## Compatibilidade e segurança

- O novo fluxo depende da configuração individual-vote; configurações antigas preservam o motor legado e suas regras.
- Timer opcional 0/120/180/300 segundos, com START_TIMER host-only sincronizado ao timestamp do host. Chegar a zero não dispara votação automaticamente.
- O voto só vale para membro ativo na GameSession identificada e autenticado pelo WSS LAN atual. Votos não aparecem no estado público; publica-se apenas o número de confirmações.
- Reentradas depois de confirmar não alteram o voto, e retransmissões idempotentes não geram pontuação duplicada.
- O modo novo encerra diretamente depois da votação, sem chance final de adivinhar a palavra. O legado mantém a chance final, até a decisão de produto.
- Late joiners não recebem segredo e participam somente na próxima GameSession.
- Dispositivos sem conexão podem fechar localmente a tela da partida; não se simula saída autenticada.
- Visual reutiliza CSS do protótipo aprovado, sem usar dados fictícios no fluxo real.
- Contagem de início usa timestamp do anfitrião e relógio do aparelho; pode ter pequena diferença se os relógios estiverem desalinhados.
- Homologação física de 3 ou 4 jogadores e reconexão durante a votação ainda pendente.

## Arquivos

src/features/multiplayer/impostorLanGame.ts
src/features/multiplayer/impostorLanGame.test.ts
src/features/multiplayer/lan/lobby/LobbyRoomView.tsx
src/features/multiplayer/lan/lobby/LobbyRoomView.test.tsx
src/features/multiplayer/lan/lobby/LobbyRulesSummary.tsx
src/features/multiplayer/lan/lobby/ImpostorImmersiveRound.tsx
src/features/multiplayer/lan/lobby/ImpostorImmersiveRound.test.tsx
src/features/multiplayer/lan/lobby/impostorImmersive.css

Main, produção e aplicativos instalados não alterados. Nenhum commit/push/deploy.
