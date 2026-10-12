# Galerows — Task 6: handoff de interface LAN (11/10/2026)

**Gate anterior:** micro-gate Task 5 revisado e aprovado tecnicamente para avanço a Task 6. TDD e evidências: `docs/lan-task5-resume-evidence.md` (seção "Micro-gate corretivo — confirmação do ingresso inicial"). Não houve novo ensaio físico do handshake corrigido: deve ser testado em dois Androids na Task 6.

**Repositório:** `/Users/renanxavier/Documents/GitHub/galerows`; branch `feat/multiplayer-lan-task1-wss`; HEAD histórico `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`. Todas as alterações e arquivos untracked das Tasks 1–5 devem permanecer. Sem commits/merge/push; main não pode mudar.

## Escopo autorizado

Implementar **somente Task 6** do plano `docs/superpowers/plans/2026-10-11-lan-core-integration.md`: UI mínima de criar/entrar em sala LAN no app Android, usando os contratos já existentes. Sem multiplayer de jogo real, sem Impostor/Adedonha novos, sem Task 7, iOS, Supabase ou backend.

### Fluxo do anfitrião

1. Criar uma sala de teste com `LanRoomHost`, `AuthoritativeRoomRuntime` e um `GameAdapter` mínimo de teste sem dados secretos reais; host como membro local.
2. Descobrir/selecionar IP LAN da interface Wi-Fi/hotspot **sem hardcode**. Priorizar mecanismo confiável no Android; se a descoberta exigir mudança nativa, investigar e manter a alteração mínima. Exibir IP/porta para diagnóstico e tratar interface ausente, offline e IP alterado.
3. Exibir convite `galerows-lan-v1:` codificado como QR via `qrcode`, texto copiável/entrada manual e código presencial de verificação. Convite tem prazo de 120 s, uso único e precisa renovar sem confundir o usuário após consumo/expiração/mudança de IP; nunca registrar a capacidade em logs.
4. Mostrar estado da sala, jogadores/disconexões, botão de encerrar sala e confirmação, sem permitir operações de jogo real.

### Fluxo do convidado

1. Ler QR pela câmera usando `jsqr` e avaliar reaproveitamento de `AdedonhaQrScanner` apenas como mecanismo de câmera, **não como formato ou fluxo da Adedonha**; permitir colar/digitar o convite integral como fallback. Liberar a câmera após leitura, erro, fechar e desmontagem.
2. Distinguir formatos: QR legado da Adedonha nunca vira convite LAN; QR LAN nunca é interpretado como QR Adedonha.
3. Validar tamanho/versão/expiração e exibir erro útil para convite inválido, já utilizado, vencido, IP inacessível, falta de permissão de câmera, pin TLS divergente, sala encerrada e timeout.
4. Exibir código do host somente após TLS verificado; exigir digitação/comparação **presencial com a tela do anfitrião fora do QR**. Nunca aprovar silenciosamente.
5. Mostrar progresso `conectando → verificando anfitrião → ingressando → confirmando credencial → na sala` coerente com `LanIngressClient`/`LanRoomSession`; a UI só mostra "na sala" **após `admissionConfirmed`**, não em `admitted` ou abertura de socket.
6. Disponibilizar sair, perda de conexão, retomada autenticada com `LanRoomSession.resume`/credencial do Keystore e tentativas automáticas limitadas com feedback, sem gerar novo `playerId`. Distinguir `connection_lost` de `room_closed` e de retomada impossível; se o host morrer abruptamente, não afirmar fechamento definitivo sem prova.

### UX e isolamento

- Funciona entre **dois aplicativos Android instalados**, não browser/PWA nem links HTTP de convidados; sem dependência de Internet. Deve respeitar identidade do Galerows, responsividade e acessibilidade. Não exibir QR/tokens em logs, relatórios e screenshots públicas.
- Somente camada de UI gerencia apresentação/estado efêmero. Sala, membros, comandos, snapshots e projeções continuam com host autoritativo e `ClientReplica`.
- Evitar liberar funcionalidade incompleta a usuários Release antes do gate Task 7: escolher feature flag de UI ou outro mecanismo de gating verificável, sem criar exceções `cleartext`, `allowMixedContent` nem reativar tela de diagnóstico em Release.
- Reutilizar `qrcode` e `jsqr` já instalados. Inspecionar `src/features/adedonha/AdedonhaQrScanner.tsx` (usa `getUserMedia`) e `src/app/routes.tsx`. Não instalar bibliotecas ou plugins sem necessidade demonstrada.

## Testes e gate

- Aplicar TDD a testes de UI e dos fluxos; cobrir permissão negada, câmera indisponível, QR errado, convite expirado/consumido, renovação de convite, IP/porta alterados, comparação de código divergente, confirmação pendente, timeout, logout/leave, telas desmontadas, back/foreground e reconexão automática limitada.
- Executar testes focados durante a implementação; ao final Vitest completo, typecheck, lint, Vite, JVM e build Android relevante; evitar builds duplicados sem mudança.
- Testar fisicamente no **S23 RXCX705P3JR** (host) e **S25 FE RXGL30N4F3F** (guest), via hotspot **sem WAN**, testando o handshake atualizado da Task 5, QR pela câmera do convidado, ingresso visível, comando/estado do adapter mínimo, queda/retomada e encerramento. Reportar explicitamente o que foi simulado vs físico. Sem ADB forward da porta de jogo.
- Não afirmar prontidão para distribuição; Task 7 e compatibilidade iOS permanecem pendentes.

## Entrega

Registrar baseline, arquivos alterados, telas/fluxos, testes vermelhos→verdes, resultados finais e ensaio físico em `docs/lan-task6-room-ui-evidence.md`. Parar para revisão antes da Task 7. Primeiro jogo após infraestrutura aprovada: **Impostor da Palavra**; Adedonha depois.
