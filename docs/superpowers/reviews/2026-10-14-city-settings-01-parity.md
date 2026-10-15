# CITY-SETTINGS-01 — Paridade de configurações do Cidade Dorme

Data: 2026-10-14. Branch isolada: `feat/cidade-dorme-core-01`.
Dependências: CITY-CORE-01 (sucessão do Assassino/Traidores), CITY-MAYOR-01 (prefeito dedicado), CITY-MAYOR-02 (painel e consulta confidencial).
Plano de produto: `docs/superpowers/designs/2026-10-14-cidade-dorme-prefeito-traitor-jester.md`.

## Objetivo e escopo

Alinhar a **configuração real aplicada pelo servidor LAN** à configuração da interface do modo de um celular, sem alterar seu motor, nem desestabilizar o host da sala ou a experiência do Impostor.

## Entregas

1. Contrato `CidadeDormeLanConfig` aceita configurações opcionais: `killersCount` (inteiro 1–3), `doctorCanSelfProtect` (booleano), `doctorSelfProtectLimit` (1, 2, 3, `unlimited`), `doctorCanRepeatProtection` (booleano). Preserva campos de Médico, Detetive, Coringa, revelação ao morrer e modo de condução. Rejeita valores malformados ou chaves não previstas.
2. `killersCount` governa o baralho de papéis: 1 Assassino, ou 1 Assassino + até 2 Traidores com prioridade secreta, sem ignorar a escolha do usuário. Ausência do campo em configuração antiga aplica a mesma recomendação dinâmica compartilhada do modo de um celular (4–7: 1, 8–11: 2, 12: 3).
3. Runtime autoritativo valida composição **após calcular jogadores participantes** e **antes** de criar/comprometer uma GameSession. Quantidade de papéis especiais superior à de jogadores retorna `invalid_config`, sem meia-sessão ou avanço parcial. A validação por total de jogadores foi adicionada como hook opcional por jogo (`validateForParticipants`) no catálogo, para não alterar outros jogos.
4. Autoproteção efetiva: o servidor registra quantas vezes o Médico se protegeu na GameSession, admite uma autoproteção se `doctorCanSelfProtect` e o limite configurado permitirem, recusa a seguinte quando limite acaba. `doctorCanRepeatProtection` determina se o mesmo alvo pode ser protegido em noites consecutivas. Uso de `canDoctorProtect` compartilhado com o modo de um celular.
5. Snapshot privado do Médico oferece `doctorEligibleTargetIds` apenas durante sua fase e para o papel vivo. A UI do celular mostra só opções autorizadas; autoproteção aparece quando permitida, desaparece quando proibida. Outros papéis e projeção pública não recebem essa lista. O servidor continua validando os comandos mesmo contra clientes modificados.
6. Lobby mostra equipe assassina 1–3 com os Traidores; seção avançada recolhível para autoproteção, limite e proteção consecutiva; alternâncias existentes de Médico, Detetive, Coringa e revelação ao morrer mantidas. Bloqueia salvar composição excedente e mostra total dos papéis especiais. A tela de resumo público mostra as regras escolhidas.
7. Configurações antigas com apenas 4 booleanos ou com `conductionMode` continuam válidas: o servidor completa `GameSettings` usando `createDefaultCidadeDormeSettings` em tempo de criação da partida. A implementação não exige alteração de protocolo v2 nem migração do cliente.

## TDD e evidências

- RED antes da implementação: `src/features/multiplayer/cidadeDormeSettingsParity.test.ts`, 5 de 6 testes falharam inicialmente por contratos e regras ausentes (`/tmp/city-settings-red.log`).
- RED de UI: `LobbyRoomView.cidadeLan.test.tsx` falhou em seleção de equipe assassina e opções do Médico (`/tmp/city-settings-ui-red.log`).
- RED de autoproteção no aparelho: `CidadeDormeLanRound.test.tsx` e novos asserts de `cidadeDormeSettingsParity.test.ts` falharam até disponibilizar lista privada de alvos permitidos (`/tmp/city-settings-doctor-ui-red.log`).
- GREEN dos testes de contratos (incluindo autodefesa e proteção em noites consecutivas), configuração do lobby, alvos privados e casos regressivos.
- **Gates finais (reexecutados após o ajuste visual do Médico): PASS.** `npm test`: **777/777 testes, 132/132 arquivos**; `npm run typecheck`: PASS; `npm run lint`: PASS sem erros/avisos; `VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 npm run build`: PASS; `git diff --check`: PASS. Veredito: `0/0/0/0/0`. Logs: `/tmp/city-settings-release-tests.log`, `/tmp/city-settings-release-type.log`, `/tmp/city-settings-release-lint.log`, `/tmp/city-settings-release-build.log`.

## Limites conhecidos / próximos marcos

- Modo de 1 celular continua com `themeId='classic'` e timers opcionais apenas no tipo, não como escolhas da tela atual. O LAN mantém tema clássico; futura estética imersiva e temporização/narração são parte de CITY-ORCHESTRATION, não desta etapa.
- A configuração de quantidade explícita é salva por partida; mudanças posteriores de participantes podem tornar uma composição inválida. Por isso o servidor revalida no START_GAME. O resumo e o lobby ajudam a prevenir esse estado.
- O prazo de narração/ação automatizada, pausa por desconexão, sincronização de voz/legendas e transições cinematográficas não estão incluídos; serão tratados no CITY-ORCHESTRATION-01.
- Não foram executadas partidas físicas com os aparelhos neste marco. Sem merge para main, sem atualizar Vite Live, sem push, sem sincronização Capacitor ou APK.

## Próximo trabalho — CITY-ORCHESTRATION-01

1. Formalizar contrato versionado de `phaseId`, `phaseRevision`, `startedAt` e `eventId` autoritativos; subfases de narração (noite/amanhecer) e objetivos privados; sincronização de relógio por host sem clocks soltos.
2. TDD para transição `reveal -> todos dormem -> assassino age -> médico -> detetive -> amanhecer -> discussão -> voto -> resultado`, no modo automático e com prefeito (incluindo casos de papel desabilitado/morto).
3. Um único alto-falante principal de narração em áudio offline pré-carregado, com legendas/fases sincronizadas e contingência sem áudio; sem sobreposição de vozes.
4. UI imersiva dedicada ao Cidade Dorme, sem repetir o lobby durante a partida.
5. Fase física de sincronismo e reconexão real: até 4 aparelhos atuais no modo todos jogam; para prefeito dedicado + mínimo 4 jogadores, é necessário o quinto dispositivo.
