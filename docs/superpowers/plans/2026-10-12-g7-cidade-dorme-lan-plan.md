# G7 — Cidade Dorme multiplayer LAN — plano (2026-10-12)

## Escopo autorizado
Terceiro e último jogo LAN do MVP (Impostor G5A/G5B, Pista Única G6, Cidade Dorme G7), depois da aprovação explícita do usuário. Repositório /Users/renanxavier/Documents/GitHub/galerows, branch feat/multiplayer-lan-task1-wss, HEAD fd8cc5c, main fbfb342, arquivos locais sujos anteriores preservados. Proibido commit/push/merge/deploy/instalar dispositivo/dependências. Mac com jogadores simulados, sem alegar homologação física G5C.

## Regras herdadas
Reusar `cidadeDorme.setup.ts`, `cidadeDorme.rules.ts`, `cidadeDorme.roles.ts`. 4–12 participantes e killerCount recomendado por número (1 até 7, 2 de 8 a 11, 3 com 12). Habilitar médico/detetive/Coringa nas opções do anfitrião; médico não pode se proteger ou repetir alvo de rodadas anteriores (config padrão solo); detetive investiga e resultado é secreto. Vencedor: cidade sem assassinos, assassinos em paridade, Coringa se eliminado por voto. Papéis e condições por time não alterados.

## Protocolo LAN v2
`cidade-dorme` registrado no RoomLifecycleAdapter. host authority escolhe papéis via random e role deck do jogo solo; ninguém recebe papel de terceiros em snapshot público. cada jogador recebe somente seu papel em projectPrivate; assassinos podem conhecer seus parceiros de time. Host não recebe papéis globais a menos que o próprio papel o autorize.

Fases: reveal (ACK_ROLE por participante), killer-turn (assassino ativo escolhe vítima); doctor-turn (médico escolhe proteção); detective-turn (investiga, recebe resposta privada); morning (resultado público sem alvo protegido ou segredo detetive), discussion (conversa presencial); voting (cada vivo emite 1 voto secreto); vote-result (desempate = ninguém eliminado), próxima noite; summary (gameOver). `START_NIGHT`, `START_DISCUSSION`, `START_VOTE`, `RESOLVE_VOTE`, `NEXT_NIGHT` host-only. Avanço night após ações automaticamente, papéis ausentes/mortos são pulados. Múltiplos assassinos: um porta-voz ativo (primeiro assassino vivo no roster) escolhe a vítima; demais assassinos veem seus parceiros, mas não podem votar por ele. Se assassino porta-voz desconectar a partida aguarda reconexão sem revelar papel ou transferir autoridade. Em empate de votos ninguém é eliminado. Não há timer forçado nem servidor externo.

Interromper `END_GAME` antes de summary; `awardPoints` 2 pontos a cada integrante da equipe vencedora, inclusive eliminado, e 2 pontos ao Coringa quando vencedor, 0 a outros; pontuação acumulada G5E exatamente uma vez por GameSession. Sumarizar papéis ao final, mas sem informações investigativas privadas nos public snapshots anteriores. Exibir estado e ações individuais na tela LAN existente, nova UI com segredo oculto inicialmente e em background / troca de fase / desconexão.

## TDD/gates
RED→GREEN para sigilo de papéis, host como papel comum, config 4–12, ACK, comando falsificado por role, vítimas e proteção, investigação privada, fases, reconexão e late join, voto único e sigiloso, empate, vencedores cidade/assassinos/coringa, pontuação por equipes, stale GameSession, limite frame 16KiB 12 jogadores, UI role reveal, fases/ações/resultados, ingresso pelo lobby.
Rodar `npm test`, `npm run typecheck`, `npm run lint`, build release padrão (LAN excluída) e build experimental LAN. Relatório e pendências físicas/iOS.
