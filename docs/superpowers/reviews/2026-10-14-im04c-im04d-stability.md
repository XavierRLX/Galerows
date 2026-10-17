# Galerows — IM-04C / IM-04D: cronômetro local e robustez LAN

Data: 14/10/2026.
Repositório: `/Users/renanxavier/Documents/GitHub/galerows`
Branch preservada: `feat/ux-hub-header-brand`, HEAD inicial `8ec6a01`.
Execução por Remote Desktop Commander no Mac-mini-de-Renan.local com Superpowers (TDD, systematic-debugging e verification-before-completion).
Não houve commit, push, deploy, reinstall, merge ou mudanças em main. Todas as alterações locais pré-existentes foram preservadas.

## Requisito de produto que não pode regredir

- **1 celular:** papéis revelados passando o aparelho; pistas e votos ocorrem entre amigos presencialmente; uma pessoa registra somente o acusado final no app. Não existe votação individual por aplicativo.
- **LAN:** cada jogador usa o próprio celular e vota individualmente no app, com voto privado e segundo turno quando necessário.
- Os dois modos compartilham tipos e opções do impostor e formato de pistas; as diferenças acima são deliberadas.
- O cronômetro é opcional e **não decide automaticamente o fim da conversa nem antecipa votação**.

## IM-04C — cronômetro também no modo 1 celular

- Configuração local recebeu as mesmas opções existentes no LAN: 0, 120, 180 ou 300 segundos.
- A contagem inicia apenas quando o organizador toca em **Começar as pistas**, depois de todos verem sua identidade.
- Temporizador mostrado na etapa de pistas e na discussão, sem interromper conversa/votação quando atinge zero.
- Nova propriedade opcional `timerSeconds` na configuração e `timerStartedAt` na sessão local; mantém `schemaVersion: 1` e aceita sessões persistidas legadas sem esses campos.
- Reinicia o cronômetro para cada nova rodada; os dados da rodada são persistidos no store local existente.
- Textos pt-BR, en-US, es-419, com voto presencial explicitado.
- Testes TDD: `impostorLocalTimer.test.ts` (3 casos) e `ImpostorLocalTimerFlow.test.tsx` (1 caso). Os testes falharam inicialmente pelos motivos esperados (ausência do recurso) e passaram após implementação.

Arquivos novos:
- `src/features/impostor-da-palavra/ImpostorLocalTimer.tsx`
- `src/features/impostor-da-palavra/impostorLocalTimer.test.ts`
- `src/features/impostor-da-palavra/ImpostorLocalTimerFlow.test.tsx`

Arquivos modificados:
- `impostorDaPalavra.types.ts`, `impostorDaPalavra.session.ts`, `impostorSharedConfig.ts`
- `ImpostorDaPalavraSetupScreen.tsx`, `ImpostorDaPalavraPlayScreen.tsx`
- JSON i18n nos três idiomas.

## IM-04D — três provas adicionais de robustez da Room autoritativa

Novo arquivo: `src/features/multiplayer/impostorLanStability.test.ts`.

1. Desconexão depois de confirmar voto; restaura mesma GameSession, não entrega segredo nem permite alterar/duplicar voto. END_GAME não pode pontuar duas vezes.
2. Desconexão antes de votar; contagem fica pendente e só chega ao resultado depois que o membro original reconecta e vota.
3. Quatro participantes, empate 2 a 2, runoff restrito a candidatos empatados, vitória sem vazamento de votos; RETURN_TO_LOBBY preserva todos os jogadores e zera READY; nova GameSession tem ID próprio, segredos novos, rejeita comando de sessão antiga, conserva placar de duas partidas.

**Escopo de prova:** integrações automatizadas com `AuthoritativeRoomRuntimeV2` real, sem WebSocket/Android nesta nova bateria. Não substituem homologação física.

## Evidências de verificação

- Primeira bateria após IM-04D: `719/719` testes, 120 arquivos, TypeScript, ESLint, build padrão e build LAN: PASS.
- Segunda bateria após IM-04C: `723/723` testes, 122 arquivos: PASS.
- ESLint inicialmente identificou 4 erros novos (setState em efeito e variáveis de teste não usadas), corrigidos sem alterar semântica.
- Após correção: `npm run lint`, `npm run typecheck`, testes direcionados (7/7), `git diff --check`: PASS.
- Após todas as correções, nova suíte completa `npm test` PASS: **723/723 testes em 122 arquivos**; build padrão e `VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` PASS (exit 0); `git diff --check` PASS. ESLint e typecheck também PASS nesta versão.
- Logs no Mac: `/tmp/galerows-im04-final-suite.log`, `/tmp/galerows-im04-final-standard.log`, `/tmp/galerows-im04-final-lan.log`, `/tmp/galerows-im04-final-lint.log`, `/tmp/galerows-im04-final-types.log`.

## Gate físico (ainda ABERTO)

- Em auditoria de ADB desta execução: 1 Samsung Galaxy S23 e 1 emulador Android conectados. O Impostor requer >=3 participantes; não há 3 aparelhos disponíveis nesta sessão para repetir validação real de empate/reconexão/segunda partida.
- Teste físico histórico de 14/10 validou início até retorno ao lobby com 2 Samsung + 1 emulador, sem cobrir estes novos cenários.
- Pendências: 3+ dispositivos reais/emulados na mesma Room via LAN WSS; empate 2:2 requer 4 participantes; reconexão em voto confirmado e pendente; segunda partida completa; QR pela câmera física; UX visual das opções novas de cronômetro no Android.
- Não habilitar multiplayer iOS nem declarar release production enquanto gates específicos não forem concluídos.

## Próximo passo

Homologação física nas condições acima, revisar diffs/estado do usuário, separar commits pequenos e só então considerar release. Não há mudança a fazer no sistema de votação presencial do modo 1 celular.
