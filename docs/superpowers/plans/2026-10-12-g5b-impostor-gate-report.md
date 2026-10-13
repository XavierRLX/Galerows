# Galerows G5B — Gate de estabilização do Impostor da Palavra

Data: 12/10/2026. Branch `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`. Escopo aprovado pelo usuário: testar e estabilizar o primeiro jogo LAN com simuladores no Mac, preservando `main` e sem exigir dois celulares.

## Resultado do gate

**G5B AUTOMATED/STATIC PASS — 599/599 TESTES, 97 ARQUIVOS.**
**G2/G3/G4/G5 LAN físico: AINDA NÃO HOMOLOGADOS.** Nenhuma conexão real entre celulares, Wi-Fi/mDNS de hardware, Android instrumentado ou teste com iOS foi realizado. Não houve commit/push/merge/deploy/install nem dependências novas. Estado não-commitado G0–G5A preservado.

## TDD: RED→GREEN demonstrado

1. **Carta privada reaparece depois de reconectar:** o teste `never auto-reveals an earlier card after a connection drops and recovers` falhou (palavra renderizada indevidamente após retorno); corrigido.
2. **Carta permanece exposta quando muda fase:** `conceals information when the round advances from revelation to conversation` falhou; corrigido.
3. **Revelação concluída permite pistas com jogador desconectado:** `holds the reveal barrier if a player disconnects after reading their word` falhou (`not_ready` esperado, comando aceito); corrigido.
4. Um caso inicial de teste UI pressupunha botão de revelação desabilitado durante offline, quando o componente deliberadamente não renderiza dados privados offline. Ajustou-se o teste para **não existir** o botão — sem modificar a proteção do produto.

### Correções de produção

- `src/features/multiplayer/lan/lobby/ImpostorLanRound.tsx`: subcomponente de segredo e tela de rodada com `key` por `gameSessionId:phase:connected` garante reinicialização imediata da revelação no reset de sessão, mudança de fase e queda/retorno de conexão. Mantém ocultação por blur/visibilitychange. Uma primeira tentativa via setState em useEffect passou nos testes, mas foi reestruturada por violar `react-hooks/set-state-in-effect`; versão final validada sem warning.
- `src/features/multiplayer/multiplayerGames.ts`: `MultiplayerGameAction` recebe lista opcional `connectedParticipantIds`; trata-se de metadado **interno**, não confiado a payload do cliente.
- `src/features/multiplayer/persistentRoom.ts`: Room calcula `connectedParticipantIds` **a partir do membership/connectionId autenticado** ao acionar reducer do jogo.
- `src/features/multiplayer/impostorLanGame.ts`: `START_CLUES` recusado com `not_ready` enquanto pelo menos um participante da sessão estiver desconectado. Após reassociação autorizada à mesma Room, o comando pode ser aceito.

### Novo escopo automatizado

`src/features/multiplayer/impostorLanGame.test.ts`: **15 casos** abrangendo 6 combinações das 3 modalidades de impostor x 2 modalidades de conversa; confidencialidade por destinatário; dados compartilhados sem word/impostor/dica antes de summary; frame 16KiB com 12 participantes; mínimo de 3 jogadores; validação de configuração e ready; rejeição de ações de host por guest; guess somente impostor; acusação errada/correta, roubo da palavra com caixa/acentos normalizados, guess incorreto e desistência; pontuação; nova GameSession sem cartear estado anterior; reject de comando atrasado; late join aguardando sem carta; barreira contra jogador offline; reassociação no mesmo playerId preservando apenas sua carta e sequência de autorização.

`src/features/multiplayer/lan/lobby/ImpostorLanRound.test.tsx`: **7 casos** cobrindo revelação deliberada, blur, desconexão/reconexão, transição de etapa, nova GameSession, confirmação da carta, ausência de dados offline e controles guest/host.

No primeiro `npm test` completo, 591 passaram e **7 testes anteriores G2/PL-03** falharam exclusivamente por rótulos atualizados em G4 (`Convite da sala` e `Código de verificação do anfitrião`). Os mesmos testes foram ajustados em `LanPersistentLobbyScreen.test.tsx` e `RoomSessionGuestNavigation.test.tsx` para consultar os novos rótulos acessíveis `Convite completo` e `Verificação do QR`. Nova suíte completa passou.

## Verificações finais, executadas após todas as modificações

- `npm test`: **599/599 PASS, 97/97 arquivos**; log `/tmp/galerows-g5b-verified-full.log`.
- `npm run typecheck`: **PASS**, `/tmp/galerows-g5b-verified-ts.log`.
- `npm run lint`: **PASS**, `/tmp/galerows-g5b-verified-lint.log`.
- `npm run build` padrão: **PASS**, `/tmp/galerows-g5b-verified-default-build.log`. Scan de `dist/assets` e assets Android padrão: **PASS, nenhum G5A/G5B experimental inserido**.
- Build Vite experimental com `VITE_GAMES_FIRST_LAN_ENTRY=1` e `VITE_LAN_PERSISTENT_LOBBY_UI=1` em `/tmp/galerows-g5b-verified-experimental`: **PASS**; `ACK_BRIEFING`, `GUESS_WORD`, `START_CLUES` presentes.
- `git diff --check`: **PASS**.
- Branch `feat/multiplayer-lan-task1-wss` e HEAD `fd8cc5c` preservados, `main` `fbfb342` sem alteração.

## Gates remanescentes (sem inventar validação)

1. **G2/G3/G4:** descoberta mDNS real, broadcast de código, WSS TLS, ingresso por QR/código curto, disponibilidade em dois Android na mesma Wi-Fi/hotspot, comportamento de roteadores/multicast, rede sem internet, falso anúncio e reconexão real.
2. **G5:** salas de 3–12 celulares reais, todos veem carta particular, role/word shielding em hardware, background/resume, turnos e final guess entre telefones, repetição da rodada e limpeza entre GameSessions; ajustes de UI 320–430 px e acessibilidade em dispositivos.
3. Não prometer acesso exclusivo a amigos apenas por estar na mesma Wi-Fi; a entrada por código G4 tem trade-off consciente e precisa de teste de rede.
4. **Não iniciar G6 (segundo jogo LAN), nem produção, até gate físico**. Se necessário, corrigir primeiro problemas de G2/G3/G4/G5.

**Conclusão:** G5B está estabilizado pelos testes automatizados e verificações estáticas. Isso não substitui homologação física LAN.
