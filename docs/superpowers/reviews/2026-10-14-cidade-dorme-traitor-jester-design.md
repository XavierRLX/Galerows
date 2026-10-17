# Cidade Dorme — Assassino principal, Traidor e Coringa (Design)

Data: 2026-10-14. **Status: discussão de regras; não implementado.**

## Decisões expressas pelo responsável pelo produto

- Em partidas com muitos jogadores, ao selecionar dois assassinos, a distribuição será **um Assassino principal e um Traidor**, papéis distintos que integram a mesma equipe.
- Só o Assassino principal escolhe vítimas enquanto está vivo.
- O Traidor passa a ter a ação de matar **quando o Assassino principal morre**.
- Durante a revelação, Assassino e Traidor **sabem quem é quem**, cada um através da sua projeção privada de papel.
- O **Coringa (Jester)** será opcional; se for eliminado **por votação**, ganha a partida.
- O modo LAN terá o mesmo conjunto de configurações fundamentadas no modo de 1 celular, com as opções de narração automática ou prefeito humano ainda em discussão.

## Contratos propostos, a validar

1. Participação mínima: o preset atual de 2 assassinos é usado com **8–11 jogadores**; com 4–7 permanece um Assassino. O preset de 12 jogadores atualmente recomenda **3 assassinos** e precisa de definição de composição, não presumir 1+2 traidores.
2. Adicionar `traitor` à união `RoleKey`, ao baralho de papéis e ao projeto privado; nos presets com dois papéis da facção: `[killer,traitor]`.
3. Informação privada inicial: Assassino vê o nome do Traidor; Traidor vê o nome do Assassino. Cidadãos, Médico, Detetive e Coringa não veem aliados secretos.
4. Enquanto o Assassino estiver vivo, somente ele pode enviar `KILL`; Traidor não recebe seleção de alvo. Com o Assassino principal eliminado e Traidor vivo, o Traidor passa a ser o único ator válido de `KILL` a partir da próxima noite. A mudança de papel é permanente (o papel secreto original pode continuar rotulado Traidor, com estado de sucessor ativo).
5. Assassino e Traidor não podem escolher um ao outro como vítima quando têm o poder de matar. Proteções de Médico e demais regras permanecem.
6. Se Assassino morrer mas Traidor permanecer vivo, a cidade **não** vence imediatamente: existe um sucessor. Se ambos morrerem, a cidade pode vencer. Se Traidor morreu primeiro, Assassino continua normalmente.
7. Equipe dos assassinos (Assassino + Traidor) divide a condição de vitória por controle/paridade da cidade. Vencedores e pontuação do time devem tratar o Traidor como membro da facção. Coringa permanece neutro e sua vitória individual tem prioridade no turno em que for eliminado por votação.
8. Coringa eliminado por ação noturna, por desconexão ou por qualquer condição fora da votação **não ganha**. Empate sem eliminado não ativa a vitória.
9. Projeção pública não inclui `traitorId`, `killerId`, `successor`, `roleKey`, nem associação. Projeção privada informa o aliado somente à facção; o host, mesmo com servidor autoritativo, joga com projeção filtrada. Se opção de revelar papel ao morrer estiver ativa, respeitar apenas papel morto, nunca promover publicamente o sucessor.
10. Narração noturna permanece genérica ("O assassino acorda") mesmo quando a ação passa ao Traidor, para não denunciar quem foi promovido. Somente o Traidor recebe instrução privada.
11. Médico/Detetive e visibilidade dos resultados devem usar **regras compartilhadas** entre 1 celular e LAN; não copiar os controles sem atualizar os contratos.

## Situações essenciais para testes

- 1 Assassino sem Traidor: comportamento atual.
- 1 Assassino + 1 Traidor; ambos veem seus respectivos aliados, ninguém mais.
- Traidor não pode matar antes da eliminação do Assassino; Assassino não pode selecionar Traidor.
- Assassino morto de dia: Traidor assume na próxima noite, a cidade não ganha antes disso.
- Assassino morto à noite (se a regra permitir outra causa no futuro): transição mantém invariantes.
- Traidor eliminado primeiro: Assassino mantém ação, vitória da cidade quando depois morrer.
- Dois membros da facção eliminados: vitória da cidade quando demais condições se aplicarem.
- Coringa eliminado por voto: vitória exclusiva do Coringa, incluindo quando outras facções terminariam a partida.
- Coringa eliminado à noite: sem vitória do Coringa.
- Reinício na mesma Room redistribui papéis, associações e estado de sucessão; mensagens atrasadas são recusadas.
- Reconexões, ações duplicadas, host eliminado e sincronização de toda a Room não vazam aliados ou comandos privados.

## Questões em aberto

- **Detetive:** se investigar o Traidor antes de assumir, resultado "suspeito" (alinhamento com assassinos) ou "inocente" (cobertura até ser ativado)? Requer aprovação explícita.
- **Três assassinos em 12 jogadores:** qual composição prevista? Não inferir.
- **Prefeito:** participante ou apenas narrador? A definição altera quantidade mínima e percepção dos dados privados.
- **Papel do Coringa:** se a vitória encerra a partida imediatamente (como faz atualmente) ou usa outra forma de pontuação; padrão recomendado: vitória imediata.

## Estado de implementação pré-existente confirmado na auditoria

- `src/features/cidade-dorme/cidadeDorme.rules.ts`: atualmente `createRoleDeck` cria N cópias de `killer`. `checkWinCondition` encerra quando não há killers vivos; é obrigatório modificar antes de habilitar o Traidor.
- `src/features/multiplayer/cidadeDormeLanGame.ts`: configuração atual aceita somente quatro flags e o servidor LAN escolhe um representante entre os assassinos vivos. Não há role `traitor` nem sucessão.
- `enableJester` e vitória por eliminação votada do Coringa já existem. Evitar duplicação de regra.
- Todas as regras devem ser testadas primeiro em `src/features/cidade-dorme/cidadeDorme.rules.test.ts` e `src/features/multiplayer/cidadeDormeLanGame.test.ts`, depois na UI e no fluxo da Room.

**Não editar core, UI nem emitir commit de implementação enquanto as decisões em aberto não forem resolvidas.**
