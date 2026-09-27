# Arquitetura Multiplayer do Galerows

Atualizado em: 27 de setembro de 2026

## 1. Status

- **Fase atual:** 1.1 — baseline local, auditoria arquitetural e documentação inicial do multiplayer.
- **Implementação multiplayer iniciada:** não.
- **Escopo desta fase:** documentar a fundação conceitual, sem criar core, backend, transportes ou integrações.
- **Próximo passo:** revisão e aprovação desta arquitetura pelo gestor antes de qualquer implementação.
- **Baseline auditada:** branch `main`, HEAD `6e1e99221c03a18383fb1c69a01342c407278045`, upstream `origin/main`, sem ahead/behind e working tree inicialmente limpa.

Esta documentação descreve uma arquitetura-alvo. Os nomes de módulos e interfaces são provisórios e não constituem compromisso de API.

## 2. Contexto e objetivo

O Galerows é hoje um hub mobile-first em React + TypeScript + Capacitor, com jogos que funcionam offline e persistem estado localmente. O objetivo do multiplayer é adicionar execução entre aparelhos sem transformar a arquitetura offline atual em dependência de backend.

A fundação multiplayer precisa preservar um único modelo lógico de autoridade: o `Authoritative Room Runtime` executa a mesma semântica de sala independentemente do ambiente em que é hospedado. No modo online, esse runtime é executado no backend; no modo LAN, é executado no aparelho host. Os clientes acessam a autoridade por meio de implementações de `RoomTransport`, que são somente mecanismos/canais de comunicação. Em ambos os casos, os clientes enviam intenções/comandos e mantêm uma réplica do estado autorizado; telas e stores locais não são protocolo de sincronização.

Adedonha será o primeiro consumidor da fundação. Impostor da Palavra será o segundo validador arquitetural, especialmente por exigir separação rigorosa entre estado público e informação privada.

## 3. Arquitetura atual real

O padrão dominante confirmado no repositório é:

```text
React UI / hooks de inicialização
        ↓
Zustand store específico do jogo
        ↓
funções de domínio / session específicas do jogo
        ↓
Capacitor Preferences
```
Exemplos concretos:

- `src/features/adedonha/adedonha.store.ts` delega transições a `adedonha.session.ts` e persiste em `STORAGE_KEYS.adedonhaSession`.
- `src/features/impostor-da-palavra/impostorDaPalavra.store.ts` carrega conteúdo, restaura a sessão e delega regras a `impostorDaPalavra.session.ts`.
- `src/features/cidade-dorme/cidadeDorme.store.ts` persiste a sessão e usa funções de `cidadeDorme.session.ts` e a state machine pura de `cidadeDorme.stateMachine.ts`.
- `src/features/players/players.store.ts` mantém a galera local, apoiado por `players.model.ts` e `Capacitor Preferences`.
- `src/lib/capacitor/preferences.ts` é a abstração compartilhada de persistência JSON local.
- `src/lib/capacitor/network.ts` expõe apenas status de conectividade; não é transporte de jogo.
- `src/features/games/games.registry.ts` registra jogos e preserva a característica `isAvailableOffline`.

### Adedonha e QR

Adedonha não possui sala multiplayer. `encodeAdedonhaShare()` gera um payload base64 com versão, categorias e letra (`v`, `c`, `l`), e `AdedonhaQrScanner.tsx` apenas lê esse valor pela câmera. Não há `roomId`, membership, conexão persistente, autoridade remota ou sincronização de respostas.

### Sessões por jogo

As sessões são específicas por jogo e possuem schemas próprios, como `AdedonhaSession`, `ImpostorDaPalavraSession` e `GameState` de Cidade Dorme. Não existe uma abstração genérica de room/session multiplayer compartilhada.

### Cidade Dorme

Cidade Dorme possui state machine separada e testada em `cidadeDorme.stateMachine.ts`, com fases explícitas e funções puras para avanço. Esse desenho comprova que regras de transição podem ficar fora da UI/store e é uma referência útil para o futuro runtime autoritativo.

### Backend e infraestrutura remota

Não foram encontrados Supabase, Realtime, WebSocket, Socket.IO, `RoomTransport`, `RoomEngine`, `SyncEngine` ou outro backend de multiplayer. `package.json` não contém SDK de Supabase. A permissão Android `INTERNET` existe, mas não há infraestrutura de sala associada.
### Código nativo

No Android, o código customizado observado em `android/app/src/main/java/com/galerows/app/` é `MainActivity.java` e `PlayStorePlugin.java`; o plugin customizado é dedicado a atualização/review da Play Store, não a rede. O `AndroidManifest.xml` declara `INTERNET` e `CAMERA`, sem infraestrutura LAN própria.

No iOS, `Info.plist` e `AppDelegate.swift` permanecem essencialmente na configuração padrão do Capacitor, sem plugin nativo de rede customizado.

### Testes e TypeScript

Os testes ficam majoritariamente colocalizados com cada feature em arquivos `*.test.ts` e `*.test.tsx`, usando Vitest; `vite.config.ts` configura `jsdom` e `src/test/setup.ts`. A auditoria encontrou 51 arquivos de teste e 219 testes passando.

O modo `strict` do TypeScript **não está habilitado**: nem `tsconfig.app.json` nem `tsconfig.node.json` declaram `strict: true`. Há flags de qualidade como `noUnusedLocals`, `noUnusedParameters` e `noFallthroughCasesInSwitch`, mas elas não equivalem ao strict mode.

## 4. Reutilização possível

Elementos que podem ser reaproveitados conceitualmente, sem tratá-los como multiplayer core:

- `GameParticipant` e helpers de `src/features/players/` como base de identidade local de participante.
- `createId()` para IDs locais; para protocolo, a geração e o escopo dos IDs ainda precisam ser formalizados.
- `shuffle()` e funções puras de domínio, desde que a aleatoriedade autoritativa seja executada apenas pela autoridade.
- O padrão `*.session.ts` de funções puras para transições de jogo.
- A state machine de Cidade Dorme como referência de separação entre regra e apresentação.
- `schemaVersion` e validação de sessão já usados pelos jogos como precedente para versionamento.
- `LocalPreferences` para preservar o modo offline existente; não deve virar mecanismo de sincronização.
- `AppNetwork` pode informar conectividade à UX, mas não substitui um transporte de sala.
- O estilo de testes colocalizados, determinísticos e com injeção de `random` em regras.

## 5. Limites da arquitetura atual

A arquitetura atual não possui identidade entre aparelhos, room lifecycle, membership, presence, revisão monotônica, envelopes de protocolo, comandos idempotentes, snapshots, resync, transporte bidirecional ou autoridade compartilhada.
Além disso, os stores atuais combinam estado de apresentação, persistência e aplicação local de comandos. Esse modelo é adequado ao offline, mas não pode ser tratado como fonte de verdade distribuída.

Há uso frequente de `new Date()` e `Math.random` nas sessões. Em multiplayer, tempo e aleatoriedade que afetem regra precisam ser produzidos pela autoridade, não por clientes independentes.

Jogos com informação secreta hoje mantêm o estado canônico no mesmo aparelho. Em multiplayer, esse estado não pode ser replicado integralmente para todos os clientes.

## 6. Invariantes do multiplayer

As seguintes decisões são tratadas como fechadas:

- Os jogos offline atuais continuam funcionando sem backend.
- Multiplayer é adicional e modular.
- Zustand não é protocolo multiplayer.
- Telas não são sincronizadas.
- Clientes enviam comandos/intenção.
- Existe uma autoridade lógica única por sala, exercida pelo `Authoritative Room Runtime`.
- Online: o backend hospeda e executa esse runtime autoritativo.
- LAN: o aparelho host hospeda e executa esse runtime autoritativo.
- `revision` é monotônica.
- Gaps de `revision` provocam resync via snapshot.
- Retry deve admitir idempotência por `commandId` quando aplicável.
- Membership da sala é diferente de presence/conectividade.
- Timer local não é fonte autoritativa de tempo.
- Estado público e estado privado são projeções diferentes.
- Clientes nunca recebem private state de outros jogadores.
- LAN V1 não terá host migration automática.
- Bluetooth está fora.
- WebRTC está fora, salvo necessidade técnica posteriormente demonstrada.
- Adedonha será o primeiro consumidor.
- Impostor da Palavra será o segundo validador da arquitetura.
## 7. Arquitetura-alvo inicial

```text
Zustand / React presentation
        |
        v
Client Sync / Replica
        |
        v
RoomTransport
        |
        |  Command / Event / Snapshot / Resync
        |
        v
+--------------------------------------------------+
| AUTHORITY ENVIRONMENT                            |
|                                                  |
| Online: backend      OU      LAN: host device    |
|                                                  |
|        Authoritative Room Runtime                |
|        +-- command validation                    |
|        +-- revision / idempotency                |
|        +-- membership                            |
|        +-- barriers/checkpoints                  |
|        +-- authoritative clock                   |
|        +-- public/private projection             |
|                    |                             |
|                    v                             |
|        Game-specific Multiplayer Adapter         |
|                    |                             |
|                    v                             |
|              Game domain/rules                   |
+--------------------------------------------------+
```

Os envelopes de protocolo atravessam a fronteira de transporte entre cliente e autoridade. O `RoomTransport` não exerce autoridade e não contém regra de jogo: apenas entrega esses envelopes. A autoridade lógica pertence ao `Authoritative Room Runtime`, hospedado no backend no modo online ou no aparelho host no modo LAN.
Os nomes são provisórios. O repositório favorece módulos de domínio como `*.session.ts`, stores finos e funções puras; por isso, na implementação futura, é recomendável preservar essa convenção e evitar nomes que sugiram que o Zustand ou a UI são a engine da sala.

Uma possível nomenclatura coerente seria manter “runtime” para a autoridade de sala, “adapter” para a ponte específica do jogo, “transport” para I/O e “replica” para o estado cliente. A nomenclatura final deve ser aprovada antes de criar interfaces.

## 8. Separação de responsabilidades

### Authoritative runtime

Mantém o estado canônico da sala, valida comandos, executa transições de jogo, incrementa `revision`, aplica idempotência, controla membership, barriers/checkpoints, relógio e gera projeções públicas/privadas. É lógica autoritativa compartilhada e não conhece Supabase, WebSocket, TCP, Bonjour nem outros detalhes concretos de hospedagem ou transporte.

### Client replica/sync

Mantém apenas a projeção autorizada daquele cliente, aplica eventos em ordem, detecta gaps, solicita resync e substitui a réplica por snapshots. Não decide regra de jogo.

### Transport

É somente o mecanismo/canal de comunicação entre cliente e ambiente de autoridade. Entrega envelopes de protocolo (`Command`, `Event`, `Snapshot`, `Resync`) sem decidir regras, validar transições de jogo ou exercer autoridade. Implementações online e LAN podem usar tecnologias diferentes, mas devem preservar o mesmo contrato lógico acima do transporte.

### Game adapter

Pertence ao lado autoritativo/domínio. Fornece ao `Authoritative Room Runtime` as regras e operações específicas de cada jogo, traduzindo Commands para operações de domínio e o estado canônico para projeções públicas e privadas. Não conhece Supabase, WebSocket, TCP, Bonjour, Zustand ou outros detalhes do transporte/apresentação.

### Presentation/store

Zustand e React consomem a réplica e enviam intenções. Podem manter estado efêmero de UI, mas nunca devem ser a fonte autoritativa da partida multiplayer.
## 9. Protocolo conceitual

Ainda não há schemas definitivos. O protocolo deve, porém, carregar metadados suficientes para validar origem, ordem e compatibilidade.

Campos conceituais comuns:

- `protocolVersion`: versão do protocolo multiplayer.
- `roomId`: sala a que o envelope pertence.
- `playerId`: identidade do participante remetente ou destinatário quando aplicável.
- `commandId`: identificador estável de uma intenção, usado para correlação e idempotência.
- `revision`: versão monotônica do estado autoritativo associada a Event/Snapshot.
- `Command`: intenção enviada pelo cliente à autoridade.
- `Event`: consequência autoritativa aceita e ordenada.
- `Snapshot`: projeção completa do estado autorizada para um cliente em determinada revision.
- `Resync`: solicitação/resposta para recuperar consistência após gap, reconnect ou estado inválido.

Um Command não deve descrever “qual tela abrir”; deve expressar intenção de domínio, como iniciar rodada, enviar resposta ou marcar pronto. Event e Snapshot devem refletir resultado autorizado, nunca confiar no estado proposto pelo cliente.

Erros de comando precisam ser representáveis sem avançar a revision quando nenhuma mudança de estado for aceita. O formato final de erro/ack permanece em aberto.

## 10. Revision e reconciliação

A `revision` é monotônica por sala e só é avançada pela autoridade quando uma mudança autoritativa aceita altera o estado relevante.

O cliente mantém a última revision aplicada. Ao receber `revision = local + 1`, aplica o evento. Ao receber uma revision já aplicada, trata o envelope como duplicata conforme o protocolo. Ao receber uma revision maior que `local + 1`, interrompe a aplicação incremental e solicita resync.
O resync retorna um Snapshot da projeção permitida para aquele cliente, acompanhado da revision canônica. O cliente substitui sua réplica local pelo snapshot e volta a aceitar eventos posteriores.

Reconciliação não significa reproduzir ações otimistas do Zustand como verdade. Otimismo de UI, se existir, deve ser claramente efêmero e descartável diante do estado autoritativo.

## 11. Idempotência

Retries são esperados em rede móvel e em reconexões. Commands que possam ser reenviados devem carregar `commandId` estável.

A autoridade mantém, por janela definida, informação suficiente para reconhecer um `commandId` já processado no escopo correto e devolver o mesmo resultado lógico sem repetir efeitos. O escopo, retenção e política de expiração dessa deduplicação ainda precisam ser definidos.

Idempotência não substitui validação de fase, membership ou autorização. Um comando duplicado válido não pode executar duas vezes; um comando inválido continua inválido.

## 12. Membership vs Presence

**Membership** representa quem pertence à sala, qual `playerId` possui, qual papel de sala possui e se está autorizado a enviar comandos.

**Presence** representa estado transitório de conectividade, como conectado, desconectado ou visto recentemente.

Desconectar não remove automaticamente o membership. Da mesma forma, receber heartbeats não concede membership. Regras de jogo devem decidir explicitamente como tratar participantes desconectados.

O runtime autoritativo é responsável por membership; o mecanismo de presence pode variar por transporte sem alterar a regra de sala.

## 13. Clock e timers

Tempo que afeta regra deve partir da autoridade. O cliente não decide expiração usando apenas `Date.now()` ou timers locais.

A autoridade deve publicar timestamps/deadlines autoritativos suficientes para que o cliente renderize contagens regressivas. O relógio local serve apenas para apresentação aproximada entre sincronizações.
Ao retomar conexão, suspender/voltar do background ou detectar desvio relevante, o cliente deve recalcular a apresentação a partir do estado autoritativo. Expiração de turno, janela de resposta ou encerramento de barrier é decisão da autoridade.

Para testes, o runtime deve receber uma abstração de clock controlável em vez de depender diretamente do relógio do sistema.

## 14. Barrier/checkpoint

Barrier/checkpoint representa um ponto em que a autoridade espera uma condição coletiva antes de avançar, por exemplo participantes prontos para iniciar a próxima etapa.

O barrier deve ser parte do estado autoritativo, com conjunto de membros esperados, membros satisfeitos e regra explícita de conclusão. Presence não deve implicitamente alterar a lista de participantes exigidos.

Timeout, abandono, remoção de membro e override de host/moderador precisam de regras explícitas por caso. Esses detalhes não são fechados nesta fase.

## 15. Public state vs Private player state

O runtime mantém estado canônico suficiente para aplicar as regras, mas cada cliente recebe somente uma projeção autorizada.

A projeção pública contém fatos que todos os membros podem conhecer. A projeção privada contém apenas informação do próprio jogador, quando necessária. Nenhum cliente deve receber private state de outros participantes, nem mesmo “oculto” apenas pela UI.

Em jogos como Impostor da Palavra, isso exige adaptar o modelo atual: hoje o mesmo aparelho possui `currentImpostorId`, carta e informações necessárias para revelar cada papel. No multiplayer, a autoridade deve produzir briefings privados individualizados e uma projeção pública sem segredos.

Testes de projeção devem provar ausência de vazamento, não apenas ausência visual na tela.
## 16. Online authority

No modo online, o backend hospeda e executa o `Authoritative Room Runtime`, que exerce a autoridade lógica da sala. Clientes autenticados/autorizados enviam Commands através de uma implementação de `RoomTransport`; o runtime valida membership, fase, payload e regra do jogo antes de alterar o estado. O runtime não deve conhecer o fornecedor de backend nem detalhes do transporte.

A tecnologia de backend não é decidida nesta fase. Supabase não foi instalado nem escolhido como compromisso arquitetural.

Persistência de sala, retenção, recovery após restart do backend, escalabilidade e estratégia de distribuição entre processos são decisões posteriores. O contrato de domínio deve evitar dependência direta do fornecedor escolhido.

## 17. LAN authority

No modo LAN, o aparelho host hospeda e executa o mesmo `Authoritative Room Runtime` usado conceitualmente no modo online. Esse runtime mantém o estado canônico, valida Commands, incrementa revision e projeta estado para cada cliente. O mecanismo LAN escolhido é apenas transporte e descoberta; não deve alterar a semântica lógica do runtime.

O transporte LAN permanece em aberto. Esta fase não escolhe WebSocket, TCP, Bonjour, hotspot ou qualquer plugin nativo. A escolha futura deve considerar Android/iOS reais, descoberta, permissões, foreground/background, segurança e estabilidade de conexão.

O adapter do jogo e as regras de runtime não devem saber se a autoridade está no backend ou no host local.

Como o host contém o estado canônico, ele poderá materialmente possuir segredos de outros jogadores na memória do aparelho; a UI do host ainda deve receber somente a projeção apropriada ao usuário local. O threat model dessa limitação deve ser explicitado antes do lançamento.

## 18. Host failure V1

LAN V1 não terá migração automática de host.

Se o host ficar indisponível, a sala não elege automaticamente um novo aparelho como autoridade. Clientes devem entrar em estado explícito de perda de autoridade e impedir novas transições locais como se fossem válidas.

A política exata entre aguardar retorno do mesmo host, encerrar sala ou permitir reinício manual permanece em aberto. O requisito fechado é não promover cliente automaticamente na V1.
## 19. Segurança inicial

A segurança deve partir do princípio de que payloads de clientes e QRs são não confiáveis.

Requisitos mínimos conceituais:

- Validar estrutura e `protocolVersion` de todos os envelopes.
- Validar `roomId`, membership e associação entre conexão e `playerId`.
- Validar Commands contra fase, permissões e regras de domínio.
- Nunca aceitar do cliente estado canônico completo como substituto do estado da autoridade.
- Deduplicar Commands idempotentes por `commandId`.
- Não enviar private state de outros jogadores.
- Limitar tamanhos de payload, frequências e recursos por sala.
- Tratar reconnect e replay sem reexecutar efeitos.
- Evitar colocar segredos duráveis ou private state diretamente em QR de convite.
- Definir proteção de transporte e threat model tanto para online quanto LAN antes de produção.

O QR atual da Adedonha é apenas base64 de JSON e não oferece autenticação ou integridade. Ele pode inspirar o fluxo de compartilhamento visual, mas não deve ser promovido a credencial confiável sem um novo desenho.

## 20. Compatibilidade offline

O modo offline continua independente de backend e deve manter os fluxos atuais.

A introdução do multiplayer deve ser uma capacidade paralela: o modo offline pode continuar usando os stores/sessões atuais e `LocalPreferences`, enquanto o modo multiplayer usa adapter + replica/sync + transport.

Nenhuma tela offline deve passar a depender de room membership, conexão de rede ou disponibilidade de backend para iniciar ou retomar uma partida local.
O `games.registry.ts` já modela jogos como disponíveis offline. Essa propriedade deve permanecer verdadeira para os jogos atuais salvo decisão explícita futura.

A persistência de sessões offline e a persistência/recovery de salas multiplayer são problemas distintos e não devem compartilhar uma mesma chave ou assumir o mesmo ciclo de vida.

## 21. Estratégia inicial de testes

A fundação multiplayer deve nascer testável sem rede real.

Camadas recomendadas:

- **Runtime:** testes unitários de Commands válidos/inválidos, revision, membership, barriers, clock e transições.
- **Idempotência:** repetir o mesmo `commandId` e provar ausência de efeitos duplicados.
- **Replica/sync:** eventos em ordem, duplicados, gaps, snapshots e reconnect.
- **Projeções:** provar que cada jogador recebe somente public state + seu private state.
- **Adapter por jogo:** validar tradução entre Commands multiplayer e funções de domínio do jogo.
- **Transport contract:** uma mesma suíte de contrato para transportes online, LAN e fake/in-memory.
- **Integração multi-cliente:** simular múltiplos clientes contra uma autoridade em memória.
- **Falhas:** atraso, duplicação, perda, reorder controlado, reconnect e perda do host.
- **Compatibilidade:** manter a suíte offline atual sem regressão.
- **Protocol versioning:** garantir rejeição/negociação controlada de versões incompatíveis.

Random e clock devem ser injetáveis nos testes autoritativos para resultados determinísticos.

A suíte existente já oferece um padrão útil: funções de domínio puras, testes por feature e testes de fluxo React. O multiplayer deve preservar essa organização sem depender de testes E2E de rede para validar regras básicas.
## 22. Riscos encontrados

### Divergência funcional preexistente no Impostor da Palavra

A divergência indicada para auditoria foi confirmada.

O `ROADMAP.md` afirma que deve existir “um impostor por rodada e cada participante como impostor exatamente uma vez por partida”. Porém, `createImpostorQueue()` em `impostorDaPalavra.session.ts` executa um sorteio independente para cada posição da fila, permitindo que o mesmo participante seja escolhido em várias rodadas.

Os testes atuais confirmam esse comportamento intencional da implementação: há testes que esperam impostores repetidos e descrevem sorteios independentes. Portanto, documentação e comportamento executável estão desalinhados.

Esta fase não altera regra, implementação ou testes. A regra correta precisa ser decidida antes de adaptar Impostor da Palavra ao multiplayer.

### Outros riscos

- TypeScript strict não está habilitado; contratos de protocolo exigirão disciplina adicional de validação em runtime e tipagem.
- Stores atuais acumulam coordenação, persistência e aplicação de transições; reutilizá-los diretamente como protocolo criaria acoplamento indevido.
- `Math.random` e relógio local aparecem em regras atuais; no multiplayer, resultados relevantes precisam ser produzidos pela autoridade.
- Jogos com segredos exigem projeções por jogador; replicar o estado canônico inteiro vazaria informação.
- Online e LAN podem divergir se não compartilharem a mesma semântica de runtime e uma suíte comum de contrato.
- LAN em Android/iOS envolve descoberta, permissões, suspensão em background e mudanças de rede ainda não validadas.
- QR atual não autentica conteúdo e não deve ser usado como prova de identidade ou autorização.
- Falha do host LAN V1 interrompe a autoridade; a UX e a política de recuperação ainda precisam ser definidas.
- Versionamento de protocolo e compatibilidade entre versões do app ainda não possuem política fechada.
- Manter simultaneamente caminhos offline e multiplayer pode gerar drift de regras se adapters duplicarem lógica em vez de delegar ao domínio compartilhado.
## 23. Decisões fechadas

Consideram-se fechadas para orientar a implementação futura:

- Offline permanece funcional sem backend.
- Multiplayer é modular e adicional.
- Zustand e telas não fazem parte do protocolo.
- Cliente envia intenção; autoridade valida e executa.
- Há exatamente uma autoridade lógica por sala, exercida pelo `Authoritative Room Runtime`.
- O backend hospeda/executa o runtime no online; o aparelho host hospeda/executa o mesmo modelo lógico de runtime na LAN.
- `revision` é monotônica e gaps exigem snapshot/resync.
- Retries devem suportar `commandId` idempotente quando aplicável.
- Membership e presence são conceitos separados.
- Tempo de regra vem da autoridade.
- Estado público e privado são projeções distintas.
- Private state de um jogador nunca é enviado aos demais.
- LAN V1 não terá host migration automática.
- Bluetooth não faz parte do escopo.
- WebRTC não faz parte do escopo salvo necessidade técnica posterior comprovada.
- Adedonha é o primeiro consumidor.
- Impostor da Palavra é o segundo validador arquitetural.
- Nenhum fornecedor de backend ou tecnologia de transporte foi selecionado nesta fase.

## 24. Decisões abertas

Antes ou durante as próximas fases autorizadas, ainda precisam ser definidos:

- nomenclatura final dos módulos e contratos;
- lifecycle da sala: criação, entrada, saída, encerramento e expiração;
- identidade de sala, jogador, dispositivo e eventual host/moderador;
- formato definitivo de Command, Event, Snapshot, Resync, ack e erro;
- regra exata para quando uma alteração incrementa `revision`;
- escopo, retenção e expiração da deduplicação por `commandId`;
- mecanismo de recuperação/persistência da autoridade online;
- tecnologia/provedor do backend online;
- transporte online;
- descoberta e transporte LAN compatíveis com Android/iOS;
- política de reconnect e de retorno do app do background;
- política de falha definitiva do host na LAN V1;
- autenticação/autorização de convite e entrada em sala;
- versionamento e compatibilidade de protocolo entre versões do app;
- limites de payload, rate limiting e capacidade por sala;
- semântica de barriers/checkpoints em abandono, timeout e remoção;
- política de observabilidade, logs e correlação por `commandId`;
- decisão funcional sobre a fila de impostores antes do adapter multiplayer do Impostor.
## 25. Roadmap técnico resumido por fases

### Fase 1.1 — Auditoria e arquitetura inicial

Estado atual. Confirmar baseline, registrar arquitetura existente, invariantes, riscos e arquitetura-alvo. Nenhum core multiplayer é implementado.

### Fase 1.2 — Fechamento dos contratos da fundação

Após aprovação do gestor, fechar nomenclatura e contratos mínimos de runtime, envelopes, revision, idempotência, membership, barriers/checkpoints, clock, projeções e resync. Somente então autorizar a implementação da fundação desacoplada de transporte real.

### Fase 2 — Multiplayer core independente de transporte real

Implementar o core conforme os contratos aprovados: `Authoritative Room Runtime`, protocolo conceitual, revision/resync, idempotência, membership, barriers/checkpoints, authoritative clock, public/private projection e client replica/sync. O core pode usar fake/in-memory e adapters mínimos de teste, mas não depende da Adedonha nem de qualquer jogo real para provar suas invariantes.

### Fase 3 — Harness e integração multi-cliente em memória

Validar o core com múltiplos clientes simulados contra uma autoridade em memória, incluindo ordem de eventos, duplicatas, gaps, snapshots, reconnect, projeções e falhas controladas. Esta etapa permanece anterior ao primeiro jogo real e ao primeiro transporte real.

### Fase 4 — Transporte e autoridade online

Escolher somente nesta etapa a infraestrutura online. Hospedar o mesmo `Authoritative Room Runtime` no backend e integrar uma implementação online de `RoomTransport`, preservando os contratos do core e a compatibilidade offline.

### Fase 5 — Adedonha multiplayer online

Criar a Adedonha como primeiro consumidor real da fundação, por meio de seu game-specific adapter, usando o core e o transporte online já validados.

### Fase 6 — Validação arquitetural e hardening do fluxo online

Validar o primeiro fluxo real ponta a ponta e endurecer compatibilidade de protocolo, segurança, limites, observabilidade, recovery, reconnect e regressões offline antes de iniciar LAN.

### Fase 7 — Spike técnico LAN

Investigar em aparelhos e plataformas alvo descoberta, conectividade local, permissões, foreground/background, segurança e perda do host. Esta etapa serve para decidir as necessidades nativas e a tecnologia de transporte LAN; não implementa LAN junto com o online.

### Fase 8 — Transporte LAN

Implementar o transporte LAN escolhido utilizando o mesmo contrato lógico do core. O aparelho host hospeda o mesmo `Authoritative Room Runtime`; diferenças de rede não devem alterar semântica de revision, idempotência, membership, barriers, clock ou projeções.

### Fase 9 — Adedonha LAN

Executar Adedonha em LAN reutilizando o mesmo adapter e o mesmo core sempre que aplicável, trocando apenas o ambiente de hospedagem da autoridade e a implementação de `RoomTransport`.

### Fase 10 — Validação em dispositivos Android/iOS reais

Validar Adedonha online e LAN em dispositivos Android e iOS reais, incluindo descoberta, reconnect, background/foreground, mudanças de rede, perda do host e compatibilidade entre clientes.

### Fase 11 — Impostor da Palavra

Antes de criar o adapter multiplayer do Impostor, resolver a divergência funcional já registrada sobre a seleção do impostor. Depois, usar a mesma fundação já validada por Adedonha online e LAN para testar private state e informação secreta por jogador.

### Fase 12 — Hardening de private state, barriers e reconnect

Validar e endurecer private state, barriers/checkpoints, reconnect, resync e falhas tanto online quanto LAN, além de testes de segurança e regressão da fundação compartilhada.
## 26. Critério de aceite para iniciar implementação do multiplayer core

A implementação do multiplayer core só deve começar quando:

- esta arquitetura tiver sido revisada e aprovada pelo gestor;
- as fronteiras entre runtime autoritativo, replica/sync, transport, game adapter e presentation/store estiverem aceitas;
- a semântica mínima de Command, Event, Snapshot e Resync estiver acordada;
- `revision`, detecção de gap e substituição por snapshot estiverem definidas;
- a estratégia de idempotência por `commandId` estiver aceita;
- membership e presence permanecerem explicitamente separados;
- clock/timers autoritativos e barriers/checkpoints tiverem contratos mínimos claros;
- a política de projeção public/private estiver aceita como requisito de segurança;
- online e LAN puderem compartilhar a mesma lógica de runtime sem dependência do transporte;
- a manutenção do modo offline sem backend estiver preservada por desenho;
- a estratégia de testes em memória, contratos de transporte e projeções estiver aprovada;
- as decisões abertas que afetem APIs públicas do core estiverem fechadas ou conscientemente postergadas sem bloquear o contrato;
- a divergência do Impostor estiver registrada como pendência funcional e reconhecida como bloqueio para o adapter desse jogo, não como alteração desta fase;
- a baseline de `typecheck`, lint, testes e build continuar verde.

Até esses critérios serem atendidos, este documento é referência para revisão arquitetural, não autorização para criar interfaces, schemas definitivos, backend ou transporte.
