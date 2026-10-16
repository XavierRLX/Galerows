# Galerows — Cidade Dorme LAN | Encerramento funcional (15/10/2026)

## Decisão e âmbito

**STATUS: FECHADO PARA O CICLO FUNCIONAL/MVP, POR ACEITE EXPLÍCITO DO PROPRIETÁRIO (15/10/2026).** O proprietário informou que testou o jogo, e declarou o Cidade Dorme concluído. Não houve detalhamento de cada passo do teste manual neste aceite. Esse aceite é uma confirmação humana posterior ao registro técnico `2026-10-15-city-replay-narration-regression.md`; não transforma, retroativamente, um gate técnico não observado em evidência automatizada.

Não equivale a liberação comercial, publicação nas lojas, compatibilidade iOS ou homologação de transporte LAN em todas as redes.

## Fonte única de código congelado

- Projeto: Galerows; worktree: `/Users/renanxavier/Documents/GitHub/galerows-city-orchestration`.
- Branch final: `feat/cidade-dorme-auto-orchestration-01`.
- Código do fechamento: `b1e0838` (`fix(city): rearm Lucas narration across automatic replay`).
- A branch inclui a integração imersiva pós-lobby, papéis especiais, condutor/prefeito manual separado, orquestração automática, trilha Lucas offline, turnos simulados para papéis eliminados e correção do replay.
- Origem ancestral: `feat/cidade-dorme-immersive-integration-01`, HEAD `0f7a9da`, com histórico linear até `b1e0838`.
- A worktree principal `feat/ux-hub-header-brand` contém modificações e arquivos não rastreados pré-existentes; **preservar, não sobrescrever nem incluir num commit de fechamento sem auditoria própria**.
- `main` e `origin/main` mantidos em `fbfb342` na auditoria inicial de encerramento. Nenhum merge, push, PR ou deploy autorizado neste fechamento.

## Fluxos concluídos funcionalmente

1. Room persistente por LAN, anfitrião também participante em modo automático, ingresso dos jogadores, configuração pelo host e barreira READY, sem lobby redundante ao iniciar a partida.
2. Identidade/papéis secretos por participante, revelação e confirmação privadas, sem exposição de papéis ou alvos pela projeção pública.
3. Narração offline Lucas iniciada por gesto do host; apenas um aparelho emite áudio, todos recebem a fase/legenda; o host orienta a passagem de fases pela Room, respeitando autorização e tempo mínimo.
4. Assassino, Médico, Detetive, investigação confidencial, amanhecer, debate, voto individual, apuração e resultado final, incluindo empates e novas noites.
5. Papéis eliminados preservam aparência de turno (sem ações reais), evitando revelar o papel somente pela ausência de turno. Aviso: duração perceptível entre turnos ainda merece equalização antes de distribuição.
6. Resultado, histórico resumido e placar da Room; **Jogar novamente** reativa a narração da nova `GameSession` e evita que a desmontagem da tela antiga interrompa a nova voz.
7. O modo com prefeito humano continua distinto do modo automático e não foi convertido para piloto automático.

## Evidências e aceite

- `docs/superpowers/reviews/2026-10-15-city-autopilot-physical-01.md`: quatro dispositivos (3 celulares + emulador), partida LAN de ponta a ponta com Lucas, fase simulada de papel eliminado, resultados sincronizados; PASS limitado conforme ressalvas do próprio relatório.
- `docs/superpowers/reviews/2026-10-15-city-replay-narration-regression.md`: falha reproduzida RED, correção GREEN, **849/849 testes**, 144 arquivos, typecheck/lint/build/apk PASS, instalação de `com.galerows.app.secureprobe` nos 4 dispositivos.
- O relatório técnico do replay registrava **pendência de nova execução ponta a ponta da segunda rodada na automação física**. Posteriormente o proprietário declarou **teste manual aprovado e encerramento do jogo**. Aceite do usuário e evidência instrumental são fontes distintas.
- Não registrar nomes de papéis dos participantes, conteúdos secretos, tokens QR ou certificados nos documentos.

## Pendências transversais de lançamento (não bloqueiam o aceite funcional)

- Testes de câmera óptica QR, descoberta/código em condições adversas, perda de host, Wi-Fi/hotspot/Doze/reconexão, iOS/Android e compatibilidade cruzada.
- Calibrar tempo constante de turnos ativos/simulados e observar comportamento de tela bloqueada, perda de foco e volume real.
- Validar titularidade/licença comercial dos áudios da voz Lucas antes da publicação.
- Auditoria de segurança e gate de release nativo. **Não publicar nem mesclar com `main` sem gate específico.**

## Decisão de transição

**Não ampliar escopo do Cidade Dorme neste fechamento.** Próximo ciclo de produto: **Pista Única LAN**, já implementado e anteriormente testado em três Androids, com foco em inspeção da UX atual e refinamento do fluxo — sem reescrever o adapter existente. Handoff em `docs/superpowers/plans/2026-10-15-pista-unica-ux-handoff.md`.
