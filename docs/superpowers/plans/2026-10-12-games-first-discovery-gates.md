# Galerows — Plano de execução por gates: catálogo → modos → salas próximas

**Data:** 12/10/2026 · **Status:** planejamento aprovado, **nenhum código autorizado por este arquivo**.
**Produto fonte:** `docs/galerows-games-modes-local-discovery-v0.2.md`.
**Branch de trabalho:** `feat/multiplayer-lan-task1-wss`. Base no início desta documentação: `84ebce4`; confirmar HEAD atual antes de agir.

## Regra de execução

Usar Superpowers **brainstorming → writing-plans → test-driven-development → verification-before-completion** (consultar skills disponíveis, nunca alegar execução se não estiverem acessíveis). Usar diretrizes UI UX Pro Max como revisão complementar, identidade Galerows prevalece. Trabalhar em pequenos gates, com testes RED→GREEN e escopo explícito. **Parar ao fim de cada gate para revisão**, principalmente antes de mudar WSS/NSD nativo e antes de integrar games reais. Não fazer `reset --hard`, `clean`, alterar `main`, instalar libs sem necessidade, push/merge/deploy nem suprimir testes existentes.

## GATE G0 — Auditoria e desenho de navegação (primeira tarefa do novo chat)

**Somente análise e documentação/design, sem implementação funcional.**

1. Auditar Git (branch/HEAD/status), `src/app/routes.tsx`, `HubScreen`, `GameCard`, `games.registry.ts`, `games.types.ts`, modo compartilhado de Impostor/Adedonha, logo e landing, lobby v2 e seus testes, feature flags, `lanPersistentInvite` e docs de PL-03.
2. Mapear a navegação atual e conflitos com UX v0.2; corrigir suposições dos docs. Registrar a diferença entre catálogo, `GameMode`, Room, membership e GameSession.
3. Comparar 2–3 variantes visuais da home, entrada por salas e seleção de modo, respeitando branding. Entrega: fluxo/esboço de estados e especificação para mobile (320/375/430/768 px); não gerar imagem arbitrária, usar mock interativo/editor adequado **somente se autorizado**.
4. Desenhar rota/lifecycle de `RoomSessionManager` **fora da tela**: atualmente o `useEffect` de `LanPersistentLobbyScreen.tsx` chama `guest.disconnect()` e `host.stop()` no unmount. Se simplesmente habilitar navegação do lobby para `/`, **a Room morre**. Propor proprietário persistente da sessão (provider/serviço raiz/singleton com lifecycle controlado) para permitir `Voltar à sala`, sem duplicar autoridade ou stores. Auditar background Android e navegação nativa.
5. Preparar contrato de dados dos modos separado de `isAvailableOffline`; registrar jogos com disponibilidade verificada e estado disabled/coming soon.
6. Fazer **revisão de risco do design de ingresso**: anúncios não autenticados, diferença entre código/segredo, TLS, possibilidade de host falso e política sem senha. Entregar matriz de trade-offs/decisão exigindo aceite antes de alterar autenticação.
7. Apresentar `G0 — proposta de UX` e `decisão pendente de segurança`. **PARAR para revisão do proprietário**.

**Aceitação G0:** docs/figuras não contradizem PL-03 e produção, estados vazios/erros contemplados, jogo compartilhado preservado, rota `/` permanece catálogo, segurança não escondida.

## GATE G1 — Home e escolha de modos, sem descoberta real

- Feature flag nova e isolada (não reutilizar indiscriminadamente `VITE_LAN_PERSISTENT_LOBBY_UI`). Ao abrir app, permanecer em `/` e no `HubScreen`; bloco LAN com `Entrar`, `Criar`, `Voltar à sala` quando possível. Sem regressão de favoritos, ordenação, anúncios ou partidas atuais.
- Adicionar capability explícita por jogo (dados tipados e testados). Não inferir multiplayer de `isAvailableOffline` e não anunciar `toy`/`counter` como jogos reais.
- Tela modal ou dedicada `Escolha como jogar` só quando jogo tiver dois modos genuínos: `Mesmo celular`/ `Cada um no seu`. Indicadores de modo nas game cards. Modo individual existente não deve ser renomeado como compartilhado.
- TDD de navegação, flags, responsividade, foco/aria e estados unavailable. Avaliação visual desktop/celular. Guard do build padrão desabilitado.
- **Parar** após testes e review de UX; nenhum NSD nem nativo neste gate.

## GATE G2 — Ciclo de vida da Room acima das rotas

- Implementar o proprietário único da Room separado do componente de tela. Explicitamente distinguir `navigate away`, `LEAVE_ROOM`, `closeRoom`, background e falha de processo host.
- Preservar WSS/Keystore, membership, `roomRevision`, `nextClientSeq`, projeções privadas e retorno ao mesmo GameSession. Nenhum `stop()` implícito ao abrir catálogo. Resync pós-navegação.
- TDD de troca `lobby→catálogo→lobby` em host/guest e segundo plano; teste físico mínimo de ambos os Android. Sem jogos reais.
- **Parar** antes de discovery.

## GATE G3 — Descoberta passiva LAN (PL-04 discovery, sem ingresso novo)

- Spike NSD/mDNS somente Android opt-in, descoberta/announcements desidentificados, isolamento de tokens, TTL/debounce, estado offline/permissões/AP isolation. Avaliar `WifiManager.MulticastLock` e manifest/permissões, liberar resources no lifecycle.
- DTO público versionado e validado; nenhum payload do WSS ou `capability` no mDNS. Room IDs visuais não conferem autoridade. Evitar varredura de IP; não depender de WAN.
- Testes JVM/TS, rejeição de anúncio inválido/falso, beacon expirado, múltiplas salas, duas interfaces `wlan0`/`swlan0`, mudança de rede.
- Ensaio físico S23/S25 FE com e sem hotspot/WAN; logging agregado sem divulgar IP/token na documentação pública. Até aprovação, permitir **listar**, não ingressar automaticamente.
- **Parar** para design review de segurança de G4.

## GATE G4 — Código de 6 dígitos + ingresso de um toque (sujeito a segurança aprovada)

- Só avançar com escolha explícita da autenticação inicial. O código é filtro de descoberta local, não autenticação de host e não substitui capability TLS. Primeira associação não pode ser descrita como segura apenas porque há WSS/mDNS.
- Geração CSPRNG host-scoped e vida da Room; preservar zeros à esquerda; colisões detectadas (UI desambiguação); código inválido/expirado/network-not-found; enumerar e bloquear abuso/flood.
- Projeto de admissão que preserve TLS pin, integridade de sessão e autorização host sem pedir senha extra; se não houver protocolo aprovado, **não** desabilitar checagem de fingerprint. QR existente funciona como fallback seguro.
- Testes RED→GREEN para host falsificado, replay, duas salas com mesmo código, full/reject, versões incompatíveis, guest reconnect, log leakage e erro de rede; ensaio físico S23/S25 FE.
- **Parar** antes de disponibilizar ao catálogo público.

## GATE G5 — Integração de jogo real e Release

- Sequência: Impostor da Palavra primeiro, Adedonha depois; terceiro jogo **TBD** e não bloquear documentação/UX por isso. Cada adapter LAN é separado da experiência no aparelho único; regras compartilhadas somente onde possível sem expor segredo.
- TDD em cada adapter: 3–12 conforme regras verificadas, papéis secretos, ingresso durante partida, host restart indisponível, troca de game, reconexão e resultados.
- Gate de Release separado: 3 celulares físicos para confirmar projeção privada entre convidados, Doze/background, multicast off, rede sem WAN e AP isolation, teste QR via câmera e TalkBack, Rx UI, logs, guard de flags, dependências, `npm test`, `typecheck`, `lint`, Gradle JUnit/Release.
- Não incluir novos jogos no catálogo LAN só porque `GameModule.status === 'available'`.

## Matriz de invariantes de arquitetura (não regredir)

| Invariante | Verificação |
| --- | --- |
| `/` = catálogo e modos offline existentes | Unit/RTL + release |
| Sala persistente apesar da navegação | Host/guest lifecycle + Android físico |
| Um único host autoritativo por Room | Comandos/join/leave rejeitados se falsificados |
| QR versionado atual continua funcional | PNG decode + câmera real |
| Código de 6 dígitos identifica somente na LAN | Duplicados/zeros/expirado/sem discovery |
| Discovery não anuncia credenciais/segredos | Parser TXT + inspeção broadcast |
| Novo auto-join não enfraquece WSS sem aprovação | Threat review + pinning/admission E2E |
| LAN v1 não sofre alteração silenciosa | Regressão v1/v2 + Gradle |
| Nenhum dado privado cruza GameSession | Projeção e resync em 2–3 participantes |
| Código experimental não entra no Release | Asset guard + APK Release |

## Arquivos-chave atuais

- Home/catalog: `src/features/hub/{HubScreen,GameCard,HubHeader}.tsx`.
- Registro: `src/features/games/{games.registry,games.types}.ts`.
- Rotas: `src/app/routes.tsx` — **index atual redireciona ao lobby quando flag PL-03 está ativa**; corrigir só no gate G1.
- Room UI: `src/features/multiplayer/lan/lobby/LanPersistentLobbyScreen.tsx`, `LobbyRoomView.tsx`, `lobbyView.ts`; a tela `LanPersistentLobbyScreen` detém refs nativas e fecha no unmount (risco crítico).
- Invite/pin: `src/features/multiplayer/lan/lanPersistentInvite.ts`, `lanSecureNativeClient.ts`, `lanPersistentGuestAdmission.ts`.
- Android: `android/app/src/main/java/com/galerows/app/LanAddressDiscovery.java` e plugins NSD a desenhar.
- Branding: `public/assets/brand/galerows-logo.svg`, `src/features/landing/`.
- Base de prova: `docs/lan-pl03-lobby-physical-2026-10-12.md`, `docs/multiplayer-persistent-lobby-spec.md`.
