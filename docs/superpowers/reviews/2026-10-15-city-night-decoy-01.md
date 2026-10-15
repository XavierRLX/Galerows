# CITY-NIGHT-DECOY-01 — Turnos simulados para papéis eliminados
Data: 2026-10-15
Branch isolada: feat/cidade-dorme-auto-orchestration-01
Worktree: /Users/renanxavier/Documents/GitHub/galerows-city-orchestration
Base: a672b00

## Objetivo e comportamento
Nas partidas LAN com condução automática ou Prefeito, papéis configurados **Médico** e **Detetive** devem continuar presentes na sequência pública noturna mesmo depois que seus jogadores forem eliminados.

- A sequência sonora do narrador Lucas continua **igual** para turnos com ou sem jogador vivo.
- O cliente público recebe o mesmo tipo de `CidadeDormeLanStep` e `phaseEventId`; nenhum campo público indica que o turno é fictício.
- Se não houver ator vivo, o host pode avançar após o tempo mínimo da fase (**14 s** desde a entrada), com o comando genérico `SIMULATE_NIGHT_ROLE`.
- O host automático só tenta avançar após a sequência de áudio terminar e depois que o servidor abrir a fase. O comando é enviado tanto se houver ator vivo quanto se não houver.
- Quando o papel ainda tem ator vivo, o comando de simulação **não altera o estado**. Apenas a ação privada real pode avançar.
- O jogador eliminado jamais executa PROTECT, INVESTIGATE ou ACK_INVESTIGATION; não é criado alvo, escudo ou pista fictícia.
- No automático, o Detetive fictício passa também por `detective-result` para conservar a mesma sequência sonora privada/pública de uma investigação real (sem criar pistas).
- No modo Prefeito humano, há opção para concluir o turno simulado após narração/espera manual. A fase `detective-result` não é simulada no Prefeito porque não faz parte do fluxo normal dessa condução.
- Papéis **desabilitados nas configurações** continuam fora da sequência, como esperado; a escolha de papéis é pública.

## Segurança e limites
- O servidor valida permissões de host/Prefeito, fase, payload nulo, tempo mínimo e disponibilidade real do papel.
- Repetições em fases com ator vivo são idempotentes; não simulam uma escolha legítima.
- **Revelar papel ao morrer** precisa estar desativado para preservar o sigilo (padrão atual: desativado). Foi adicionado aviso no lobby.
- A espera fictícia é fixa e uma ação real pode ser mais rápida ou mais lenta. Assim, o ritmo é semelhante, mas ainda não há garantia contra inferências estatísticas por observação repetida de tempos. Homologar com jogadores reais antes de marcar como sigilo completo.
- Eliminações ainda são anunciadas normalmente: a proteção vale para o **papel** oculto do eliminado, não para ocultar que uma pessoa morreu.
- Se não restar assassino, a partida termina; não são forjadas ações de um papel que determinou o fim de jogo.

## Validação automatizada
- Novo teste de Médico eliminado pela primeira noite e turno vazio na seguinte.
- Novo teste de Detetive eliminado e sequência `detective-turn → detective-result` sem pista fabricada.
- Teste Prefeito: simulação após eliminação sem permitir pular jogador vivo.
- Teste de planner: após 14s e com voz concluída.
- UI Prefeito: botão genérico; nenhum controle desses é oferecido a jogadores comuns.
- Resultado final: 848/848 testes Vitest aprovados, TypeScript, ESLint, Vite build e git diff --check PASS.

## Restrições e homologação pendente
- Nenhuma geração ElevenLabs ou gasto de créditos.
- Nenhuma alteração na árvore Live, merge, push, deploy, instalação ou sincronização Capacitor.
- Teste físico em quatro dispositivos, reconexão e interrupção de áudio AINDA pendentes.
- Revisão de direitos comerciais dos arquivos Lucas AINDA pendente.
