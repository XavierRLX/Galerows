# CITY-MAYOR-01 — Moderador humano autoritativo (primeiro gate)

Data: 2026-10-14.
Worktree isolado: `/Users/renanxavier/Documents/GitHub/galerows-city-core`, branch `feat/cidade-dorme-core-01`.
Spec aprovada: `docs/superpowers/designs/2026-10-14-cidade-dorme-prefeito-traitor-jester.md`.

## Escopo entregue

- Configuração LAN `conductionMode: 'automatic'|'mayor'`, compatível com partidas antigas sem este campo (padrão automático).
- O modo `mayor` exclui o host de `participantIds`, do sorteio de papéis, dos votos, das ações noturnas e da obrigatoriedade de `READY`, sem alterar host técnico nem a conexão física do anfitrião.
- Seleção explícita do modo no lobby e indicação da escolha nas regras públicas; contador de prontos considera só participantes, mas a lista de conectados inclui o prefeito.
- Host no modo `mayor` tem um **conjunto fechado** de comandos de condução autorizado: `START_NIGHT`, `START_DISCUSSION`, `START_VOTE`, `RESOLVE_VOTE`, `NEXT_NIGHT`. As verificações ocorrem na Room e no redutor do jogo; papéis, voto e alvos privados continuam protegidos mesmo se comandos forem fabricados fora da UI.
- Snapshots privados do prefeito são `null`. A UI não pode acidentalmente transformar host em jogador. Dados secretos de consulta deliberada não estão implementados ainda.
- Permite até 12 convidados + 1 prefeito **somente** quando Cidade Dorme está configurado neste modo; salas comuns continuam limitadas a 12 membros. Quatro convidados são exigidos para começar; host não precisa marcar `READY`.
- Repetição de partida utiliza a mesma Room, gera novo GameSession e mantém prefeito sem papel.

## TDD e evidências

- Testes foram escritos antes da implementação e falharam no gate RED:
  - `/tmp/city-mayor-red.log`: 5/5 casos falharam porque o campo de condução não era aceito;
  - `/tmp/city-mayor-ui-red.log`: lobby não tinha seleção de prefeito nem cálculo correto de `READY`;
  - `/tmp/city-mayor-ready-red.log`: host no modo prefeito ainda podia marcar `READY`.
- GREEN: `cidadeDormeMayorAuthority.test.ts`, `lobbyView.test.ts`, `LobbyRoomView.cidadeLan.test.tsx`, demais testes legados de Room.
- Gates finais executados **após os últimos ajustes**:
  - `npm test`: **756/756 testes e 130/130 arquivos PASS**, log `/tmp/city-mayor-full-gate-test.log`;
  - `npm run typecheck`: PASS, `/tmp/city-mayor-full-gate-type.log`;
  - `npm run lint`: PASS, `/tmp/city-mayor-full-gate-lint.log`;
  - `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`: PASS, `/tmp/city-mayor-full-gate-build.log`;
  - `git diff --check`: PASS;
  - Veredito de execução: `0/0/0/0/0`.
- Não foi feita homologação física do modo Prefeito; o ambiente Live dos quatro dispositivos **não** foi alterado.

## Decisões de implementação

- Não ampliar todos os jogos para 13 membros: capacidade extra está condicionada a uma configuração autoritativa validada do Cidade Dorme.
- Não interpretar desconexão como eliminação; contador e seleção de papéis são derivados de membros presentes e estado canônico.
- Guardar o painel de segredos para CITY-MAYOR-02, pois exige projeção privada distinta de papéis de jogadores, autenticação do moderador e fechamento automático ao perder foco.

## Ainda pendente — não declarar como entregue

1. **CITY-MAYOR-02:** painel visual do prefeito (passo a passo, pausa, progresso e botões), mais `Consultar papéis e ações` autenticado e temporário, com confirmação e segurança contra captura visual involuntária.
2. **CITY-SETTINGS-01:** paridade integral com configurações de médico/autoproteção/limite/repetição do modo 1 celular, atualmente fora do schema LAN.
3. **CITY-ORCHESTRATION-01:** separação de narração manual/automática, eventos de fase, áudio offline, legenda, relógio e reconexão; interface imersiva ainda não pronta.
4. **Homologação em aparelhos:** prefeito com quatro jogadores requer cinco aparelhos; não afirmar teste físico antes dele.
5. **Release:** sem merge, push, deploy, sync Capacitor ou instalação de APK neste marco.

O primeiro gate comprova autorização e participação correta no motor da Room; não representa conclusão do Cidade Dorme.
