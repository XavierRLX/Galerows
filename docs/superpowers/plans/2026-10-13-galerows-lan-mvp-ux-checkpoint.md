# Galerows — checkpoint LAN MVP + handoff UX/UI

**Data:** 13/10/2026
**Objetivo:** documentar exatamente o que existe no código e foi observado em aparelhos reais, criar um baseline de desenvolvimento para a próxima rodada de testes manuais e ajustes de interface.
**Branch de trabalho:** `feat/multiplayer-lan-task1-wss`. `main` preservada. **Não é release de produção.**

## 1. Escopo funcional do MVP

- **Multiplayer LAN, offline-first, sem conta e sem backend:** somente **Impostor da Palavra, Pista Única e Cidade Dorme**, com o próprio aparelho de cada pessoa, pela mesma rede local. Não há matchmaking público.
- **Demais jogos:** preservam a experiência atual em um único celular. Os três jogos com LAN também conservam suas versões de um único celular.
- **Entrada:** `Minha Galera` → criar sala ou entrar; descoberta automática na rede, código curto de 6 dígitos, alternativa por QR/convite completo com verificação de identidade. Código curto foi homologado fisicamente; câmera para QR ainda não.
- **Sala única, várias partidas:** anfitrião seleciona/configura cada jogo, todos sinalizam prontidão e jogam, resultados por partida, retorno ao mesmo lobby sem perder participantes, novo jogo sem criar sala novamente.
- **G5E — placar acumulado:** anfitrião calcula pontos autorizados, mesmo placar visível para todos, recebe pontuação de times e participantes individuais, preserva pontuação após desconexão e entre jogos, aceita campeões empatados. Ao `Encerrar disputa`, bloqueia novas partidas. **Pontuação não é persistida entre salas ou após encerramento do processo do host.**
- **Plataformas:** transporte seguro WSS e publicação/descoberta NSD Android operacionais em testes físicos; suporte iOS apenas parcial (plugin de descoberta Swift em preparação), **sem paridade LAN habilitada no iPhone**.

## 2. Gates documentados (referências de evidência)

| Marco | Evidência | Status |
| --- | --- | --- |
| G0–G4 | arquitetura/segurança, navegação games-first, background, descoberta passiva, código 6 dígitos | Implementado e coberto por testes; fluxo físico de descoberta e código: PASS |
| G5A/G5B/G5C | Impostor LAN + estabilização | PASS em uma partida completa com **3 Androids físicos** |
| G5D | entrada LAN em `Minha Galera`, removida redundância da home | Implementado; navegação física: PASS |
| G5E | placar acumulado, finalização, empate | PASS Android físico; pontuação entre Impostor e Pista Única |
| G6 | Pista Única LAN | PASS: 3 rodadas, turnos de adivinhador alternados e pontos somados ao Impostor |
| G7 | Cidade Dorme LAN | PASS em **3 Androids físicos + 1 emulador Android ARM64** |
| G8A | três jogos compartilhando Room + discovery iOS Swift inicial | Simulação e typecheck Swift PASS; **build iOS completo não homologado** |
| Release Play Store / App Store | AAB/IPA, assinaturas, política de privacidade, testes de loja | **PENDENTE — NÃO PUBLICAR** |

Documentos-fonte:
- `docs/superpowers/plans/2026-10-13-three-android-physical-gate.md` — Samsung SM-S731B (host), Galaxy S23 (convidado), Moto G6 Android 9 (convidado).
- `docs/superpowers/plans/2026-10-13-g8-android-emulator-cidade-physical-gate.md` — quarto participante virtual, Android 13/API33 ARM64, convite completo e partida de Cidade Dorme.
- `docs/superpowers/plans/2026-10-13-g8a-three-games-ios-discovery-gate.md` — integração e limitações iOS.
- `docs/superpowers/plans/2026-10-12-g5e-score-gate-report.md`, `...-g6-pista-unica-lan-gate-report.md` e `...-g7-cidade-dorme-lan-gate-report.md`.

### Evidência observada

**Impostor (3 celulares físicos):** revelações privadas, confirmação, pistas, discussão, acusação, resultados, volta ao mesmo lobby, placar concordante em todos. Uma partida testada; modos alternativos e adversariais ainda não homologados.

**Pista Única (mesma sala, 3 físicos):** rotação do adivinhador, envio de pistas individuais, 1 acerto + 2 erros, conclusão e pontuação. A competição mostrou 2 partidas concluídas e o mesmo placar nos três dispositivos. Pistas duplicadas não foram testadas fisicamente.

**Cidade Dorme (3 físicos + emulador):** quatro papéis secretos, todos prontos, assassinato, proteção médica, investigação, discussão, quatro votos, resultado, premiação da equipe da cidade `2/2/2/0`, retorno ao lobby e empate de campeões. **O vetor `2/2/2/0` está ordenado por classificação, não representa a ordem dos aparelhos.** A descoberta automática não funcionou no emulador NAT, mas a entrada pelo convite completo com conexão WSS ao anfitrião funcionou. Nos aparelhos físicos a descoberta automática funcionou.

**Estabilidade limitada:** na amostra observada, sem `FATAL EXCEPTION` do app e sem overflow horizontal no pódio (larguras CSS 360/384); não equivale a testes prolongados, acessibilidade ou cobertura de todos os estados.

## 3. Como continuar testando sem mexer no código

### Instalações e laboratório

- Aplicativo de testes: **Galerows LAN (Teste)** — pacote isolado `com.galerows.app.lanpilot`; não substitui o Galerows original `com.galerows.app`.
- Os três celulares já têm o APK de testes instalado. Uma versão nova do código **não aparece automaticamente** nesses aplicativos: para validar novos ajustes UX/UI no Android será preciso gerar um novo APK experimental e reinstalar **somente após autorização**.
- APK usado neste gate: `/tmp/galerows-physical-20261013/android/app/build/outputs/apk/debug/app-debug.apk`. **Temporário, fora do Git; não tratar como release assinado.**
- Mac mini Apple M1, 8 GB; emulador `Galerows_LAN_4`, Android 13, ARM64, 1536 MB RAM, 2 núcleos; imagem instalada oficialmente em `~/Library/Android/sdk/system-images/android-33/default/arm64-v8a`. Serial ADB: `emulator-5554`. Emulador configurado em `~/.android/avd/`.
- Host recomendado: Samsung SM-S731B, IP da sessão observada `192.168.0.89`, com S23 e Moto G6 convidados. **IP muda com DHCP**; não fixar endereço no código. Todos na mesma Wi-Fi.
- Abrir pelo ícone `Minha Galera`, não por um bloco grande na tela inicial. Criar sala no host e entrar nos convidados. Para emulador, usar texto do convite WSS completo e verificação; não esperar mDNS na rede NAT.
- O laboratório não contém credenciais ou convites permanentes no repositório; dados de sessão anteriores não servem para novas salas.

### Roteiro manual UX/UI (registrar captura + passos em cada problema)

1. **Home/catálogo:** identificação de jogo local versus LAN, indicação de 3 jogos LAN, consistência do visual com identidade Galerows, 7 outros jogos locais intactos.
2. **Minha Galera/entrada:** encontrar rapidamente `Criar sala` e `Entrar em sala`; descoberta sem digitação quando possível; mensagem clara quando não há salas; código 6 dígitos versus alternativa QR/convite.
3. **Lobby:** jogadores visíveis, apelidos, anfitrião identificado, configuração do jogo, botão `Estou pronto`, ação iniciar condicionada à prontidão, back/exit, conexão lenta ou interrompida.
4. **Impostor:** papel privado oculto por padrão, comandos suficientes para os 3 modos, avanço de pistas/temporização, acusado correto, tentativa de adivinhar, resultado.
5. **Pista Única:** clareza de quem adivinha, legibilidade dos cartões secretos, pistas repetidas/ausentes, transição de 3 rodadas, acertos/erros e pontuação.
6. **Cidade Dorme:** confirmação do papel (após confirmar ele fica oculto até mudar a fase), dono de ação noturna, estados de espera dos demais, votos por jogador, morte/eliminados, discussão, papéis finais.
7. **Placar/campeão:** pontos por equipes, empate, ausência de dupla contabilização, legibilidade dos nomes, finalização da disputa e permanência dos jogadores na sala.
8. **Responsividade e acessibilidade:** Moto G6 (360 CSS px), Samsung (384 CSS px), orientação, teclado, texto grande, alto contraste, TalkBack/foco, áreas de toque e gestos.
9. **Resiliência:** app em background, bloqueio de tela, retomada, troca de Wi-Fi, perda e reconexão de convidados, queda do host, reentrada depois de partida.
10. **Retorno aos jogos locais:** confirmar que as telas e resultados dos jogos em um único celular não foram alterados ou bloqueados pelo LAN.

### Itens de UX observados para revisão, não classificados automaticamente como falhas

- No Cidade Dorme, `Confirmar meu papel` oculta a carta e a ação de revelação fica indisponível até a próxima fase; conferir se essa orientação está suficientemente clara para quem joga.
- Atualizações da tela em Moto G6/emulador podem chegar com atraso breve; não antecipar controles nem apresentar loading confuso.
- Texto de três campeões empatados foi `Anfitrião e Jogador 2 e Jogador 3`; melhorar redação natural e apresentação visual do pódio.
- Verificação da entrada por QR via câmera real **pendente** (não inferir sucesso do QR por ter testado o convite completo).
- Confirmar que estado `LAN experimental` versus `LAN em preparação` do catálogo não confunde a versão que o usuário está testando.
- Testar o que ocorre ao sair/voltar às telas do app durante uma sessão e se o lobby ativo continua óbvio.

## 4. Bloqueios de lançamento ainda abertos

**P0 Android:** teste físico de QR/câmera, reconexão real e retomada, falha do host, Doze/background, hotspot/isolamento entre clientes, estresse/latência e checagem de segurança/versões de API. Mais combinações dos 3 jogos e **quatro aparelhos reais** para uma homologação final de Cidade Dorme (o gate atual tem 1 emulador).

**P0 iOS:** implementar/estabilizar cliente/host WSS nativos e descobrir salas com identidade e permissões corretas; compilar o app completo e validar iPhone ↔ Android, segurança e UI em iOS. Foi verificada tipagem isolada do plugin Swift; compilação integral iOS bloqueada por componentes de plataforma Xcode ainda não instalados na auditoria anterior. Não afirmar paridade iOS.

**P1 lojas:** release flags fechadas até gate, novo AAB e IPA assinados, privacidade/declarações SDK, permissões, capturas, textos, classificação etária, testes Play Console/TestFlight, revisão humana e eventual aprovação. O debug APK isolado não pode ser enviado à loja.

**P1 persistência e produto futuro (fora deste MVP):** histórico após fechar sala, contas/servidor online, matchmaking, novos jogos LAN. Não acrescentar sem decisão explícita.

## 5. Regras de continuidade / segurança de branch

- Não perder nem resetar o trabalho G0–G8. Evoluir em branch de feature dedicada para cada ajuste UX/UI, com escopo, testes e gate curto.
- Não presumir que o commit deste checkpoint habilita multiplayer na Production; os dois flags experimentais são `VITE_GAMES_FIRST_LAN_ENTRY=1` e `VITE_LAN_PERSISTENT_LOBBY_UI=1`. Build padrão deve continuar sem rota LAN experimental.
- Quando terminar UX/UI, repetir testes, typecheck, lint, build padrão + experimental e validação visual/física adequada. Não fazer push, merge, instalar nos aparelhos ou publicar sem autorização.
- Conservar a experiência de jogo local e as regras dos três jogos LAN, a menos que o ajuste UX/UI tenha requisitos explícitos.
