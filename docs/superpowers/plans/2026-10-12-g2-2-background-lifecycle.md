# Galerows G2.2 — ciclo de vida em segundo plano, sem segundo celular

**Solicitação:** continuar desenvolvimento com somente Galaxy S23 disponível; não usar segundo aparelho.

**Base:** `feat/multiplayer-lan-task1-wss`, HEAD `fd8cc5c`. Manter alterações locais G0/G1/G2/G2.1, não modificar `main`, sem commit/push/deploy/instalação. Não habilitar G3/G4/G5 nem alterar WSS, pin TLS ou credenciais.

**Risco observado no código:**
- Provider consulta expiração host e desconexão guest apenas por `setInterval(400)`; timers JS podem ficar suspensos no background. Ao voltar, a UI pode temporariamente mostrar uma Room expirada ou carta privada não revogada.
- `LobbyRoomView` guarda `revealedSessionId` mesmo se o app ficar oculto; após voltar o conteúdo pode continuar exposto até a próxima interação.
- QR assíncrono de rekey pode falhar depois de uma sessão ter sido limpa e disparar um alerta obsoleto; resultados de sala anterior não devem contaminar sala seguinte.

## Tarefas TDD
1. **RED**: teste do provedor dispara `visibilitychange` em estado visível após expiração nativa e exige limpeza imediata sem aguardar o timer; teste guest simula queda e retorno e exige projeção privada removida na retomada antes do polling.
2. **GREEN**: evento `visibilitychange` para visível invoca `refreshSnapshot`, sem alterar WSS ou acrescentar novas conexões; limpar listeners no provider teardown.
3. **RED**: teste do lobby revela carta sintética, coloca documento em `hidden`, retorna e exige carta novamente ocultada, sem alterar comando, socket ou sessão; `window.blur` como defesa adicional.
4. **GREEN**: ocultar só estado local de revelação; manter a Room ativa e a carta cifrada/filtrada no snapshot para ação deliberada após retomada.
5. **RED/GREEN**: cobertura isolada para QR de convite obsoleto, sem publicar dados nativos, e tratamento de erro sem alerta órfão após fechar Room (aplicar somente se reproduzido com mock controlado).
6. Regressão completa `npm test`, TS, ESLint, build padrão e experimental, guards de assets, `git diff --check`, relatório G2.2. Não reivindicar teste físico de dois aparelhos.

**Parada:** G2.2 somente; aprovação física G2 continua pendente.
