# Galerows — Gate IMPOSTOR-MVP (local + LAN)

Data da auditoria/implementação: 14/10/2026.
Dispositivo: Mac-mini-de-Renan.local.
Repositório: /Users/renanxavier/Documents/GitHub/galerows
Branch preservada: feat/ux-hub-header-brand (base 8ec6a01).
Estado: **PARTIAL / PENDENTE homologação final**, não por diferença de votação entre os modos, mas por cenários físicos ainda sem evidência. A votação presencial (1 celular) e a votação digital (LAN) são intencionalmente diferentes.
Não houve commit, push, merge, deploy, reinstalação ou alteração intencional da main.

## Fontes e condições

- Superpowers: using-superpowers, test-driven-development, executing-plans e verification-before-completion, lidos da instalação local Codex.
- Início: dezenas de alterações existentes em LAN, rotas, UI, QR e documentos. Preservadas; sem limpeza/stash/reset.
- Trabalho com arquivos novos/limites cirúrgicos, sem refazer o fluxo LAN homologado.
- Relatório físico anterior: docs/superpowers/reviews/2026-10-14-impostor-lan-native-3-device.md.

## IM-01 — Auditoria: PASS

- Modo 1 celular: `ImpostorDaPalavraHomeScreen`, setup, sessão/store locais e Preferences; independente de LAN.
- Multiplayer: `LobbyRoomView`, `impostorLanGame`, `ImpostorImmersiveRound`, Room persistente e host autoritativo.
- Três modos secretos e dois formatos de conversa aparecem nos dois fluxos.
- Diferenças intencionais: no modo local, os amigos discutem e votam **entre si, presencialmente**; só depois uma pessoa registra o acusado no celular, sem votos digitais individuais. O fluxo local mantém a chance final e o ciclo de N rodadas. No LAN imersivo, cada pessoa vota e confirma no seu próprio celular, com segundo turno em empate e resultado sincronizado. Timer opcional 0/120/180/300 presente apenas no LAN.
- Platform gate é Android nativo + `VITE_LAN_PERSISTENT_LOBBY_UI=1`; web/iOS não oferecem rota LAN funcional.

## IM-02 — Configuração de núcleo compartilhada: PASS (escopo base)

Arquivo novo: `src/features/impostor-da-palavra/impostorSharedConfig.ts`.
- Única fonte de verdade para `IMPOSTOR_MODES` e `CONVERSATION_MODES`.
- `ImpostorDaPalavraSetupScreen` usa essas opções.
- O domínio local valida os mesmos valores que `impostorLanGame`.
- Na configuração local, campos inesperados são rejeitados; LAN mantém sua extensão validada `flow`/`timerSeconds`.
- TDD RED: nova regressão `impostorDaPalavra.session.test.ts` falhou ao constatar aceitação de campo inesperado.
- TDD GREEN: regressão e testes LAN passaram após extração/uso da validação comum.
- Configuração de identidade e pistas é compartilhada. A votação não deve ser unificada: presencial no modo local e individual pelo app no LAN. Diferenças de timer, pontuação e quantidade de rodadas devem ser documentadas e só alteradas por uma decisão específica de produto.

## IM-03 — Entrada explícita de modos: PASS (automatizado); homologação visual Android pendente

- Novo `ImpostorModeEntry.tsx` na home do jogo, com modos `1 celular` e `Vários celulares`.
- Modo 1 celular abre setup ou retoma a sessão local; não cria Room.
- Multiplayer habilitado abre `/__lan-lobby-v2/criar` ou `/__lan-lobby-v2/entrar`.
- Plataformas sem recurso LAN habilitado exibem botões desativados com justificativa, sem navegação inválida.
- Chave de disponibilidade LAN usa o gate nativo existente; iOS não foi habilitado.
- Texto em pt-BR, en-US e es-419.
- Removido CTA fixo duplicado de configurar quando não há sessão; CTA fixo de continuar é preservado.
- TDD RED: `ImpostorPlayModeEntry.test.tsx` iniciou com 2 falhas esperadas.
- TDD GREEN: os 2 testes novos passaram; regressão do fluxo local também passou.
- Homologação visual da nova home em Android físico está pendente.

## IM-04 — Partida real: PARTIAL

- Evidência física anterior (14/10): 2 celulares Samsung + 1 emulador, em LAN WSS real, realizaram Room, READY, START_GAME, segredos privados, pistas, timer, votos individuais, resultado e RETURN_TO_LOBBY na mesma Room.
- Não alteramos essa mecânica LAN neste trabalho.
- Ainda pendem empate com segundo turno, reconexão durante a votação, segunda partida completa e leitura óptica via câmera física.
- **Decisão de produto confirmada em 14/10:** não criar votação por tela no modo 1 celular. Após discussão e votação dos amigos presencialmente, uma pessoa escolhe no aparelho somente o acusado final. Não há passagem de celular para votar nem contagem de votos no app local.
- No modo LAN, a votação permanece individual e digital, no celular de cada participante, controlada pela autoridade da Room.
- A diferença de votação é intencional, **não é bug nem bloqueio de paridade**. Não alterar o mecanismo clássico local nem migrar sessões legadas por esse motivo.
- Textos explicativos no app revisados em pt-BR, en-US e es-419: escolha do modo, instruções da discussão e registro da acusação.

## IM-05 — Verificação: PASS para alterações deste lote; gate final físico pendente

Comandos executados em 14/10 após as alterações:
- `npm test` -> 119 arquivos, **716/716 tests PASS**, exit 0.
- `npm run lint` -> PASS, exit 0.
- `npm run typecheck` -> PASS, exit 0.
- `npm run build` -> PASS, exit 0 (antes do último alinhamento de contrato, seguido de build experimental).
- `VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` -> PASS, exit 0 (versão final do lote).
- `git diff --check` e status final: verificar antes de qualquer commit.

Logs: /tmp/galerows-impostor-final-tests.log, /tmp/galerows-impostor-final-lint.log e /tmp/galerows-impostor-final-lan-build.log.

## Próxima execução, nesta ordem

1. IM-04A — FECHADO: manter votação presencial entre amigos no modo 1 celular, registrando somente o acusado. Manter voto individual no próprio celular no LAN. Não unificar métodos de votação.
2. IM-04B — CANCELADO POR DECISÃO DO USUÁRIO: não implementar tela individual de voto no aparelho compartilhado. Preservar funcionamento e saves locais.
3. IM-04C: confirmar se timer opcional e chance final devem ou não ser diferentes entre ambientes; não modificar sem requisito expresso.
4. IM-04D: homologar empate, reconexão e segunda partida LAN na mesma Room em 2+ aparelhos, além do QR físico.
5. IM-05 final: homologar explicação dos modos no Android, rodar regressão e revisar diffs; somente então criar commits pequenos e considerar release.

**Não marcar IMPOSTOR-MVP global como PASS enquanto houver cenários físicos críticos sem evidência. A diferença de votação entre 1 celular (presencial) e LAN (digital) é requisito aceito e não impede aprovação.**
