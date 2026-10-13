# Galerows G5A — Impostor da Palavra LAN — relatório de implementação

**Data:** 12/10/2026. **Status: IMPLEMENTADO EM CÓDIGO / COMPILAÇÃO PASS / TESTES FUNCIONAIS E FÍSICOS ADIADOS / SEM HOMOLOGAÇÃO**.

## Decisão de produto

A modalidade original **passar um celular de mão em mão** permanece integralmente em `ImpostorDaPalavraHomeScreen/Setup/Play/Result` e na store individual. O novo modo **cada um no seu celular por LAN** está isolado nas flags nativas experimentais `VITE_GAMES_FIRST_LAN_ENTRY=1` **e** `VITE_LAN_PERSISTENT_LOBBY_UI=1`. O usuário solicitou testar depois, portanto esta entrega NÃO contém prova física de execução.

Foram identificados e preservados os 3 modos preexistentes:
- `no-word`: impostor não recebe palavra;
- `hint`: impostor recebe uma dica, sem a palavra;
- `alternate-word`: impostor recebe **uma palavra alternativa sem conhecer o próprio papel**, como na modalidade local.
Os dois modos de conversa preexistentes também foram preservados: `one-word` (uma palavra por participante) e `guided-questions` (uma pergunta individual em sua vez).

## Implementação

### 1. Fonte autoritativa e privacidade
- NOVO `src/features/multiplayer/impostorLanGame.ts`: adapter `RegisteredMultiplayerGame`, 3–12 participantes, seleção aleatória da carta e do impostor, ordem aleatória de falas, prompts por jogador vindos do baralho empacotado pt-BR, configuração validada, máquina de estados e transições.
- O `AuthoritativeRoomRuntimeV2` possui palavra, impostorId, dica e alternativa **apenas no estado canônico do host**, e em `projectPrivate(playerId)` entrega a cada membro somente sua palavra OU papel/dica. Public projection inclui modo/etapa/progresso/vez da fala, **nunca palavra nem identidade do impostor antes da resolução**. Somente `summary` divulga a solução e pontos.
- `RoomLifecycleAdapter.reduceGame` passa papel `host/guest` **derivado da membership autenticada**, não de payload. Ações de host são verificadas no reducer do jogo. `END_GAME` recusado até conclusão da resolução do Impostor (etapa summary), evitando encerramento precoce que oculta resposta e quebra fluxo.
- **Não** reutiliza store do jogo individual, nem escreve resultados LAN nos rankings individuais, nem envia segredos do jogo em anúncios mDNS ou código de entrada.

### 2. Fluxo LAN de uma rodada
1. Host cria Room local e compartilha código de 6 dígitos/QR (G4-lite existente), conecta 2–11 convidados.
2. Seleciona **Impostor da Palavra**, escolhe um dos três modos de impostor e um dos dois modos de conversa, salva regras.
3. Cada membro conectado marca **Estou pronto**. O host inicia **somente com mínimo de 3** e todos conectados prontos (máximo 12).
4. A Room cria uma **GameSession nova**, sorteia palavra/impostor. Cada celular mostra inicialmente **informação oculta**. Ao tocar `Ver minha palavra`, vê apenas o próprio briefing; ao tocar `Já vi minha informação e estou pronto`, confirma; app esconde informação ao perder foco/background.
5. Host vê quantos confirmaram e inicia as pistas após todos confirmarem. A cada vez, um jogador fala uma palavra ou responde à pergunta guiada, em voz alta, no encontro presencial. Host avança a fala; quando todos falam, a sala entra em discussão.
6. O grupo decide presencialmente quem é o impostor. Host registra a escolha. **Acusação errada:** impostor vence, 2 pontos; **acusação correta:** impostor é identificado e tem uma tentativa de `GUESS_WORD` no próprio celular.
7. Se o impostor adivinha corretamente a palavra (comparação sem diferença de caixa/acentos), ele **rouba a vitória (2 pontos)**. Se erra ou desiste (host confirma), os demais recebem **1 ponto cada**. Resumo revela palavra, impostor, tentativa e pontos.
8. Host conclui `END_GAME` e volta ao lobby da **mesma Room**; nova rodada cria outra GameSession com papéis/palavra diferentes. MVP não acumula placar entre GameSessions: pontos são **por rodada**.

### 3. UI
- NOVO `ImpostorLanRound.tsx`: progresso e estados de jogo, revelação pessoal, esconder no blur/background, confirmação, perguntas guiadas, host moderador, acusação e campo de chute do impostor, resultado/pontos.
- `LobbyRoomView.tsx`: opção de Impostor no catálogo, setup de modalidades, espera dos prontos e renderização de gameplay real. Os sintéticos `toy/counter` mantidos para regressões antigas.
- `lobbyView.ts`: `impostor-da-palavra` registrado no catálogo, capacidade mínima 3; Room backend valida novamente.
- `LanPersistentLobbyScreen.tsx`: encaminha `onGameCommand` à `RoomSessionProvider.action(scope='game')`.
- `ImpostorDaPalavraHomeScreen.tsx`: CTA adicional de LAN apenas na build nativa experimental, sem alterar o botão solo existente.
- `GameCard.tsx`: rótulo `LAN experimental` apenas para Impostor nativo com flags; em release continua `LAN em preparação`.
- `lobby.css`: estilos responsivos para informações privadas e etapas da rodada.

### 4. Limites explícitos do primeiro adapter
- Só **uma rodada por GameSession**, com placar de rodada; não há torneio LAN multirrodadas com pontuação cumulativa.
- Dados da carta/perguntas carregados do deck **empacotado pt-BR**; o carregamento de traduções/overrides da store solo e estatísticas individuais **não** foi portado, intencionalmente.
- Jogo presencial: conversa/argumentos/decisão coletiva acontecem em voz alta; o anfitrião controla avançar turnos e registrar acusado.
- O host tem seu próprio briefing, não recebe as cartas privadas dos convidados. Modo de palavra alternativa mantém ambiguidade.
- Integração de mais 2 jogos reais, autorização forte por QR opcional e homologação física continuam fora do escopo G5A.
- A segurança inicial **G4-lite** é reduzida deliberadamente: mDNS/6 dígitos não comprovam host original e qualquer cliente da mesma Wi-Fi pode descobrir sala. WSS com pin ao fingerprint anunciado e membership v2 permanecem.

## Evidências deste turno (somente análise estática; não testes)

- `npm run typecheck`: **PASS** após últimas modificações.
- `npm run lint`: **PASS**.
- `npm run build` normal: **PASS**.
- Scan normal em `dist/assets`: sem `ImpostorLanRound`, `impostorLanGame`, `__lan-lobby-v2` ou código novo da interface LAN: **PASS**.
- Build experimental nativo opt-in: **PASS**, módulo e comandos `ACK_BRIEFING`/`GUESS_WORD` presentes no artefato experimental.
- `git diff --check`: **PASS**.
- **NÃO EXECUTADOS** neste gate: Vitest, JUnit, instrumentação Android, APK, segundo celular, vídeo/QA física, testes de rede ou iOS. **Não afirmar funcionalidade final comprovada.**

## Pendências para gate posterior

1. Testes unitários/reducer por 3 modos e 2 conversas; uma palavra diferente por impostor, zero segredos em `projectPublic` antes de summary e apenas um `projectPrivate` por id, inclusive o host.
2. Testar comandos maliciosos: guest tenta `ACCUSE/NEXT_CLUE/SKIP_GUESS`, ACK por outro player, chute por não-impostor, chute repetido, `END_GAME` antes de summary, participantes aguardando, mudança de config pronta, limite 3/12 e sequência.
3. Rodadas distintas, replay/command idempotency, desconexão, resume e secret masking ao background; validações Frame 16KiB.
4. Teste físico 2–3 aparelhos Android mesma Wi-Fi/hotspot, seleção/pronto, revelação simultânea, progresso, acerto/erro, áudio presencial, modo 6 dígitos, tempo sem internet, novo game na mesma Room e QR fallback.
5. UI 320/375/430/768 px, rolagem, TalkBack, foco em carta, teclado do chute, acessibilidade e iOS nativo quando houver infra.
6. Avaliar segundo ciclo: perfis/nome do jogador na Room, placar acumulado, votação individual em vez de host-mediada, pacote de cartas localizado e UX de seleção de modo integrada ao catálogo, sem quebrar solo.

## Git e proteção de produção
- Branch `feat/multiplayer-lan-task1-wss` mantida em HEAD `fd8cc5c`.
- `main` preservada; trabalho não commitado G0–G4 e novos arquivos G5A preservados.
- **Sem** commit, push, merge, deploy, atualização de loja, instalação física, dependência nova ou alteração no WSS v1.

**Gate:** G5A CODE/STATIC PASS; implementação real testada = NÃO; G2/G3/G4 ainda sem homologação física. Pare antes de release ou segundo jogo.
