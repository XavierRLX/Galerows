# Cidade Dorme LAN — Prefeito, Traidor, Jester e Orquestração

Data: 2026-10-14. Estado: **DESIGN — REGRAS PARCIALMENTE APROVADAS, SEM IMPLEMENTAÇÃO**.
Plano existente: `docs/superpowers/plans/2026-10-14-cidade-dorme-lan-ux-01.md`.
Base do código: `src/features/cidade-dorme/{cidadeDorme.rules,cidadeDorme.setup,cidadeDorme.types}.ts` e `src/features/multiplayer/cidadeDormeLanGame.ts`.

## A. Decisões aprovadas pelo responsável de produto

- Duas conduções: `automatic` (todos jogam, host participa e executa orquestrador autoritativo) e `mayor` (prefeito humano com um aparelho próprio, controla e narra, **não joga, não recebe papel e não vota**).
- Com dois integrantes assassinos: **1 Assassino + 1 Traidor**. O Assassino começa com a ação noturna de matar. O Traidor só assume essa ação **quando o Assassino morrer**, e desde que esteja vivo.
- Ao revelar o papel, Assassino e Traidor **sabem reciprocamente os nomes e papéis**. A relação nunca aparece nas projeções públicas.
- **Investigação do Traidor — APROVADO:** enquanto inativo e o Assassino original estiver vivo, Detetive recebe `innocent`; após promoção autoritativa a Assassino ativo, recebe `suspect`. Cada resultado é um snapshot histórico da noite investigada; nunca recalcular retroativamente nem revelar a sucessão publicamente.
- **Jester / Coringa opcional**. Se for efetivamente **eliminado pela votação**, vence. Assassinato noturno, empate de votos ou sobreviver até outro vencedor não dão a vitória ao Jester.
- LAN deve oferecer as regras do modo de 1 celular: quantidade de assassinos, médico, detetive, Jester, revelar papel ao morrer, médico se autoprotege/limite, repetir proteção e outras opções existentes; não duplicar regras divergentes.

## B. Papel e sucessão — comportamentos de referência

| Estado | Quem executa `KILL` na noite válida | Consequência |
|---|---|---|
| Assassino e Traidor vivos | Somente Assassino | Traidor participa do debate e vota; não age à noite |
| Assassino eliminado, Traidor vivo | Somente Traidor a partir da **próxima noite** | Promoção autoritativa e privada, uma vez |
| Traidor eliminado, Assassino vivo | Somente Assassino | Assassino perde sucessor |
| Ambos eliminados | Ninguém | Vitória da cidade, salvo prioridade do Jester por voto |

- Manter `roleKey='traitor'` como papel original; a capacidade de matar é estado derivado no host (ator ativo), **não reatribuir o papel original**. Após promoção, painel privado pode exibir “Você assumiu a função de Assassino”.
- Bloquear comandos `KILL` forjados do Traidor ainda inativo; bloquear alvo aliado (Assassino/Traidor) e comandos duplicados/atrasados.
- O Assassino conhece o Traidor, e o Traidor conhece o Assassino na carta inicial. Um jogador da cidade, Detetive, Médico ou Jester jamais recebe esses IDs no snapshot privado; host-jogador não recebe privilégio adicional de leitura de segredos pela interface.
- Transição ao Traidor ativo é **secreta**. A voz pública continua “Assassino, acorde”; não anunciar “Traidor assumiu” nem o nome do novo Assassino. Se `revealRoleOnDeath=true`, o papel original do eliminado pode ser publicado conforme configuração, mas o sucessor não é exposto.
- O Traidor conta como membro vivo da equipe assassina desde o começo para condição de vitória; a cidade NÃO vence apenas ao eliminar o Assassino enquanto o Traidor permanece vivo.
- A regra de paridade existente precisa contabilizar integrantes assassinos vivos, incluindo Traidor ainda inativo. Prioridade de vitória: Jester votado > cidade se equipe assassina inteira eliminada > assassinos por paridade.
- Empate do Cidade Dorme: ninguém eliminado, sem vitória do Jester nem promoção. Não importar desempate do Impostor.

## C. Prefeitura humana e sincronismo

- Modo `automatic`: todos os membros da sala que participam recebem papel, inclusive o host. Se o host morrer **como personagem**, servidor LAN permanece ativo.
- Modo `mayor`: o host é narrador/árbitro, está na Room mas **não** integra `participantIds`; não ocupa vaga de papel, não participa do mínimo de jogadores e não entra na votação.
- Com mínimo atual de 4 participantes, prefeito dedicado exige **1 dispositivo de prefeito + 4 de jogadores**. Os atuais 3 aparelhos físicos + emulador permitem homologar `automatic` com quatro, mas não `mayor` com quatro jogadores.
- Prefeito recebe painel de roteiro da noite e status das ações autorizadas. Acesso a mapa secreto de papéis, se necessário para narrar, deve ser explícito e restrito ao dispositivo de moderador — nunca compartilhar esse mapa nos snapshots comuns.
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

- Oferecer 1 Assassino ou 1 Assassino + 1 Traidor; a opção de dois só é recomendada para grupos grandes (padrão de projeto atual sugere dois a partir de 8 participantes).
- **Pendente:** hoje o modo de 1 celular permite **3 assassinos** e recomenda 3 com 12 jogadores. Não inventar 2 Traidores nem ignorar a opção de 3 sem decisão específica do responsável.
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
9. Detetive nunca recebe resultados de investigação de outros jogadores. Testar Traidor `innocent` antes de assumir e `suspect` após assumir, preservando o histórico antigo sem recalcular; a mesma regra deve valer no modo de 1 celular.
10. Cliente desconectado, áudio repetido, ações duplicadas/atrasadas ou GameSession anterior não alteram decisões nem reproduzem segredos de outra rodada.
11. Mesmo comportamento de regras no modo de 1 celular e no LAN; manter compatibilidade de saves existentes.

## G. Decisões ainda abertas (não presumir aprovação)
- **Configuração com três assassinos:** manter 1 Assassino + 2 Traidores com sucessão definida (precisaria regra de prioridade), limitar o novo modo a até dois integrantes, ou criar uma terceira configuração. Não implementar sem escolha.
- **Visibilidade do prefeito:** quais detalhes secretos o prefeito humano deve poder consultar? Sugerido: mapa de papéis protegido por ação explícita e status privado de ações, sem exibir em tela pública.

## H. Estado da entrega

Documento de design apenas. Nenhum ajuste de código, APK, deploy, sala LAN ou `main` nesta etapa. A investigação dinâmica do Traidor já foi aprovada. Antes de implementar, atualizar o plano CITY-UX e resolver a composição com três integrantes assassinos e a visibilidade de segredos do prefeito.
