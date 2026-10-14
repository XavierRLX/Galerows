# Cidade Dorme LAN — Prefeito, Traidor, Jester e Orquestração

Data: 2026-10-14. Estado: **DESIGN — REGRAS PARCIALMENTE APROVADAS, SEM IMPLEMENTAÇÃO**.
Plano existente: `docs/superpowers/plans/2026-10-14-cidade-dorme-lan-ux-01.md`.
Base do código: `src/features/cidade-dorme/{cidadeDorme.rules,cidadeDorme.setup,cidadeDorme.types}.ts` e `src/features/multiplayer/cidadeDormeLanGame.ts`.

## A. Decisões aprovadas pelo responsável de produto

- Duas conduções: `automatic` (todos jogam, host participa e executa orquestrador autoritativo) e `mayor` (prefeito humano com um aparelho próprio, controla e narra, **não joga, não recebe papel e não vota**).
- Configurações de equipe assassina aprovadas: **1 integrante = 1 Assassino**; **2 integrantes = 1 Assassino + 1 Traidor**; **3 integrantes = 1 Assassino + 2 Traidores**. O Assassino original executa a ação noturna; os Traidores só agem após a morte do ator ativo, pela ordem de sucessão sorteada no início. No máximo **um integrante** pode executar `KILL` por noite.
- Ao revelar os papéis, **todos os membros da equipe assassina** conhecem privadamente os nomes e papéis dos demais. No caso de dois Traidores, a ordem de sucessão também é mostrada apenas à equipe. Essa ordem nunca entra no estado público; os demais jogadores não conhecem o líder nem os sucessores.
- **Investigação do Traidor — APROVADO:** cada Traidor **inativo** retorna `innocent` ao Detetive, independentemente de qual aliado esteja executando os ataques. Quando **aquele Traidor** for promovido a Assassino ativo, passa a retornar `suspect`. O Assassino original é sempre `suspect` enquanto vivo. Assim, com 2 Traidores, o segundo continua `innocent` mesmo depois da promoção do primeiro. Cada resultado é um snapshot histórico da noite investigada; nunca recalcular retroativamente nem revelar a sucessão publicamente.
- **Jester / Coringa opcional**. Se for efetivamente **eliminado pela votação**, vence. Assassinato noturno, empate de votos ou sobreviver até outro vencedor não dão a vitória ao Jester.
- LAN deve oferecer as regras do modo de 1 celular: quantidade de assassinos, médico, detetive, Jester, revelar papel ao morrer, médico se autoprotege/limite, repetir proteção e outras opções existentes; não duplicar regras divergentes.

## B. Papel e sucessão — comportamentos de referência

| Estado | Quem executa `KILL` na noite válida | Consequência |
|---|---|---|
| Assassino original vivo e Traidores vivos | Somente Assassino original | Traidores debatem e votam, mas não têm ação noturna |
| Assassino original eliminado, Traidor 1 vivo | Somente Traidor 1 a partir da **próxima noite** | Promoção secreta e autoritativa |
| Ator ativo eliminado, Traidor 2 vivo | Somente Traidor 2 a partir da **próxima noite** | Próximo sucessor vivo na ordem predefinida assume |
| Traidor de maior prioridade eliminado antes de assumir | Ator atual permanece | Ao precisar de sucessor, ignorar o Traidor morto |
| Todos os membros assassinos eliminados | Ninguém | Vitória da cidade, salvo prioridade do Jester por voto |

- Manter `roleKey='traitor'` como papel original; a capacidade de matar é derivada da lista de prioridade e dos jogadores vivos, **não reatribuir o papel original**. Após promoção, o painel privado pode exibir “Você assumiu a função de Assassino”. A promoção acontece logicamente quando se confirma uma eliminação, mas a ação `KILL` só está disponível na próxima noite válida.
- Bloquear comandos `KILL` forjados de qualquer Traidor ainda inativo, mesmo depois que outro Traidor tenha assumido; bloquear alvo aliado (Assassino/Traidores) e comandos duplicados/atrasados. Se o sucessor prioritário morreu, escolher o próximo **vivo** sem novo sorteio. Desconexão do ator ativo pausa/aguarda; **não** promove Traidor por perda de rede.
- Cada integrante da equipe assassina conhece privadamente todos os aliados e, quando houver dois Traidores, sua prioridade de sucessão. Cidadão, Detetive, Médico ou Jester jamais recebem esses IDs ou a ordem no snapshot privado; host-jogador não recebe privilégio adicional pela interface.
- Transição ao Traidor ativo é **secreta**. A voz pública continua “Assassino, acorde”; não anunciar “Traidor assumiu”, número da sucessão nem o nome do novo ator. Se `revealRoleOnDeath=true`, o papel original do eliminado pode ser publicado conforme configuração, mas a identidade do sucessor não é exposta.
- **Todos os Traidores vivos** contam para o tamanho da equipe assassina desde o começo, inclusive quando inativos. A cidade só vence ao eliminar **Assassino e todos os Traidores**, não ao eliminar apenas o ator ativo. Para paridade, usar a facção, não o papel que está com a ação de matar.
- A regra de paridade existente precisa contabilizar integrantes assassinos vivos, incluindo Traidor ainda inativo. Prioridade de vitória: Jester votado > cidade se equipe assassina inteira eliminada > assassinos por paridade.
- Empate do Cidade Dorme: ninguém eliminado, sem vitória do Jester nem promoção. Não importar desempate do Impostor.

## C. Prefeitura humana e sincronismo

- Modo `automatic`: todos os membros da sala que participam recebem papel, inclusive o host. Se o host morrer **como personagem**, servidor LAN permanece ativo.
- Modo `mayor`: o host é narrador/árbitro, está na Room mas **não** integra `participantIds`; não ocupa vaga de papel, não participa do mínimo de jogadores e não entra na votação.
- Com mínimo atual de 4 participantes, prefeito dedicado exige **1 dispositivo de prefeito + 4 de jogadores**. Os atuais 3 aparelhos físicos + emulador permitem homologar `automatic` com quatro, mas não `mayor` com quatro jogadores.
- **Painel do Prefeito — APROVADO:** por padrão, exibe somente roteiro, fase, conexão dos jogadores, número de ações pendentes/concluídas, pausa e botões autorizados de avançar; nenhum papel, identidade da equipe assassina, alvo ou investigação fica exposto. O botão separado **Consultar papéis e ações** exige confirmação consciente de privacidade no dispositivo do prefeito. A consulta é apenas leitura, temporária, não exibe segredos no estado público, não autoriza escolher alvos nem votar; pode ser fechada imediatamente e deve ocultar dados ao perder foco/bloquear o aparelho. Host no modo automático jamais recebe este painel privilegiado.
- O host controla revisionamento, validações, relógio/instante de fase e `eventId` monotônico para evitar efeitos duplicados. Celular reconectado restaura fase e apenas seus segredos.
- Fases: identidades privadas (todos confirmam) → narração “Todos dormem” → Assassino seleciona alvo (ou Traidor promovido) → Médico protege se vivo/habilitado → Detetive investiga se vivo/habilitado → “Cidade acorda” e consequência pública → discussão → voto individual → apuração/empate/resultado → próxima noite ou encerramento.
- Mesmo evento de fase e legenda aparece a todos; **somente o ator autorizado tem ação secreta**. Os outros veem espera temática, sem indicação do alvo ou do papel do ator.
- Para não sobrepor quatro vozes, narrador offline toca em um aparelho como alto-falante principal; demais recebem legendas e vibração opcional. Modo prefeito tem voz automática opcional (padrão desligado).
- O modo automático avança ao concluir guardas de estado/acks necessários, não por um cronômetro de interface isolado. Não criar morte automática se alguém demora. Host suspenso/desconectado: congelar escolhas, não eleger host nem inventar ações.
- Mayor humano controla os avanços entre fases, depois que as ações necessárias estiverem confirmadas. Prefeito pode pausar, repetir instrução e acompanhar conexões; ele não pode votar ou agir em nome de um jogador sem regra aprovada.

## D. Jester opcional

- Usa `roleKey='jester'`, facção neutra, sem ação noturna; participa do debate e voto enquanto vivo.
- Vitória **imediata** apenas se eliminado por votação válida (empate sem eliminado não conta).
- Morto pelo ataque do Assassino não vence; não vira Traidor ou Assassino. Não participa da sucessão.
- A condição de vitória do Jester já existe no núcleo atual; preservar e ampliar os testes com o Traidor.
- Não mudar pontos do Jester (atualmente 2 ao vencer) sem nova aprovação.

## E. Configuração e gatilhos de papel

- Oferecer **1 Assassino**, **1 Assassino + 1 Traidor** ou **1 Assassino + 2 Traidores**. Preservar os valores disponíveis no modo de 1 celular. Preset atual: 1 integrante para 4–7 jogadores, 2 integrantes para 8–11 e 3 para 12; ajustar os nomes dos papéis, não a contagem total sem outra aprovação.
- Ao criar a GameSession, sortear uma **lista imutável** de prioridade (`killerId`, `traitorPriorityIds`), guardada apenas no servidor host e nas projeções privadas dos aliados. O ator autorizado para cada noite é o primeiro integrante **vivo** dessa lista; qualquer morto anterior é pulado. A lista não muda por desconexão ou por troca de fase.
- Médico, Detetive, Jester, revelação ao morrer e regras de proteção devem vir de configuração compartilhada entre os dois modos.
- Painel de configuração do lobby pode ficar em seções recolhíveis para evitar scroll da tela inteira.

## F. Matriz mínima de testes (TDD/contratos)

1. Mayor não joga: cinco membros de Room (prefeito + 4 jogadores) → quatro papéis; prefeito não recebe papel, não vota e não afeta vitória.
2. Um Assassino: jogo existente segue funcionando, sem promoção.
3. Com dois: distribui Assassino e Traidor distintos; cada um vê o nome do outro, mas nenhum terceiro recebe esta identidade.
4. Traidor com Assassino vivo não consegue enviar `KILL`, inclusive payload forjado; Assassino não pode selecionar aliado como vítima.
5. Assassino eliminado durante votação: Traidor mantém papel privado e passa a ser único ator noturno na próxima noite; promoção idempotente, sem vitória prematura da cidade.
6. Traidor eliminado antes do Assassino: não existe outro sucessor; Assassino segue ativo.
7. Ambos eliminados: cidade vence; empates não eliminam ninguém.
8. Jester votado e eliminado vence imediatamente; Jester morto à noite não vence.
9. Detetive nunca recebe resultados de investigação de outros jogadores. Com dois Traidores, testar `innocent` para ambos no início, `suspect` para o Traidor 1 após primeira sucessão e `innocent` ainda para o Traidor 2, que só se torna `suspect` ao assumir depois; preservar investigações antigas; paridade igual no modo de 1 celular.
10. Cliente desconectado, áudio repetido, ações duplicadas/atrasadas ou GameSession anterior não alteram decisões nem reproduzem segredos de outra rodada.
11. Com três integrantes, sortear ordem única 1 Assassino → Traidor 1 → Traidor 2; matar Traidor 1 antes da sucessão faz Traidor 2 assumir direto após morte do Assassino; ator ativo morto nunca realiza ação seguinte; rejeitar `KILL` de dois atores na mesma noite. Desconectar não é morrer e não ativa sucessão.
12. Se apenas um Traidor ficar vivo, a cidade não vence; quando todos os integrantes assassinos morrerem, cidade vence; membro inativo conta na paridade da equipe.
13. Mesmo comportamento de regras no modo de 1 celular e no LAN; manter compatibilidade de saves existentes.

## G. Gate das regras de produto — FECHADO

A composição com três integrantes está **APROVADA** (Assassino + 2 Traidores, sucessão por ordem sorteada e secreta). A visibilidade do prefeito também está **APROVADA**: painel padrão sem informações secretas e consulta privada deliberada de papéis/ações mediante confirmação. Não há outras decisões de regra bloqueando o início da implementação incremental. Novos critérios técnicos ou ambiguidades serão tratados como gates específicos, sem inventar regra.

## H. Estado da entrega

Documento de design; nenhuma implementação é implicada apenas por este registro. **A investigação dinâmica do Traidor, a sucessão de até dois Traidores e o painel privado do Prefeito estão aprovados.** Prosseguir em branch/worktree isolado, com contratos e TDD primeiro; preservar alterações locais não relacionadas, sem alterar `main` nem o servidor Live dos aparelhos até gate posterior.
