# Galerows — homologação física LAN com 3 Androids (13/10/2026)

## Escopo e segurança
- Autorização: usuário aprovou instalação de **Galerows LAN (Teste)** nos 3 aparelhos e testes físicos.
- Branch: `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`; `main` `fbfb342` sem alterações; sem commit/push/merge/deploy.
- APK experimental compilado em árvore temporária, sem modificar código/Gradle do repositório: `/tmp/galerows-physical-20261013/android/app/build/outputs/apk/debug/app-debug.apk`.
- Package isolado `com.galerows.app.lanpilot`, rótulo `Galerows LAN (Teste)`; APK debug assinado e validado, minSdk24, targetSdk36, ~11MB.
- Não substitui o `com.galerows.app` já instalado.
- Os testes de UI foram executados através da interface das WebViews reais usando DevTools via USB; nenhum comando de Room/game injetado diretamente nos reducers. Nenhuma palavra secreta, convite, fingerprint ou credencial foi escrita em evidências.

## Aparelhos
| Papel | Modelo | Android | IP local | Instalação | Inicialização |
| --- | --- | --- | --- | --- | --- |
| Host | Samsung SM-S731B | 16 / API36 | 192.168.0.89 | PASS | PASS |
| Guest 1 | Samsung S23 SM-S911B | 16 / API36 | 192.168.0.90 | PASS | PASS |
| Guest 2 | Motorola Moto G6 | 9 / API28 | 192.168.0.91 | PASS (demorou ~95s) | PASS |

Rede: `APTO402`, mesma sub-rede; host .89 <-> .90 e host .89 <-> .91 com ping PASS. S23 .90 <-> Moto .91 não respondem diretamente nesta rede: **não declarar malha peer-to-peer operacional**. A topologia LAN da Room é estrela no host .89.

## Gate físico de criação e ingresso — PASS
1. Primeira abertura, tela de privacidade, `Minha Galera`, navegação pelos botões reais de `Criar sala` / `Entrar em sala`: PASS nos 3 modelos.
2. Samsung SM-S731B cria Room WSS LAN: PASS; lista de membros inicial 1.
3. Descoberta automática DNS-SD: sala visível em ambos os convidados (S23 e Moto G6): PASS.
4. S23 entra usando botão da lista de salas: PASS.
5. Moto G6 preenche apenas código de 6 dígitos e entra na sala encontrada: PASS.
6. As três WebViews convergem para `revision=03`, mesmo lobby e 3 membros; nenhuma mensagem de erro: PASS. Atualizações podem ser assíncronas; uma amostra logo após ingresso ainda mostrava 2 membros no primeiro convidado, seguida de 3 em leitura posterior.

## G5C — Impostor da Palavra, 3 Androids — PASS (um fluxo)
- Host selecionou jogo e salvou regras, 3 jogadores marcaram prontos; `3/3` sincronizado; partida real iniciada nos 3.
- Cada carta privada estava oculta até interação no próprio aparelho. Cada um revelou e confirmou sua informação; `3/3` vistos.
- Fases reais: pistas (3 pessoas), discussão, acusação, última chance do impostor, desistência do palpite, sumário, `END_GAME`, resultados e `RETURN_TO_LOBBY`.
- Pontuação host autoritativa: `[1,1,0]` nos três aparelhos; `1 partida pontuada`, mesmo lobby com 3 membros e sem erros.
- **Não testado nesta execução:** acerto ao roubar palavra, alternância de modos, background/Doze, falha de rede/reconexão, adversarial.

## G6 — Pista Única, mesma sala, 3 Androids — PASS (um jogo completo)
- Seleção sem recriar Room; categorias salvas; `3/3` prontos, partida real iniciada.
- Três rodadas completas, adivinhador rotativo (host, S23, Moto); 2 autores de pistas por rodada com cartas privadas inicialmente ocultas.
- Desafios secretos conferidos apenas nos próprios celulares dos autores. Adivinhador não exibia carta privada. Pistas enviadas pelas interfaces individuais.
- Rodada 1: 1 palpite correto (+1); rodadas 2 e 3: palpites intencionalmente errados (+0).
- `NEXT_ROUND`, `summary`, `END_GAME`, resultados e retorno ao mesmo lobby: PASS.
- Placar passou a `[1,1,1]` após **2 partidas pontuadas**, idêntico nos três aparelhos.
- **Não testado:** deduplicação de duas pistas idênticas, navegação durante partida, perda de rede e concorrência intensa.

## G5E — Encerrar disputa — PASS
- Botão `Encerrar disputa` disponível só no host na fase lobby; oculto nos guests.
- Host encerrou; os três receberam o título `Campeões da galera!`, com três empatados a 1 ponto e novos jogos bloqueados. `revision=42` em todos.
- A primeira amostra logo após o comando mostrou o Moto ainda no placar ativo; convergiu na leitura seguinte. Sem falha funcional confirmada.
- A sala foi deixada aberta nos aparelhos para visualização do pódio; os dados são efêmeros na Room do anfitrião.

## Compatibilidade visual e estabilidade — PASS (smoke)
- CSS viewport: 384x782 (dois Samsungs) e 360x720 (Moto G6). ScrollWidth/documentWidth = viewportWidth; card do pódio dentro dos limites em todos; sem overflow horizontal detectado nesta tela.
- Processo `com.galerows.app.lanpilot` ativo nos 3; nenhum `FATAL EXCEPTION` detectado na amostra de logcat verificada.
- `git diff --check` PASS; repositório/branch mantidos.

## Bloqueios pendentes para release
1. Cidade Dorme LAN exige **mínimo 4 jogadores**; com apenas 3 celulares, partida física integral **NÃO TESTADA**. Integração/unit tests anteriores aprovados, mas não equivalem à homologação física. iOS LAN ainda não foi implementado totalmente e não serve como quarto jogador até validação.
2. QR pela câmera física, permissão câmera, reconexão após Wi-Fi desligado, mDNS em redes diversas, hotspot, Wi-Fi de roteador isolado, Doze/lockscreen, rotação, acessibilidade/TalkBack, bateria, longa duração, falhas do host e segurança adversarial: PENDENTES.
3. Compatibilidade cruzada iOS/Android e build iOS completo bloqueados pelas tarefas G8B–G8E.
4. Teste foi guiado via DevTools/WebView nos aparelhos físicos; não substitui validação manual humana de experiência e telas.
5. Revisão de textos do pódio em empate de três: a UI concatena `Anfitrião e Jogador 2 e Jogador 3` (cosmético).

**Resultado:** smoke real Android LAN com **Impostor + Pista Única + lobby persistente + placar/campeão**: PASS em 3 aparelhos; Cidade Dorme físico: BLOCKED por quantidade mínima. **Ainda NÃO é gate completo de publicação nas lojas.**
