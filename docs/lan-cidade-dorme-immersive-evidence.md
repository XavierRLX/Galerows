# Cidade Dorme LAN — tela de jogo imersiva

## Escopo entregue

- Depois de `START_GAME`, `LobbyRoomView` monta a tela de jogo em toda a área útil. O lobby continua sendo a sala persistente por baixo da cena, e os participantes permanecem na mesma `GameSession` até resultado, replay ou retorno ao lobby.
- O componente recebe `RoomSnapshotV2` e envia os comandos existentes ao runtime autoritativo: confirmação de papel, início da noite, ações privadas, discussão, votação, apuração, noite seguinte, encerramento, replay e retorno ao lobby.
- A entrada tem uma transição curta de escurecimento. Noite, amanhecer, debate, votação e epílogo têm cenas e movimento próprios; `prefers-reduced-motion` desativa as animações.
- A carta privada exige revelação explícita, se oculta após cinco segundos, ao perder foco, ao desconectar, ao trocar de fase/sessão ou ao abrir o menu. Investigação e aliados do assassino continuam só na projeção privada.
- Alvos e resultados usam páginas de 4 itens, ou 2 em alturas abaixo de 670 px. A tela fixa usa a altura do `visualViewport` e considera as áreas seguras do aparelho; não usa rolagem de página.
- O médico recebe `eligibleTargetIds` apenas em sua projeção privada, derivados da regra autoritativa de proteção. Assim a tela não oferece a si mesmo nem alvos proibidos pela configuração/rodada anterior.
- A rota de desenvolvimento `/__prototype/cidade-dorme-live` monta o componente de produção com o runtime autoritativo em memória e participantes simulados. Ela não substitui a sala LAN nem entra no build de produção.

## TDD e validação

- Vermelho: os quatro primeiros testes da nova tela falharam antes da integração por ausência da cena `cidade-immersive`.
- Verde: 24 testes em 4 arquivos focados passaram, incluindo entrada direta, segredo do papel, paginação, autorização de ação, privacidade em blur/desconexão, reconexão do convidado, voto, resultado, replay e tentativa após rejeição.
- `npm run typecheck`: passou.
- ESLint focado nos arquivos TypeScript alterados: passou.
- `git diff --check`: passou.
- `npm run build`: passou (26 testes de conteúdo e Vite).
- `VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`: passou e gerou o chunk `LanPersistentLobbyScreen` com a tela real incluída.
- Inspeção visual no navegador local em 393×852 e 320×568: carta protegida/revelada, turno noturno com 12 pessoas, amanhecer e resultado; `document.documentElement.scrollHeight === window.innerHeight` nos estados medidos. Uma ação privada de assassino avançou o runtime para a vez do médico. A rota de laboratório usou pares simulados.

## Limite de validação

A experiência ainda precisa ser executada em APK, com dois ou mais celulares na mesma LAN, para confirmar sincronização, reconexão e áreas seguras do WebView nativo. Nenhum teste físico foi executado nesta entrega.
