# G5B — Estabilização do Impostor LAN (12/10/2026)

Autorizado: usuário aprovou executar testes automatizados/simulações com Mac, sem segundo celular. Branch obrigatória `feat/multiplayer-lan-task1-wss`, HEAD baseline `fd8cc5c`. Conservar todas as modificações e untracked, `main` intocada, nenhum commit/push/merge/deploy/APK instalado.

## Execução
1. Auditar G5A e infraestrutura Room/React/G4; registrar baseline.
2. **RED→GREEN** para transições inseguras de privacidade: carta revelada não pode reaparecer automaticamente quando reconectar ou avançar etapa da rodada.
3. Simular três ou mais jogadores usando `AuthoritativeRoomRuntimeV2` + adapter real; validar distribuição privada nas 3 modalidades e 2 modos de conversa, sequência de preparação, acusação/roubo, ações não autorizadas, sala persistente, nova GameSession e entrada tardia.
4. UI: teste de clique de revelação, confirmação, ocultação por blur/background, desconexão/reconexão, host controles e guest restrições.
5. Executar testes focados, `npm test` completo, `npm run typecheck`, `npm run lint`, builds padrão e experimental isolados, `git diff --check`. Sem mudança nativa nesta etapa, não requer Gradle; se mudar, compilar.
6. Relatório de evidências PASS/FAIL/limitações com pendência explícita dos dois aparelhos e G4 NSD.

Observação: a compilação anterior G5A não equivale a teste da lógica. Não declarar funcionamento físico.
