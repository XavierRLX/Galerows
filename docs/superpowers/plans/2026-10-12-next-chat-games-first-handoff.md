# Galerows — Handoff para próximo chat: catálogo, modos e descoberta LAN

**Preparado:** 12/10/2026. **Tipo:** handoff documental, não autorização de alteração em produção.
**Repositório Mac:** `/Users/renanxavier/Documents/GitHub/galerows`.
**Remote:** `XavierRLX/Galerows`.
**Branch obrigatória:** `feat/multiplayer-lan-task1-wss`.
**Baseline do início da documentação:** HEAD `84ebce4`, `working tree` limpa; **revalidar** HEAD/status após o commit documental.

## Contexto confirmado

- PL-02B: Room persistente LAN WSS/TLS v2, convidado/host, entrega privada, ingresso, resync, resume/rekey, leave, watchdog; subgate fechado.
- PL-03: UI experimental host/guest e jogos sintéticos `toy` e `counter`; **12/12 etapas físicas no S23/S25 FE em duas execuções**. Regressão **537/537 Vitest** e **37/37 JUnit**, `typecheck`, `lint`, Release/guard. Não há jogo real LAN integrado; QR físico via câmera foi confirmado depois pelo usuário; evidências anteriores documentam prova automatizada via PNG/manual.
- Código padrão `/` é catálogo `HubScreen`; mas com flag `VITE_LAN_PERSISTENT_LOBBY_UI=1`, `src/app/routes.tsx` desvia o índice para `/__lan-lobby-v2`. Futuro UX requer **catálogo primeiro**, mesmo com flag.
- `LanPersistentLobbyScreen` detém a sessão e desmontagem executa `host.stop()`/ `guest.disconnect()`; **não mudar rota sem primeiro projetar owner persistente**.
- O catálogo possui `isAvailableOffline`, não capacidade LAN por jogo; portanto badges LAN dependem de registro adicional.
- A descoberta NSD/mDNS **ainda não existe**. Ingresso de um toque/código de seis dígitos requer protocolo novo; PIN/TLS atual usa `capability` e verificação presencial; nenhum anúncio mDNS pode publicar segredo.
- Três jogos reais planejados no modo LAN inicial: **Impostor da Palavra**, **Adedonha** e **terceiro TBD**; não habilitar jogos reais só por badge.
- Código de seis dígitos serve para filtrar salas da LAN, **não substitui autenticação**. QR deve continuar funcionando quando descoberta falha. Objetivo UX: zero senha adicional, zero convite longo, tela Entrar lista salas automaticamente.

## Documentos normativos recentes (ler nesta ordem)

1. `docs/galerows-games-modes-local-discovery-v0.2.md` — produto/UX e trade-off de segurança.
2. `docs/superpowers/plans/2026-10-12-games-first-discovery-gates.md` — gates G0–G5 e riscos.
3. `docs/lan-pl03-lobby-physical-2026-10-12.md` — evidências de duas provas físicas.
4. `docs/multiplayer-persistent-lobby-spec.md` — invariantes existentes; se conflitar sobre fluxo de entrada, **v0.2 mais recente prevalece**.
5. `docs/superpowers/plans/persistent-lobby-technical-design.md` — design de Room v2.

## Modo de execução e ferramentas

- Preferência: **novo chat ChatGPT + @Remote Desktop Commander** como executor no Mac. É melhor separar este novo redesenho do histórico longo das fases PL-02/PL-03.
- Usar Superpowers: `brainstorming`, `writing-plans`, `test-driven-development`, `verification-before-completion`. Verificar se as skills estão disponíveis, ler os arquivos de instrução apropriados, não simular que foram invocados. Usar a skill **UI UX Pro Max** como checklist de UX; a identidade visual real Galerows prevalece sobre defaults genéricos.
- **Codex opcional** quando for demonstravelmente útil em um subproblema fechado e testável (ex.: implementação de componentes do G1 em worktree separado). Não executar Remote Commander + Codex simultaneamente no **mesmo working tree**, não duplicar edições nem gastar créditos para tarefas documentais simples.
- Check Git antes de alterar; preservar modificações de outros agentes, `main` intacta. Sem reset/clean/merge/push/deploy. Criação de branch separada precisa de justificativa explícita e acordo; padrão é usar branch atual.
- Para problemas >10s, atualizações breves, evidências RED/GREEN, testes reais. Não chamar ferramenta de imagem para substituir wireframe interativo/figma não solicitado.

## Prompt pronto para o novo chat

```text
Continue o projeto Galerows pelo @Remote Desktop Commander no Mac, usando Superpowers (brainstorming, writing-plans, TDD e verification-before-completion) e a skill de design UI UX Pro Max quando disponível.

Repositório: /Users/renanxavier/Documents/GitHub/galerows
Remote: XavierRLX/Galerows
Branch obrigatória: feat/multiplayer-lan-task1-wss
Não tocar em main; sem push, merge, deploy, reset/clean, instalação de dependências sem necessidade ou conflitos de edição com outro executor.

A prioridade mudou: o Galerows é um catálogo de party games, não um app que abre diretamente no lobby. Quero manter a logo/identidade da /inicio e os jogos atuais acessíveis com um celular, acrescentar escolha de modo por jogo (mesmo celular x cada um no seu) e criar um fluxo de Entrar em sala que lista automaticamente salas da mesma rede local, com entrada em um toque, fallback QR e código público de 6 dígitos. Não quero senha nem copiar convite longo. Apenas três jogos reais terão LAN no início: Impostor da Palavra, Adedonha e terceiro ainda a escolher.

Antes de qualquer implementação, LEIA integralmente:
1. docs/galerows-games-modes-local-discovery-v0.2.md
2. docs/superpowers/plans/2026-10-12-games-first-discovery-gates.md
3. docs/superpowers/plans/2026-10-12-next-chat-games-first-handoff.md
4. docs/lan-pl03-lobby-physical-2026-10-12.md
5. docs/multiplayer-persistent-lobby-spec.md
e audite código real de src/app/routes.tsx, HubScreen/GameCard/games.registry, lobby v2 e Android LAN. Quando os docs antigos conflitarem com a v0.2, a v0.2 prevalece em UX (não em invariantes de segurança).

EXECUTE SOMENTE O GATE G0 do plano: auditoria e desenho profissional de navegação /inicio → entrar/criar sala → modo do jogo → lobby, modelo de capacidade por jogo, fluxo auto-discovery + fallback e estados vazios/erro, e design de owner de Room persistente que não fecha ao navegar. Produza 2-3 alternativas com recomendação e plano de arquivos. Aponte explicitamente conflitos de segurança: mDNS não é confiável e seis dígitos não autenticam o host; WSS/Keystore/segredos não podem ser enfraquecidos. Proponha opções viáveis com trade-offs sem inserir senha adicional na UX, mas NÃO implemente um ingresso inseguro.

Use Superpowers para planejar e validar as decisões; preserve as provas físicas já aprovadas: 537/537 Vitest e 37/37 JUnit na entrega PL-03, UI de dois Samsung aprovada em 12/12 etapas, duas vezes. Não invente suporte real LAN em nenhum jogo. Nenhum código de multiplayer nativo, backend online ou jogo real neste gate.

No final, entregue as decisões, arquivos de documentação criados/alterados, riscos e o próximo gate proposto. Pare para minha revisão antes de implementar G1 e antes de tocar em NSD/WSS.
```

## Critério de encerramento do próximo chat

G0 deve acabar em uma proposta **avaliável** de UX, arquitetura/segurança, rotas e testes, sem modificar executáveis. Separar no relatório fatos verificados, hipóteses e decisões pendentes. Se precisar de outra ferramenta, explicar por que; preferir Remote Desktop Commander como executor e reservar Codex para trabalho técnico realmente vantajoso.
