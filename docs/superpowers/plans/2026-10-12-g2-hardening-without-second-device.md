# Galerows — G2.1 hardening sem segundo dispositivo (12/10/2026)

**Resultado:** melhorias de G2 concluídas em código, testes unitários e integração de componentes. O gate físico G2 **ainda não está fechado**. O segundo telefone permaneceu indisponível e **não foi acessado** nesta sessão. Não houve teste completo de dois aparelhos, deploy ou instalação.

## Baseline e limites

- Repositório: `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch obrigatória preservada: `feat/multiplayer-lan-task1-wss`.
- HEAD inicial/final esperado: `fd8cc5c6f9f4a943cbeea214f3da2da58caf57dc`; `main` não alterada.
- Modificações e arquivos untracked preexistentes de G0/G1/G2 mantidos.
- Escopo exclusivo: segurança de ciclo de vida/UX/erros **dentro do G2**; **G3 NSD/mDNS, G4 autenticação e G5 game adapters não iniciados**.
- Sem novas dependências, sem alteração Java/TLS/certificate pinning/WSS framing/capability/Keystore. A mudança na camada TS de admissão é **somente** um getter booleano de encerramento autenticado existente.

## Investigações e melhorias TDD

### 1. Sala fantasma ao expirar o host

**Causa:** `LanPersistentRoomHost.stop()` zera `currentInvite` após parada nativa, mas o `RoomSessionProvider.refreshSnapshot` continuava consultando o runtime em memória e mantendo `mode='active'`. UI mostrava `Voltar à sala` com socket extinto.

- **RED:** `RoomSessionProvider.test.tsx` simulou `room_expired` nativo e constatou que a tela não retornava ao estado de entrada.
- **GREEN:** provider detecta `!hostRef.current.currentInvite` depois da parada, elimina host/runtime da sessão UI, limpa identidade e snapshot, e mostra aviso de sala encerrada/expirada.
- Não alterar `LanPersistentRoomHost`, os tempos de expiração nativos nem a identidade TLS.

### 2. Encerramento remoto que não permite retomar o guest

**Causa:** `roomClosedV2` validado já provocava `fail('room_closed')` e limpava token nativo, mas `getState()=null` era indistinguível da queda Wi-Fi, e a UI oferecia reconexão indevida.

- **RED:** teste da admissão `lanPersistentGuestAdmission.test.ts` para `wasClosedByHost()` e teste do G2 `RoomSessionGuestNavigation.test.tsx` exigindo remoção do estado ativo e ausência do botão `Reconectar`.
- **GREEN:** getter readonly `wasClosedByHost()`, sticky apenas quando recebe frame `roomClosedV2` com `roomId` correspondente (dentro de WSS já pinado). Provider distingue terminal de queda temporária, limpa contexto/UI e não oferece retomar Room revogada. `clearResumeCredential` pré-existente não foi alterado.
- Se apenas Wi-Fi cair, `wasClosedByHost() === false` e o caminho existente de resume seguro continua disponível.

### 3. Erros mais úteis e sem vazamento de segredo

**Causa:** `humanError` tratava `invite_used`, `room_full`, `secure_lan_connect_failed` e outros códigos como falha genérica, dificultando diagnóstico do ingresso físico intermitente.

- **RED:** módulo `roomSessionErrors.ts` ausente, 12 testes novos para categorias e não ecoar token de erro.
- **GREEN:** função pura `describeRoomSessionError` cobre convite expirado/usado/incompatível, tentativas excessivas, sala cheia, falha de rede local, mismatch de identidade e impossibilidade de retomar com segurança. Mensagens são *constantes* e jamais incluem mensagem bruta de exceção, convite, fingerprint ou token.
- **Ressalva:** melhora o feedback ao usuário, **não identifica retroativamente** a causa da falha de admissão do primeiro ensaio físico do G2; não alegar que a intermitência foi corrigida.

### 4. Retorno ao catálogo sem criar sala

- **RED:** teste de navegação em `RoomSessionProvider.test.tsx` não encontrava `Voltar aos jogos`.
- **GREEN:** botão de foco/acesso na tela de entrada e ingresso LAN navega para `/` sem abrir socket e sem forçar criação/entrada. Catálogo permanece a rota inicial.
- A visualização de Room ativa já possuía `Ver jogos`; essa ação foi preservada.

## Verificações realizadas nesta sessão

- **`npm test`: 572/572 PASS, 95/95 arquivos**, após todas as mudanças. Baseline anterior registrado: 557/557; +15 casos novos.
- **`npm run typecheck`: PASS**.
- **`npm run lint`: PASS**.
- **`npm run build` padrão: PASS**; checagem de assets não encontrou rotas PL-03, `RoomSessionProvider`, `roomSessionErrors` nem `pl03-entry`.
- **Build experimental separado:** `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build -- --outDir /tmp/galerows-g2-hardening-experimental`: PASS. Chunks do gerenciador e componentes LAN presentes somente nesse artefato; rotas experimentais presentes.
- **Guarda dos assets Android locais padrão:** PASS, sem referências PL-03 ou G2 em `android/app/src/main/assets/public/assets`.
- **Nenhum app instalado ou acessado em celular nesta sessão.** Android JUnit/Gradle e o ensaio físico são evidências **anteriores**, não repetidas neste hardening.
- `git diff --check` e auditoria branch/main ao final deste gate devem permanecer PASS.

## Arquivos criados/alterados nesta sessão

- `src/features/multiplayer/lan/lobby/RoomSessionProvider.tsx` — host expiry + guest terminal + uso do novo mapper.
- `src/features/multiplayer/lan/lanPersistentGuestAdmission.ts` — sinalizador terminal readonly; sem alterar handshake/frame/capability.
- `src/features/multiplayer/lan/lobby/LanPersistentLobbyScreen.tsx` — `Voltar aos jogos`.
- `src/features/multiplayer/lan/lobby/RoomSessionProvider.test.tsx` — expiração do host e retorno à home.
- `src/features/multiplayer/lan/lobby/RoomSessionGuestNavigation.test.tsx` — terminal guest.
- `src/features/multiplayer/lan/lanPersistentGuestAdmission.test.ts` — evento `roomClosedV2`.
- `src/features/multiplayer/lan/lobby/roomSessionErrors.ts` + `roomSessionErrors.test.ts` — novos.

## Gate status e parada

**G2 CODE / UX HARDENING: PASS.**
**G2 PHYSICAL TWO-DEVICE: PENDING.**
**PRODUCTION RELEASE: NOT AUTHORIZED.**
**G3/G4/G5: NOT STARTED.**

A validação final física depende do segundo celular disponível: `Room → Catálogo → mesma Room` no guest e host, round `counter` contínua, comandos após retorno, saída/fechamento explícitos, e repetição controlada para investigar intermitência do primeiro ingresso. A persistência só existe enquanto o processo hospedeiro Android mantém o provedor; encerramento do processo/reboot não são resolvidos por este gate.

**STOP:** sem commit, push, merge, reset, deploy nem alterações na `main`.
