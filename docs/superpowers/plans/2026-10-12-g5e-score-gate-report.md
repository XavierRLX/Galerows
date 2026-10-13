# Galerows G5E — gate: placar acumulado e campeão da Room

Data: 12/10/2026. Aprovado pelo usuário para execução sem segundo aparelho. Branch `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`; `main` `fbfb342` inalterada. **Sem commit, push, merge, deploy, alteração de aparelho nem instalações.** Preservadas as alterações anteriores G0–G5D.

## Resultado

**G5E (core, UI e verificações estáticas/automatizadas): PASS.**
**G5C / G5E em hardware real: PENDENTE.** Somente simuladores TypeScript/React no Mac; nenhum teste novo entre dispositivos.

## Entregue

1. `src/features/multiplayer/persistentProtocol.ts`: tipo `RoomCompetitionV2` opcional em `RoomStatePublicV2`, com status, partidas pontuadas, placar individual e campeões. Todo runtime real v2 cria competição vazia ao abrir Room; opcionalidade protege test fixtures antigas.
2. `src/features/multiplayer/multiplayerGames.ts`: contrato opcional `awardPoints` computado **no estado interno do adapter do host**, não em payload cliente. Todos participantes pontuam 0–2 inteiros por GameSession. Adapters sintéticos continuam sem pontuação. Permite **múltiplos jogadores vencedores** para futuros jogos por equipes.
3. `src/features/multiplayer/impostorLanGame.ts`: imposta `awardPoints` apenas no summary; impostor 2 quando vence, integrantes da galera 1 cada quando vencem.
4. `src/features/multiplayer/persistentRoom.ts`: pontua em `END_GAME` no mesmo commit do resultado, uma vez por GameSession, valida limites/IDs, bloqueia pontuação forjada, conserva scores ao retornar ao lobby e quando participante cai/sai; novo convidado começa em 0. `FINISH_SESSION` só para host, no lobby, após jogo pontuado; anuncia todos empatados no maior placar, torna competição terminal e rejeita novas partidas. Fecha-se a Room via mecanismo existente; dados continuam **efêmeros**, sem histórico persistido após encerramento/process death. `toy`/`counter` não pontuam e não permitem encerrar disputa sem partida real.
5. `src/features/multiplayer/lan/lobby/LobbyRoomView.tsx` e `lobby.css`: painel de classificação quando existe partida pontuada, totais, vitórias, partidas, botão `Encerrar disputa` só no lobby/anfitrião, pódio de campeão/empate. Depois do fechamento da disputa, esconde novas opções de partida.
6. `src/features/multiplayer/lan/lobby/LanPersistentLobbyScreen.tsx`: vincula botão ao comando autenticado Room `FINISH_SESSION`.

## RED → GREEN

- `src/features/multiplayer/roomCompetition.test.ts`: novo arquivo, **8 testes**. Antes da mudança 7 testes falhavam por falta de competição / finish. Após implementação todos passam. Cenários: início vazio, guest unauthorized, finish precoce, tentativa de forjar pontos, duas GameSessions acumuladas, sem pontuação duplicada por END repetido, limpeza de segredos, mesmo score para host/guest, empate, encerramento terminal, desconexão/reassociação, saída e nova entrada, probes não pontuam, adapter fraudulento 999/ID extra rejeitado, dois integrantes de equipe premiados, tamanho de snapshot com 12 membros.
- `src/features/multiplayer/lan/lobby/LobbyRoomView.test.tsx`: **3 testes novos** RED→GREEN no painel, host finish, empate e ausência de botões pós-encerramento, guest sem autorização.

## Gates finais após última mudança

- `npm test`: **612/612 PASS** em **99/99** arquivos — `/tmp/galerows-g5e-final-full-tests.log`.
- `npm run typecheck`: **PASS** — `/tmp/galerows-g5e-final2-ts.log`.
- `npm run lint`: **PASS** — `/tmp/galerows-g5e-final2-lint.log`.
- `npm run build` padrão: **PASS** — `/tmp/galerows-g5e-final2-release.log`.
- Guarda do bundle Release web e Android padrão: **PASS**, nenhum `FINISH_SESSION`, `RoomCompetitionPanel`, `__lan-lobby-v2` foi encontrado — `/tmp/galerows-g5e-final2-release-leak.log`.
- Build Vite experimental com `VITE_GAMES_FIRST_LAN_ENTRY=1` e `VITE_LAN_PERSISTENT_LOBBY_UI=1`: **PASS**, strings da UI e comando G5E presentes — `/tmp/galerows-g5e-final2-exp.log`.
- `git diff --check`: PASS. HEAD e `main` preservados.

O script agregado encerrou com exit 1 por uma linha de **echo ornamental interpretada pelo zsh** após todos os gates PASS; foi executada verificação posterior independente de Git, logs e arquivos, com PASS. Não houve erro de lint, build ou teste ao final.

## Limitações explícitas

- **Não salva histórico entre Room distintas**, pois o usuário pediu acumulador no lobby enquanto joga e campeão no final; Room em memória no host, não persistida após processo/fechamento.
- Regras 0–2 por partida constituem contrato MVP; equilíbrio entre Impostor, Pista Única e Cidade Dorme será validado com game design real nos gates G6/G7.
- Cenário de vitória em equipes foi validado por adapter de exemplo, mas **Pista Única LAN e Cidade Dorme LAN ainda não estão implementados**.
- Pontuação confiável depende de host em execução; dados em memória, não protocolo para clientes antigos nem sincronização App Store validada.
- Sem homologação física da G4/G5A/G5E, rede LAN, mDNS, seis dígitos, QR câmera, iOS/Android, Doze e reconexão entre telefones.
- Próximo gate: G6 **Pista Única LAN** via TDD no Mac; G7 **Cidade Dorme LAN**; G5C físico quando segundo aparelho estiver disponível. Todos separados de build de produção até o gate correspondente.
