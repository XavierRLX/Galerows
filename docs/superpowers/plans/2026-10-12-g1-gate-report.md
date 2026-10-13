# Galerows — G1 games-first: relatório do gate (12/10/2026)

**Resultado:** G1 IMPLEMENTADO E VALIDADO NO ESCOPO DE CÓDIGO WEB/ROTEAMENTO; **NÃO É APROVAÇÃO PARA RELEASE**, e G2/G3/G4/G5 não foram iniciados.
**Branch:** `feat/multiplayer-lan-task1-wss`; HEAD mantido `fd8cc5c6f9f4a943cbeea214f3da2da58caf57dc`; `main` mantida `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`. **Sem commit/push/merge/deploy/reset**. As duas especificações G0 estavam **untracked no início** e foram preservadas.
**Execução:** Remote Desktop Commander no Mac; Superpowers `brainstorming`, `writing-plans`, `test-driven-development`, `verification-before-completion` consultados. UI UX Pro Max não localizada; aplicado o sistema visual existente, sem inventar redesign de marca.

## 1. Produto / UX entregue

1. `/` é sempre `HubScreen` com o catálogo completo (10 jogáveis + 3 “Em breve”), inclusive quando o lobby experimental está habilitado. Não abre Room automaticamente; nenhuma rede nem conta necessária para conhecer jogos.
2. `GameCard` preserva estilo/capa/ação de jogar, favoritos/recente/descoberta/ads e acrescenta “Conhecer jogo” para acessar a página de descrição/regras existente. Mostra modo local real por jogo e `LAN em preparação` **somente** no Impostor da Palavra e Adedonha.
3. Registro explícito `gameModes.registry.ts`: Impostor usa aparelho compartilhado; Adedonha tem folha **local individual**, não chamada sincronizada; demais jogos usam rota local existente; `LAN available` é propositalmente **impossível** no tipo deste gate. `toy/counter` não entram no catálogo público.
4. `HomeRoomActions`: ao habilitar **ambas** `VITE_GAMES_FIRST_LAN_ENTRY=1` e `VITE_LAN_PERSISTENT_LOBBY_UI=1` em runtime Capacitor nativo, o bloco LAN aparece na home; Entrar abre o formulário QR/convite seguro do PL-03, Criar abre a entrada de host do PL-03. São rotas experimentais, **não** descoberta de salas por NSD nem ingresso novo.
5. Sem `Voltar à sala` antes de G2: atualmente o componente `LanPersistentLobbyScreen` destrói conexão no unmount. Aviso de limitação na própria UI. Jamais anunciar persistência entre navegação enquanto ela não existe.
6. `scripts/lan/pl03-ui-physical.mjs` foi ajustado para entrar explicitamente na rota de probe caso o app abra no Hub. Mantém compatibilidade com o fluxo anterior que já abre a tela PL-03; **não reexecutado em aparelhos neste gate**.

**Alternativa UX aprovada:** catálogo + ações LAN compactas (alternativa A). Nenhuma alteração de cores/logo/landing do Galerows; sem criar segunda home.

## 2. TDD e verificação técnica

- **RED verificado:** testes novos de modos falharam por módulo ausente, os de cards falharam por rótulos/CTA inexistentes e os de atalhos por componente ausente. Teste da advertência de lifecycle falhou explicitamente antes de inserir a cópia.
- **GREEN verificado:** 29/29 testes dirigidos após implementação inicial; regressão final completa `npm test`: **550/550 PASS, 92/92 arquivos**.
- `npm run typecheck`: **PASS**, executado após as últimas alterações TS/TSX.
- `npm run lint`: **PASS**.
- `npm run build` padrão: **PASS** (inclui `test:content` + tsc + Vite).
- **Guard Release padrão:** busca nos assets por `__lan-lobby-v2`, `LanPersistentLobbyScreen`, `pl03-entry`, `__lan-room-v2`: **PASS, nenhum resultado**.
- **Build experimental isolado:** `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 vite build --outDir /tmp/galerows-g1-experimental`: **PASS**; chunks da `HomeRoomActions` e `LanPersistentLobbyScreen` presentes; `dist` padrão permaneceu limpo.
- `node --check scripts/lan/pl03-ui-physical.mjs`: **PASS**; expressão de navegação da automação validada sintaticamente. **Não substitui teste físico**.
- Android `./gradlew :app:testSecureProbeUnitTest --offline`, com `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home` (JDK 21): **BUILD SUCCESSFUL**, tarefa **UP-TO-DATE** (não reexecutou fisicamente as 37 JUnit). O registro PL-03 histórico é 37/37.
- `git diff --check`: **PASS**; nenhum arquivo Java/Android nativo alterado.

## 3. Arquivos G1 criados/alterados

**Criados:**
- `src/features/games/gameModes.registry.ts`
- `src/features/games/gameModes.registry.test.ts`
- `src/features/hub/HomeRoomActions.tsx`
- `src/features/hub/HomeRoomActions.test.tsx`
- `src/features/hub/GameCard.gamesFirst.test.tsx`
- `docs/superpowers/plans/2026-10-12-g1-games-first-implementation.md`
- Este relatório.

**Modificados:**
- `src/app/routes.tsx`
- `src/features/hub/HubScreen.tsx`
- `src/features/hub/HubScreen.test.tsx`
- `src/features/hub/GameCard.tsx`
- `src/features/multiplayer/lan/lobby/LanPersistentLobbyScreen.tsx` — apenas `initialMode` UI
- `src/features/multiplayer/lan/lobby/LanPersistentLobbyScreen.test.tsx`
- `scripts/lan/pl03-ui-physical.mjs` — compatibilidade de navegação do ensaio.

**Preservados sem alteração (preexistentes untracked):**
- `docs/superpowers/specs/2026-10-12-games-first-g0-ux-architecture.md`
- `docs/superpowers/specs/2026-10-12-g0-lan-discovery-security-review.md`

## 4. Riscos, bloqueios e não-escopo

- **Crítico / G2:** PL-03 atual ainda chama `host.stop()` e `guest.disconnect()` no unmount; o atalho de Room ativa **não** foi habilitado. A saída por navegação/back em preview experimental pode encerrar sessão; comunicado na interface. Não publicar como experiência completa.
- **G3:** NSD/mDNS passivo sem rede ampla nem token em anúncios; nenhum código criado neste gate.
- **G4:** ingresso em um toque para host desconhecido **NÃO autenticado** por seis dígitos/mDNS; QR seguro atual continua exigindo comparação presencial; nenhuma mudança TLS/pin/capability/vault ou novo protocolo feita.
- **G5:** Impostor/Adedonha ainda **sem adapter LAN real**; terceiro indefinido.
- **QA pendente:** sem novo ensaio físico em dois Samsung, sem TalkBack, sem screenshots automáticos de 320/375/430/768, sem câmera QR real ou teste de background prolongado neste G1.
- **Feature flag release:** G1 como opt-in experimental; sem flag, botões LAN não aparecem no build padrão porque ainda não há sala pública certificada.

## 5. Decisão e próximo gate

**Recomendação: PARAR PARA REVISÃO.** O próximo gate **G2** deve extrair um `RoomSessionManager` único para fora da tela/rotas, testar `lobby → catálogo → lobby` com host e guest sem derrubar Room e mostrar “Voltar à sala” somente ao confirmar sessão recuperável. TDD/red-green em snapshot privado, `roomRevision`, `gameSessionId`, background/back, saída explícita e reconexão Keystore. Só depois avançar G3, descoberta NSD, e revisão de segurança G4. Nenhum commit/deploy neste gate.
