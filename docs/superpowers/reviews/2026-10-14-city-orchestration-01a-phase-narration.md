# CITY-ORCHESTRATION-01A — Fases autoritativas e narração offline

Data: 2026-10-14.
Worktree: `/Users/renanxavier/Documents/GitHub/galerows-city-core`.
Branch: `feat/cidade-dorme-core-01`.
Spec: `docs/superpowers/designs/2026-10-14-cidade-dorme-prefeito-traitor-jester.md`.
Plan: `docs/superpowers/plans/2026-10-14-city-orchestration-01.md`.

## Decisão de arquitetura

O host LAN é a única autoridade que gera eventos de mudança de fase. O jogo mantém `phaseRevision`, `phaseStartedAt` e expõe `phaseEventId` no snapshot público. A revisão aumenta **apenas quando `step` ou `round` mudam**. ACKs, votos individuais, atualização de membro, pausa e retomada não geram novas falas. O par `gameSessionId + phaseEventId` identifica o evento da partida, e o snapshot de reconexão apresenta somente a fase canônica atual.

A narração é áudio estático *embutido* no build. Não há dependência de internet, serviço remoto de TTS nem narração simultânea nos convidados. No modo automático, **apenas o dispositivo do host** tem botão para ativar a voz (exigido por políticas de autoplay mobile); cada mudança de fase toca no máximo uma vez nesse aparelho. No modo prefeito a voz automática está desligada e o roteiro é lido por uma pessoa. Todos os celulares veem a mesma legenda pública e um visual temático para noite, aurora e dia.

## Entregas

- `cidadeDormeLanGame.ts`: carimbos de fase host-authoritative; `phaseRevision` inicia em 1, `phaseStartedAt` vem do `clock.now()` da Room, `phaseEventId` é derivado da fase/revisão; nenhuma decisão secreta entra no evento público.
- `cidadeNarration.ts`: textos e mapeamento de nove fases públicas para áudio offline, controle puro de deduplicação, bloqueio de convidados, prefeito, pausa, tela oculta e conexão interrompida.
- `CidadeDormeAtmosphere.tsx`: banner de noite/dia + legenda em `role=status`, fonte de voz única no host quando autorizado, reprodução de clipe após gesto real do usuário, tratamento de erro por fallback textual, `pause()` ao trocar de fase/ficar sem conexão/perder o foco. Não reproduz fases antigas após reconexão.
- `CidadeDormeLanRound.tsx`, `CidadeDormeMayorPanel.tsx`: uso do mesmo banner público nas duas experiências sem alterar a projeção privada de papéis e ações.
- `lobby.css`: apresentação temática acessível, textos responsivos e `prefers-reduced-motion` respeitado.
- `public/assets/cidade-dorme/narracao/*.m4a`: **9 clipes AAC/M4A**, aproximadamente **464 KB** no total, gerados localmente em pt-BR pela voz disponível no macOS; o script `scripts/create-city-offline-narration.sh` documenta os textos, a voz e o processo. Os arquivos estão presentes em `dist/assets/cidade-dorme/narracao/` após build.
- Compatibilidade com o protocolo da Room preservada: os campos foram adicionados somente à projeção Cidade Dorme; nenhum outro jogo sofreu modificação de contrato público.

## Red-Green-Refactor / evidências

- RED: `cidadeDormePhaseEvents.test.ts`, 4/4 falhando na ausência dos carimbos — `/tmp/city-phase-red.log`.
- GREEN: 4/4 passaram após instrumentação do redutor — `/tmp/city-phase-green1.log`.
- RED: `cidadeNarration.test.ts` não importável antes da criação; após implementação o teste revelou erro real de ativação pós-observação, corrigido com `lastPlayedKey`. `/tmp/city-narrator-red.log`, `/tmp/city-phase-audio-unit.log`; GREEN `/tmp/city-phase-audio-green2.log`.
- RED: `CidadeDormeAtmosphere.test.tsx` falhou antes do componente — `/tmp/city-atmosphere-red.log`; GREEN `/tmp/city-atmosphere-green1.log`.
- RED de integração: testes de `CidadeDormeLanRound` e `CidadeDormeMayorPanel` inicialmente falharam sem a legenda compartilhada — `/tmp/city-atmosphere-integration-red.log`; GREEN `/tmp/city-atmosphere-integration-green.log`.
- Testes adicionais cobrem fases opcionais puladas, revisão monotônica, nenhuma reemissão em pausa/ACK/voto, guests sem áudio, prefeito sem áudio, remoção de som em desconexão e snapshots duplicados.
- Gates finais reexecutados: `npm test` **792/792 testes em 135/135 arquivos PASS**, log `/tmp/city-orch01-release-tests.log`; `npm run typecheck` PASS, `/tmp/city-orch01-release-types.log`; `npm run lint` PASS, `/tmp/city-orch01-release-lint.log`; `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build` PASS, `/tmp/city-orch01-release-build.log`; `git diff --check` PASS. Resultado `0/0/0/0/0`.
- Mídias incluídas no build: `find dist/assets/cidade-dorme/narracao -name '*.m4a' | wc -l` retornou **9**.

## Limites explícitos — CITY-ORCHESTRATION-01 não está toda encerrada

- **Não testamos sincronização de áudio em aparelhos físicos.** Um único alto-falante reduz sobreposição, mas a chegada de snapshots aos convidados ainda tem latência LAN e nenhuma medição do desvio de relógios/displays foi feita.
- Ainda não há countdown cinematográfico, confirmação de recebimento do evento em cada aparelho, compensação de clock, orquestração de tempos mínimos por fase ou mecanismos específicos para travar ações se o host cair. O áudio acompanha eventos confirmados, não avança a regra do jogo por timer.
- A narração é pré-gravada e sintética (voz local do macOS). Antes da distribuição comercial, confirmar qualidade, naturalidade e direitos de redistribuição da voz gerada; caso necessário, substituí-la por locução licenciada/gravada, mantendo os mesmos caminhos de assets.
- O host precisa apertar **Ativar narração no anfitrião**; browsers e WebViews podem bloquear autoplay sem esse gesto. O fallback não impede jogar, pois a legenda sempre fica visível.
- O jogo de prefeito dedicado com 4 jogadores exige pelo menos **5 aparelhos**. O conjunto físico disponível no contexto anterior não basta para homologá-lo na configuração mínima.
- Sem merge na `main`, sem alteração na branch Live `feat/ux-hub-header-brand`, sem push, deploy, Capacitor sync ou instalação nova.

## Próximo gate: CITY-ORCHESTRATION-01B

Provar coordenação entre dispositivos com eventos confirmados, medição de latência e reconexão em sala física; tratar pausa autoritativa do host na queda de conexão. Refinar cenas imersivas e ativação do narrador no primeiro gesto de início do jogo. Testar pessoalmente 4 dispositivos no modo automático e, quando houver quinto aparelho, modo prefeito dedicado com 4 jogadores.
