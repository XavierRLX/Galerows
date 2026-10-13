# Galerows — G7 Cidade Dorme multiplayer LAN — gate de implementação

**Data:** 12/10/2026. **Status:** IMPLEMENTAÇÃO / TESTES AUTOMATIZADOS PASS; HOMOLOGAÇÃO FÍSICA PENDENTE.

## Baseline, proteção do repositório

Repositório `/Users/renanxavier/Documents/GitHub/galerows`; branch obrigatória `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`; `main` permanece em `fbfb342`. Todas as alterações anteriores G0–G6, inclusive untracked, mantidas. Nenhum commit, push, merge, deploy, instalação de aplicativo, dependência nova nem alteração do aparelho. Execução com Remote Desktop Commander + Superpowers TDD.

## Funcionalidade entregue

- Terceiro jogo LAN do MVP: `cidade-dorme`, registrado no RoomLifecycleAdapter do anfitrião na versão experimental, selecionável junto de Impostor e Pista Única, mínimo 4 e máximo 12 participantes; demais jogos solo intocados.
- Usa regras já existentes de `cidadeDorme.rules.ts`, `cidadeDorme.setup.ts`: 1 assassino até 7 participantes, 2 entre 8–11, 3 com 12; médico/detetive/Coringa e revelação de papel na morte opcionais na configuração host. Método solo original permanece intacto.
- Cada jogador recebe **somente seu papel em privateState**; assassinos recebem também a identidade dos comparsas (apenas no próprio celular). Host não tem visão privilegiada de papéis nem respostas como narrador. A revelação é por botão e oculta ao perder foco, entrar em background, desconectar, mudar de etapa, rodada ou GameSession.
- Cada jogador confirma o papel (`ACK_ROLE`). Host inicia noite depois que todos viram e estão conectados. As fases são `reveal → killer-turn → doctor-turn → detective-turn → morning → discussion → voting → vote-result → próxima noite/summary`, pulando médico ou detetive desabilitados, mortos ou ausentes. Para múltiplos assassinos, o primeiro assassino vivo da ordem da sala escolhe a vítima, mantendo essa regra explícita.
- `KILL`, `PROTECT`, `INVESTIGATE` são ações privadas autenticadas e autorizadas por papel/vida/fase; médico respeita proibições default de autoproteção e repetição; investigação revela suspeito/inocente **somente ao detetive**. Vítima protegida não morre. Resultado público da manhã não revela a vítima pretendida, protegido ou informação investigativa.
- Votação: `CAST_VOTE` único por jogador vivo, sem divulgar escolhas no snapshot público; mostra apenas progresso. Host só apura depois dos votos de todos os vivos; empate não elimina. `RESOLVE_VOTE`, `NEXT_NIGHT`, `START_DISCUSSION`, `START_VOTE` são restritos ao anfitrião.
- Condições de vitória herdadas: cidade ao eliminar todos assassinos, assassinos em paridade, Coringa se eliminado por voto. `END_GAME` bloqueado antes de summary.
- `awardPoints` calcula no host: **2 pontos a cada integrante da equipe vencedora**, mesmo se eliminado anteriormente, ou 2 pontos apenas ao Coringa vencedor; zero aos demais. Soma exatamente uma vez no placar da mesma Room G5E.
- UI nas configurações do lobby e na GameSession, mobile-first, sem usar a interface sintética; mesmos princípios de acessibilidade e proteção de segredos do G5B/G6.

## Arquivos

1. `src/features/multiplayer/cidadeDormeLanGame.ts`: novo adapter do jogo, regras/fases, projeções pública/privada e score.
2. `src/features/multiplayer/cidadeDormeLanGame.test.ts`: 10 testes novos: config 4–12, sigilo, papéis, autorizações, médico/detetive, voto individual sem vazamento, cidade/assassinos/Coringa, empate, paridade, score G5E, multi-assassinos, revelar papel só na morte configurada, máximo de 12/frame.
3. `src/features/multiplayer/lan/lobby/CidadeDormeLanRound.tsx`: tela de cada jogador, fase, targets, voto, morte e vitória.
4. `src/features/multiplayer/lan/lobby/CidadeDormeLanRound.test.tsx`: 6 testes de privacidade e UI (inclui bug host confirmando papel/votando antes de iniciar/apurar).
5. `src/features/multiplayer/lan/lobby/LobbyRoomView.cidadeLan.test.tsx`: 2 testes de catálogo/configuração e integração em GameSession.
6. `src/features/multiplayer/lan/lobby/LobbyRoomView.tsx`, `lobbyView.ts`, `lobby.css`: catálogo, configuração e componente do City LAN.
7. `src/features/multiplayer/lan/lobby/RoomSessionProvider.tsx`: registra adapter no host experimental.
8. `src/features/multiplayer/persistentRoom.ts`: aplica gate de END_GAME only summary para cidade-dorme.
9. `docs/superpowers/plans/2026-10-12-g7-cidade-dorme-lan-plan.md`: plano.

## Provas RED → GREEN

- Primeira suíte do adapter falhou porque implementação não existia; depois 6/8 passaram e 2 encontraram erro de gate END prematuro + erro de teste em votos de empate. Corrigido gate e construído empate verdadeiro; 8/8, depois 10/10 com casos extra.
- Primeira suíte UI falhou por componente inexistente; depois 3/4 passou e o restante encontrou botões para o cidadão no fluxo do assassino. Fixado guard de papel na UI, 4/4.
- Testes extras detectaram duas falhas reais do anfitrião (pessoa que também joga): após `ACK_ROLE` ficava travado `START_NIGHT`; após `CAST_VOTE` ficava travado `RESOLVE_VOTE`. Dividido bloqueio de ação individual de bloqueio de navegação do host; 6/6.
- Testes de integração do lobby falharam inicialmente (jogo não aparecia e UI ainda era sintética), depois 2/2 passaram.

## Gates finais

- `npm test`: **643/643 PASS** em **105/105 arquivos**. Log `/tmp/galerows-g7-full-tests.log`.
- `npm run typecheck`: **PASS**, `npm run lint`: **PASS**.
- `npm run build` padrão: **PASS**, log `/tmp/galerows-g7-default-build.log`.
- Guarda do bundle padrão (`dist/assets` e assets Android padrão) para `CAST_VOTE`, `START_NIGHT`, `RESOLVE_VOTE`, `__lan-lobby-v2`, `cidadeDormeLanGame`: **PASS**, sem vazamento, `/tmp/galerows-g7-leak-scan.log`.
- Build experimental Vite com `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1`, `--emptyOutDir --outDir /tmp/galerows-g7-experimental`: **PASS**, log `/tmp/galerows-g7-experimental-build.log`. Confirmados comandos `CAST_VOTE`/`INVESTIGATE`/`RESOLVE_VOTE` e City no bundle experimental.
- `git diff --check`: PASS. Branch/SHAs mantidos. Nenhuma modificação em main.

## Limitações e próximos gates

1. **G5C + G7 físico:** descoberta por Wi-Fi/hotspot, ingresso seis dígitos, QR, conexões reais 4+ jogadores (ou emuladores confiáveis), sigilo no task switcher, wake/background, reconexão de médico/assassino, tempo de espera para ausentes, distribuição simultânea, votação sob perdas de rede.
2. **iOS LAN ainda não implementado/homologado:** requisito para multiplayer na App Store. Verificar permissões e interoperabilidade iPhone↔Android.
3. No MVP G7 a escolha da vítima por múltiplos assassinos é feita pelo **primeiro assassino vivo** (porta-voz). Fica documentado, não confundir com consenso entre assassinos. Não há timers forçados; fases aguardam ações válidas; será preciso avaliar UX com participantes reais.
4. `Room` e placar continuam efêmeros na memória do host: fechar processo ou a sala perde ranking. Sem backend ou conta.
5. Não houve teste de tela física 320/375/430, build Android nativo desta alteração nem compilação iOS; builds são Vite/TypeScript.

**Conclusão técnica:** os 3 jogos LAN do MVP têm adapters, UI e pontuação integrados com regressão automatizada aprovada. **Não há aprovação para lojas** até os gates físicos, iOS e release nativo.
