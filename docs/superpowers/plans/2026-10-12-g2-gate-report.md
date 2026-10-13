# Galerows — Gate G2: sala persistente entre telas (12/10/2026)

**Situação:** implementação G2 concluída; **PASS em testes automatizados, validação física PARCIAL / bloqueio para encerramento integral do gate**. **G3, G4 e G5 NÃO iniciados.** Não tratar este relatório como autorização de produção.

## 1. Auditoria / controles Git

- Repositório: `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch preservada: `feat/multiplayer-lan-task1-wss`.
- HEAD preservado: `fd8cc5c6f9f4a943cbeea214f3da2da58caf57dc`; referência `main` preservada: `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`.
- Alterações G0/G1 e arquivos previamente untracked foram preservados. Sem `reset`, commit, push, merge, deploy, instalação de dependências ou alteração do app de produção nos celulares.
- `git diff --check`: PASS após todos os trabalhos.

## 2. Resultado técnico

1. A Room WSS, o runtime autoritativo, o host e guest nativos, as sequências dos comandos, snapshots públicos/privados e o polling pertencem agora ao `RoomSessionProvider` persistente, **acima de `AppRoutes`**; não à instância da tela LAN.
2. O `LanPersistentLobbyScreen` foi convertido em tela consumidora do contexto. Entrar/sair dessa rota **não chama** `host.stop()` nem `guest.disconnect()`. Apenas o término explícito da Room ou o desmontar do provedor raiz libera o transporte. Há proteção contra `start` assíncrono concluído após desmontagem do provedor.
3. A home continua games-first: os 13 cards (10 disponíveis + 3 futuros) estão visíveis. `HomeRoomActions` mostra `Voltar à sala` **somente** se o contexto aponta Room ativa. `LobbyRoomView` oferece `Ver jogos`. Esse banner não transporta convite, token, fingerprint ou carta secreta.
4. Uma queda de guest oculta sua projeção privada antes de reconectar. O fluxo existente de admissão WSS com pin da identidade TLS, código de verificação presencial, capability e vault/resume Android continua intocado.
5. Tudo restrito à combinação experimental **nativa** `VITE_GAMES_FIRST_LAN_ENTRY=1` **e** `VITE_LAN_PERSISTENT_LOBBY_UI=1`; bundle normal sem Room/lobby experimental. Não há descoberta NSD/mDNS, senha de seis dígitos como autenticação, nem adapters multiplayer de jogos reais.

## 3. Arquivos relevantes

**Novos:** `src/features/multiplayer/lan/lobby/RoomSessionProvider.tsx`, `RoomSessionContext.ts`, `RoomSessionProvider.test.tsx`, `RoomSessionGuestNavigation.test.tsx`, `docs/superpowers/plans/2026-10-12-g2-persistent-room-navigation.md`, `scripts/lan/g2-active-navigation-physical.mjs`, este relatório.

**Modificados em G2:** `src/app/App.tsx`, `src/features/multiplayer/lan/lobby/LanPersistentLobbyScreen.tsx`, `LobbyRoomView.tsx`, testes do lobby e da `HomeRoomActions`, `src/features/hub/HomeRoomActions.tsx`, `scripts/lan/pl03-ui-physical.mjs` (roteiro de G1 adaptado e acrescentados checkpoints G2). Modificações G1/G0 anteriores continuam no mesmo working tree sem commit.

## 4. TDD e verificações

- RED explícito: teste da extração ausente e teste da corrida `start` nativo após unmount falharam antes do código corretivo.
- `npm test`: **557/557 PASS, 94/94 arquivos** na suíte integral após os ajustes finais.
- `npm run typecheck`: **PASS** (incluindo revalidação pós-teste físico).
- `npm run lint`: **PASS** (incluindo revalidação pós-teste físico).
- `npm run build` padrão: **PASS**.
- Build isolado experimental: **PASS**, chunks de `RoomSessionProvider`, `RoomSessionContext`, `HomeRoomActions` e lobby presentes no bundle experimental.
- Guard do build normal: **PASS** — ausência de rotas/componentes experimentais tanto em `dist/assets` quanto em `android/app/src/main/assets/public/assets` após restauração via build sem flags + `cap copy android`.
- `./gradlew :app:testSecureProbeUnitTest --offline` com JDK 21: **BUILD SUCCESSFUL / UP-TO-DATE**. Não alegar reexecução material das 37 JUnit; 37/37 é evidência histórica de PL-03.
- `./gradlew :app:assembleSecureProbe --offline`: **BUILD SUCCESSFUL**; APK isolado `com.galerows.app.secureprobe` instalado apenas como substituição deste pacote de teste, sem tocar em `com.galerows.app`.
- `node --check`: **PASS** nos dois roteiros físicos; `git diff --check`: PASS.

## 5. Testes físicos — evidência real e bloqueador

Equipamentos Android 16 na mesma rede local: **Galaxy S23** host e **Galaxy S25 FE** guest. ADB/CDP e variante `secureprobe` existentes, sem mudanças no aplicativo de produção.

1. **Primeiro roteiro completo:** o S23 criou Room TLS/WSS e QR/convite; a admissão inicial do S25 FE não terminou e o roteiro encerrou com `PL03_PHYSICAL_UI_INCOMPLETE timeout_guest_admitted`. O código preciso da causa não pôde ser obtido. Rede local testada: ICMP e TCP entre os aparelhos com êxito e handshake TLS 1.3 visível. **Não declarar esse roteiro PASS.**
2. **Tentativa autenticada renovada:** novo convite em Room existente permitiu ingresso do S25 FE. Diagnóstico sanitizado resultou `JOIN_RESULT=SUCCESS`, `JOIN_ACTIVE=true`, sem erro exibido; após ingresso, host apresentou **revision 02 / dois membros**. A falha anterior deve permanecer registrada como intermitência não explicada.
3. **Persistência do host no aparelho físico (PASS):** S23 `Room → Catálogo 10 jogos disponíveis → Voltar à mesma Room`, manteve `revision 02` e **dois membros**. Evidência `G2_HOST_PHYSICAL_NAV_PASS`.
4. **Persistência do guest e jogo em progresso (NÃO VERIFICADA):** S25 FE **saiu do ADB USB** após a admissão, perdendo o forward CDP na porta 9223. O novo roteiro `scripts/lan/g2-active-navigation-physical.mjs` não completou, por `ECONNREFUSED` no CDP do segundo aparelho; **não é evidência de falha da Room, nem de êxito da navegação**. Requer conexão física restabelecida e execução inteira do roteiro, incluindo `counter` antes/depois das rotas, prontidão/ações e saída terminal.
5. A sala experimental do host foi encerrada explicitamente, com `EXPERIMENTAL_HOST_ROOM_CLOSED=true`, para não deixar host nativo ativo.
6. Os **assets locais Android foram restaurados** ao build padrão sem flags após a instalação experimental: guard positivo (sem código experimental), nenhuma mudança tracked em fontes Java/nativas.

Logs não devem incluir segredos: `/tmp/galerows-g2-physical-2026-10-12.log` (primeiro roteiro, resultado incompleto) e a saída de diagnóstico e do teste host neste chat. Scripts físicos não imprimem convite, fingerprint ou carta privada.

## 6. Pendências e próximos gates

**G2 — código validado, gate físico ainda pendente:**
- Reconectar S25 FE via USB/ADB; confirmar rede local compartilhada.
- Reexecutar roteiro integrado físico dos dois aparelhos no APK `secureprobe`, incluindo convidado `sala → jogos → sala`, WSS/Room e partida `counter` mantida enquanto ambos navegam, comando após retorno, saída confirmada e encerramento pelo host. Corrigir de modo testável qualquer intermitência reproduzível.
- Não afirmar sobrevivência do host ao encerramento do **processo Android** ou ao reboot: provider é in-memory. Background longo/Doze, gesto voltar do sistema, TalkBack, leitor QR físico e múltiplos convidados não são certificados por este gate.
- **Somente após G2 físico aprovado** considerar G3 (NSD/mDNS); antes de G4 exigir decisão explícita sobre autenticação de desconhecidos/QR e revisão de segurança. Nada de retirar pinning/TLS/capability só porque a sala tem seis dígitos.

**PARAR PARA REVISÃO.** Sem commit, push, deploy ou implementação de gates posteriores.

## Atualização G2.1 — hardening sem segundo celular (12/10/2026)

Relatório complementar: `docs/superpowers/plans/2026-10-12-g2-hardening-without-second-device.md`.

Após correções adicionais em sala expirada, encerramento autenticado do guest, mensagens seguras e retorno à home: **572/572 Vitest PASS**, TypeScript PASS, ESLint PASS, build padrão e experimental PASS, proteção de assets Release PASS. Esses números **substituem somente a contagem automatizada anterior**; a validação física de dois aparelhos permanece **PENDENTE**. Nenhum aparelho foi acessado nessa atualização, e nenhum gate posterior foi iniciado.

## Atualização G2.2 — segundo plano e privacidade (12/10/2026)

Relatório: `docs/superpowers/plans/2026-10-12-g2-2-gate-report.md`. Revalidação de Room ao voltar do background, ocultação da carta secreta ao perder foco e invalidação de erros assíncronos de QR após término da Room, com RED → GREEN. **577/577 Vitest PASS (95 arquivos), TypeScript PASS, ESLint PASS, build padrão/experimental PASS, Release flag guard PASS.** O segundo aparelho segue indisponível; **G2 físico continua pendente**. A partir da autorização explícita posterior do usuário para continuar sem testes, apenas G3 passivo passou a ser permitido; G4/G5 e produção continuam bloqueados.

## Atualização G3 — descoberta passiva, testes adiados (12/10/2026)

Autorização posterior: continuar desenvolvimento sem segundo aparelho e adiar testes. G3 foi implementado em código nativo Android + tela Entrar em sala sem mudar WSS/pinning/credenciais; relatório em `docs/superpowers/plans/2026-10-12-g3-passive-discovery-report.md`. TypeScript/ESLint/Java compile e builds padrão/experimental PASS. **Nenhum teste G3 executado ou gate físico aprovado.** A documentação anterior registra corretamente as restrições então vigentes; este novo aceite libera apenas o G3 de descoberta passiva, não ingresso G4 nem jogos reais G5.
