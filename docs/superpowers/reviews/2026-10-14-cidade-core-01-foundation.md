# CITY-CORE-01 — Fundamentos do Cidade Dorme (etapa de implementação)

Data: 2026-10-14. Branch isolada: `feat/cidade-dorme-core-01`.
Worktree: `/Users/renanxavier/Documents/GitHub/galerows-city-core`.
Base: `c29dda9`, contrato aprovado do painel do prefeito.

## Aprovação e limites

- O usuário aprovou o painel do prefeito dedicado: **roteiro, fase, ações pendentes/concluídas, conexão, pausar/avançar** por padrão; botão separado **Consultar papéis e ações** exige confirmação de privacidade, é somente leitura e oculta os segredos ao fechar/perder foco. O prefeito **não joga, não recebe papel e não vota**.
- A aprovação está documentada em `docs/superpowers/designs/2026-10-14-cidade-dorme-prefeito-traitor-jester.md` e commit `c29dda9`.
- Este commit **implementa somente regras compartilhadas e sucessão do Assassino/Traidores**, não a interface do prefeito, a consulta secreta, sua exclusão dos participantes ou a orquestração audiovisual. Essas partes permanecem explicitamente PENDING.
- O worktree isolado impede atualizações automáticas no Vite Live da branch principal. **Nenhum APK atualizado, deployment, alteração na `main`, push ou homologação física desta versão**.

## Implementado em CITY-CORE-01

- `RoleKey` inclui `traitor`, tema, descrições e três idiomas.
- Baralho de papéis com `killersCount`: 1 = Assassino; 2 = Assassino + Traidor; 3 = Assassino + 2 Traidores.
- Sorteio de prioridade: Assassino original primeiro; prioridade dos Traidores estabelecida uma vez no início. Desconexão nunca ativa sucessão; somente morte do ator atual.
- `getAliveKillers`, `getAliveInnocents` e condições de vitória consideram Traidores como equipe assassina, mesmo adormecidos. Jester por votação mantém vitória exclusiva, não por ataque noturno.
- Resultado do Detetive: Assassino original ou Traidor **ativo** = suspeito; Traidor inativo = inocente. Investigação histórica fica registrada no momento da rodada e não é reescrita.
- LAN: host mantém `murderOrder` fora do estado público; somente membros da equipe assassina recebem `successionOrder` e aliados via projeções privadas autenticadas. Só o ator vivo na cabeça da prioridade pode emitir `KILL`; ataques a aliados, comandos falsificados ou do Traidor inativo são recusados.
- Pontuação LAN reconhece todos os membros assassinos como mesmo time; eliminados e vencedores dependem do core autoritativo.
- Modo 1 celular: `murderOrder` persistido e restaurado, valida ator autorizado e bloqueia fogo amigo; detetive segue a transição de estado. Migração de saves antigos sem `murderOrder` preserva partidas com múltiplas cartas `killer` anteriormente válidas.
- UI LAN e protótipos atualizam labels de Traidor e bloqueiam ações de quem não é o Assassino ativo. **Falta integrar a apresentação imersiva da prioridade de sucessão nas cartas**, e a consulta de nomes dos aliados no modo de 1 celular, com proteção explícita contra olhares alheios; prioridade já trafega apenas na projeção privada LAN.

## Provas e testes

- RED antes de GREEN em `cidadeDorme.succession.test.ts` (5), `cidadeDormeSuccessionLan.test.ts` (3), `cidadeDorme.localSuccession.test.ts` (3).
- Regressão inicial detectou falhas em expectativas antigas para cartas `killer` repetidas e fixtures sem prioridade; testes antigos foram adaptados às novas regras, não removidos.
- **Gate final reexecutado após a correção de migração: PASS** — `npm test` **749/749 em 129 arquivos**, `npm run typecheck` PASS, `npm run lint` PASS, `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` PASS e `git diff --check` PASS. Logs: `/tmp/cidade-core-01-release-tests.log`, `/tmp/cidade-core-01-release-types.log`, `/tmp/cidade-core-01-release-lint.log`, `/tmp/cidade-core-01-release-build.log`. Veredito `0/0/0/0/0`.

## Próximas etapas obrigatórias

1. **CITY-MAYOR-01:** contrato autoritativo para excluir prefeito de `participantIds`, READY/votação/ações, permitir somente comandos de condução autorizados. Snapshots públicos jamais devem conter segredos. Testes RED de 1 prefeito + 4 jogadores.
2. **CITY-MAYOR-02:** `Consultar papéis e ações` autenticado, com confirmação de privacidade, ocultação ao perder foco e projeção confidencial **somente** para prefeito humano. Host no modo automático jamais recebe isso. Não confiar em controle apenas de CSS.
3. **CITY-SETTINGS-01:** paridade integral com parâmetros do modo 1 celular e compatibilidade de snapshots/configurações antigas.
4. **CITY-UX-01:** tela imersiva, noite/dia, narração offline num alto-falante, transições e reconexão sincronizadas por eventos, sem vazamento de papéis; integrar os dois modos.
5. Testes físicos com S23, S26 FE, Moto G6 e emulador; para prefeito dedicado e quatro jogadores, são necessários cinco dispositivos. Não afirmar homologação física antecipadamente.
