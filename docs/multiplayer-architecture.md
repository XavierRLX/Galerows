# Arquitetura Multiplayer do Galerows

Atualizado em: 27 de setembro de 2026

## 1. Status

- **Fase atual:** 1.2 — fechamento dos contratos da fundação multiplayer.
- **Implementação multiplayer iniciada:** não.
- **Escopo desta fase:** fechar os contratos conceituais mínimos do core antes de qualquer implementação, sem criar código, backend, transportes ou integrações.
- **Próximo passo:** revisão e aprovação destes contratos pelo gestor antes de iniciar a Fase 2.
- **Baseline histórica da Fase 1.1:** branch `main`, HEAD `6e1e99221c03a18383fb1c69a01342c407278045`, upstream `origin/main`, sem ahead/behind e working tree inicialmente limpa.
- **Baseline da Fase 1.2:** branch `main`, HEAD `353784241889611c59f822caf6a4cd15faa1daea`, upstream `origin/main`, ahead/behind `1 / 0` e working tree limpa.

Esta documentação descreve a arquitetura-alvo e os contratos conceituais fechados da fundação. A nomenclatura conceitual `AuthoritativeRoomRuntime`, `GameAdapter`, `RoomTransport` e `ClientReplica` fica adotada; nomes de arquivos TypeScript, assinaturas concretas e detalhes de infraestrutura continuam fora desta fase.

## 2. Contexto e objetivo

O Galerows é hoje um hub mobile-first em React + TypeScript + Capacitor, com jogos que funcionam offline e persistem estado localmente. O objetivo do multiplayer é adicionar execução entre aparelhos sem transformar a arquitetura offline atual em dependência de backend.

A fundação multiplayer precisa preservar um único modelo lógico de autoridade: o `AuthoritativeRoomRuntime` executa a mesma semântica de sala independentemente do ambiente em que é hospedado. No modo online, esse runtime é executado no backend; no modo LAN, é executado no aparelho host. Os clientes acessam a autoridade por meio de implementações de `RoomTransport`, que são somente mecanismos/canais de comunicação. Em ambos os casos, os clientes enviam intenções/comandos e mantêm uma réplica do estado autorizado; telas e stores locais não são protocolo de sincronização.

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
- `createId()` para IDs locais; no protocolo, os papéis/escopos conceituais de identidade são fechados na seção 9, enquanto a geração concreta dos identificadores permanece aberta.
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
- Existe uma autoridade lógica única por sala, exercida pelo `AuthoritativeRoomRuntime`.
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
ClientReplica
        |
        v
RoomTransport
        |
        |  Command / CommandResult / Event / Snapshot / ResyncRequest
        |
        v
+--------------------------------------------------+
| AUTHORITY ENVIRONMENT                            |
|                                                  |
| Online: backend      OU      LAN: host device    |
|                                                  |
|        AuthoritativeRoomRuntime                  |
|        +-- command validation                    |
|        +-- revision / idempotency                |
|        +-- membership                            |
|        +-- barriers/checkpoints                  |
|        +-- authoritative clock                   |
|        +-- public/private projection             |
|                    |                             |
|                    v                             |
|        GameAdapter                               |
|                    |                             |
|                    v                             |
|              Game domain/rules                   |
+--------------------------------------------------+
```

Os envelopes de protocolo atravessam a fronteira de transporte entre cliente e autoridade. O `RoomTransport` não exerce autoridade e não contém regra de jogo: apenas entrega esses envelopes. A autoridade lógica pertence ao `AuthoritativeRoomRuntime`, hospedado no backend no modo online ou no aparelho host no modo LAN.

A nomenclatura conceitual da fundação fica fechada nesta fase: `AuthoritativeRoomRuntime` para a lógica autoritativa da sala, `GameAdapter` para regras específicas do jogo, `RoomTransport` para comunicação e `ClientReplica` para a cópia sincronizada do cliente. O repositório favorece módulos de domínio como `*.session.ts`, stores finos e funções puras; a implementação futura deve preservar essa separação sem transformar Zustand ou UI em engine da sala.

## 8. Separação de responsabilidades

### AuthoritativeRoomRuntime

É a lógica autoritativa compartilhada da sala. Responsabiliza-se por:

- manter o estado canônico da sala;
- manter membership;
- validar estrutural e contextualmente Commands;
- aplicar idempotência por `commandId`;
- controlar e avançar `revision`;
- manter barriers/checkpoints;
- decidir deadlines e usar authoritative clock;
- executar transições autoritativas, delegando regra específica ao `GameAdapter`;
- produzir public/private projections autorizadas;
- gerar `CommandResult`, `Event` e `Snapshot` coerentes com o estado canônico.

O `AuthoritativeRoomRuntime` não conhece React, Zustand, Supabase, WebSocket, TCP, Bonjour, detalhes de Android/iOS nem detalhes concretos de transporte. O ambiente online ou LAN apenas hospeda/executa esse mesmo modelo lógico.

### GameAdapter

É a fronteira exclusiva para regras específicas de um jogo. Deve permitir ao runtime:

- criar o estado inicial do jogo;
- validar Commands específicos do jogo;
- executar transições de domínio;
- produzir public state;
- produzir private state por `playerId`;
- informar condições de fase/barrier relevantes quando necessário;
- operar deterministicamente em testes quando random/clock forem fornecidos.

O `GameAdapter` não conhece transporte, React ou Zustand. O runtime genérico não deve conter branches para `ADEDONHA`, `STOP`, categorias, impostor, carta, votação, Cidade Dorme ou qualquer outra regra específica de jogo.

### RoomTransport

É somente o mecanismo/canal de comunicação. Não valida regras do jogo, não altera estado canônico e não decide `revision`.

Seu contrato lógico deve permitir, no lado cliente:

- conectar e desconectar;
- enviar `Command`;
- receber mensagens autoritativas;
- enviar `ResyncRequest`.

No lado da autoridade, deve permitir:

- identificar a conexão efêmera por `connectionId`;
- receber `Command`;
- enviar resposta/projeção à conexão correta;
- fazer broadcast somente de informação pública/autorizada;
- desconectar ou rejeitar conexão quando necessário.

Tecnologia concreta de transporte não faz parte deste contrato.

### ClientReplica

Mantém somente a projeção permitida ao cliente. Não executa regras autoritativas. Responsabiliza-se por:

- aplicar estado autorizado recebido por `Event` ou `Snapshot`;
- acompanhar a última `revision` efetivamente aplicada (`lastAppliedRevision`, ou nomenclatura equivalente futura);
- detectar mensagens duplicadas, antigas e gaps a partir dessa revision aplicada;
- solicitar resync quando necessário;
- substituir sua cópia por `Snapshot` autoritativo aceito;
- representar estado de conexão/sincronização para a camada de apresentação.

`CommandResult` não altera public/private state da `ClientReplica` e não avança `lastAppliedRevision`. A revision informada em `CommandResult`, quando presente, é apenas informativa/correlacional sobre o processamento daquele Command. Somente um `Event` incremental efetivamente aplicado ou um `Snapshot` aceito modifica a revision aplicada da réplica.

### Presentation/store

Zustand e React consomem a `ClientReplica` e enviam intenções. Podem manter estado efêmero de UI, mas nunca devem ser a fonte autoritativa da partida multiplayer.
## 9. Identidade e protocolo conceitual

Os contratos desta seção são lógicos; não definem ainda interfaces TypeScript nem formato de serialização.

### Identidade mínima

- `roomId`: identifica uma sala e não é segredo por si só.
- `playerId`: identifica um membership lógico dentro da sala, não depende da conexão atual e deve sobreviver a reconnect.
- `connectionId`: identifica uma conexão/transporte efêmero; pode mudar a cada reconnect e nunca substitui `playerId`.
- `commandId`: identifica de forma estável uma única intenção. Retry da mesma intenção reutiliza o mesmo valor. O contrato exige unicidade por sala; a forma concreta de geração permanece aberta.

Não é necessário introduzir outro conceito de identidade no core nesta fase.

### Command

Um `Command` representa intenção do cliente, nunca estado canônico completo. Quando aplicável, carrega:

- `protocolVersion`;
- `roomId`;
- `playerId`;
- `commandId`;
- tipo do comando;
- payload específico;
- metadados mínimos de correlação/validação.

Commands de sala e Commands de jogo são semanticamente distintos. Exemplos de sala incluem `JOIN_ROOM`, `LEAVE_ROOM`, `READY` e `START_GAME` quando fizer parte do lifecycle da sala. Exemplos futuros de jogo podem incluir `START_ROUND`, `SUBMIT_ANSWER`, `STOP_ROUND`, `SUBMIT_VOTE`, `CONFIRM_PRIVATE_REVEAL` e `NEXT_ROUND`. A lista de cada jogo não é fechada aqui; o requisito é impedir lógica como `if (game === "adedonha")` no core.

### CommandResult

Existe resposta autoritativa explícita para correlacionar o processamento ao `commandId`. O resultado lógico possui quatro categorias mínimas:

- **accepted:** comando aceito; carrega a `revision` autoritativa resultante, ou a revision atual quando não houver mutação de estado sincronizado;
- **rejected:** comando compreendido, porém recusado por autorização, membership, fase, regra ou payload; não avança revision;
- **recoverable_error:** falha transitória/recuperável produzida pela autoridade sem aceitar a transição; não avança revision;
- **incompatible_protocol:** `protocolVersion` incompatível; falha explicitamente e não tenta adaptar silenciosamente o payload.

Todo `CommandResult` produzido depois que a sala foi resolvida pode carregar a `revision` autoritativa observada/resultante do processamento: nova revision para uma mutação aceita e revision inalterada para rejeição/erro/aceite sem mutação. Essa revision é informativa/correlacional e não afirma que a `ClientReplica` já aplicou o estado correspondente. `CommandResult` sozinho não altera public/private state, não atualiza `lastAppliedRevision` e não substitui `Event` ou `Snapshot` como mecanismo de sincronização. Se a falha ocorrer antes de uma sala válida poder ser resolvida, como `room not found` ou envelope incompatível não associável a uma sala, `revision` pode estar ausente. Um `JOIN_ROOM` aceito estabelece e devolve o `playerId` do novo membership e é seguido por estado autorizado suficiente para inicializar a `ClientReplica`, normalmente um `Snapshot`.

A ordem de chegada entre `CommandResult` e `Event` não é contratual. Exemplo: cliente com `lastAppliedRevision = 10` envia `C1`; a autoridade aceita a transição e avança para 11; `CommandResult(C1, accepted, revision=11)` pode chegar antes de `Event(revision=11, ...)`. Nesse instante o cliente sabe que `C1` foi aceito, mas sua réplica continua aplicada em 10. Quando o Event 11 chegar, ele deve ser aplicado normalmente e somente então `lastAppliedRevision` passa para 11. Da mesma forma, receber `CommandResult(... revision=12)` enquanto a réplica está aplicada em 10 não aplica estado nem, isoladamente, caracteriza gap na réplica; Events/Snapshots continuam sendo os mecanismos de reconciliação.

O catálogo concreto de códigos fica limitado ao necessário. Categorias conceituais esperadas incluem invalid payload, unauthorized, not member, invalid phase, stale/incompatible protocol, command conflict, room not found/closed e internal authority failure. Erros esperados de regra não derrubam o transporte.

### Event

`Event` representa consequência autoritativa incremental observável de uma transição aceita. Cada Event carrega `roomId`, `protocolVersion` e a `revision` a que corresponde, além do payload projetado/autorizado para seus destinatários.

Uma única transição autoritativa pode alterar vários campos atomicamente e produzir projeções diferentes por destinatário, todas sob a mesma `revision`. Como `revision` é global por sala, cada membro conectado que esteja acompanhando o fluxo recebe um Event autorizado para cada revision nova. Se a projeção daquele cliente não mudou, o Event pode ser apenas um marker/no-op de avanço de revision, sem delta de domínio privado.

Esse marker evita gap artificial, mas torna observável que alguma transição autoritativa ocorreu e permite inferir aproximadamente quando ocorreu. Na V1, `revision`, existência do avanço e timing aproximado não podem carregar semântica que o `GameAdapter` considere secreta. O marker não identifica jogador, tipo de ação privada, payload, motivo da mutação nem qualquer dado além do mínimo necessário para sequenciamento. Conteúdo privado permanece proibido. Isso não transforma a V1 em event sourcing completo.

### Snapshot

`Snapshot` representa a projeção completa autorizada para um cliente e carrega, no mínimo:

- `protocolVersion`;
- `roomId`;
- `revision`;
- public state;
- private state apenas do destinatário, quando houver;
- estado mínimo necessário para retomar sincronização.

### ResyncRequest

`ResyncRequest` é o pedido explícito de estado autoritativo após gap, reconnect, inconsistência local ou retomada do background quando necessário. Deve identificar a sala, o membership quando aplicável e a última revision conhecida pelo cliente. A resposta suficiente na V1 é um `Snapshot` autoritativo.

### protocolVersion

A primeira linha de protocolo é conceitualmente V1 (`protocolVersion = 1`). Versão incompatível deve falhar explicitamente; não há adaptação silenciosa nem negociação avançada de múltiplas versões nesta fundação inicial. `protocolVersion` é distinto de versão do app e de schema de sessão/jogo.

## 10. Revision e reconciliação

A `revision` é monotônica por sala e começa em `0`. A revision `0` representa o estado sincronizado inicial da sala antes da primeira transição autoritativa aceita; esse ponto de partida torna explícita a diferença entre criação/inicialização e primeira mutação observável.

Somente o `AuthoritativeRoomRuntime` altera revision. Cada transição autoritativa aceita que mude o estado sincronizado avança exatamente `+1`. Comando rejeitado, erro sem transição e retry deduplicado não avançam revision.

Uma transição pode alterar vários campos atomicamente e gerar diferentes projeções por destinatário, mas todos os Events derivados daquela mesma transição carregam a mesma revision. Não há múltiplas revisões intermediárias nem requisito de event sourcing completo na V1.

A revision autoritativa mencionada em `CommandResult` não é a revision aplicada da `ClientReplica`. Para ordering e detecção de gap, a referência do cliente é exclusivamente a última revision aplicada por `Event` ou `Snapshot` aceito. Portanto, `CommandResult(revision=N+1)` pode chegar antes do `Event(revision=N+1)` sem consumir, pular ou marcar como aplicada essa revision.

Para Events incrementais, um cliente cuja última revision efetivamente aplicada é `N` trata mensagens assim:

- `revision = N`: duplicata/estado já conhecido; não reaplica efeito;
- `revision = N + 1`: atualização incremental válida;
- `revision > N + 1`: gap; interrompe aplicação incremental e solicita resync;
- `revision < N`: mensagem antiga; ignora.

`Snapshot` carrega a revision canônica da projeção enviada. Em resync/reconnect, a `ClientReplica` substitui sua cópia pela projeção do Snapshot aceito e somente então passa a considerar aquela revision como `lastAppliedRevision` para Events seguintes. Snapshot mais antigo que o estado local confirmado não substitui a réplica. `CommandResult` nunca executa essa atualização.

Reconciliação não significa reproduzir ações otimistas do Zustand como verdade. Otimismo de UI, se existir, é efêmero e descartável diante do estado autoritativo.

## 11. Idempotência

Retries são esperados em rede móvel e em reconexões. Todo Command sujeito a retry carrega `commandId` estável, reutilizado enquanto representar a mesma intenção lógica.

A deduplicação lógica é por `(roomId, commandId)`. O runtime registra informação suficiente sobre o primeiro processamento para comparar autoria/intenção e recuperar o resultado lógico anterior.

- Mesmo `commandId` + mesma intenção/autoria: não executa novamente e retorna o `CommandResult` lógico já conhecido quando possível.
- Mesmo `commandId` + tipo, payload ou autoria incompatível: rejeita como `command conflict`/protocolo inválido; não reaproveita o identificador para uma intenção diferente.
- Retry deduplicado nunca incrementa `revision` novamente.
- Reconnect não muda o significado de `commandId`; a deduplicação continua válida porque não depende de `connectionId`.

Idempotência não substitui validação de fase, membership ou autorização. A retenção física, TTL, armazenamento e mecanismo concreto da tabela/cache de deduplicação permanecem decisões de infraestrutura.

## 12. Membership, presence, reconnect e resync

**Membership** representa quem pertence à sala, qual `playerId` possui, qual papel de sala possui e quais Commands está autorizado a enviar. É estado lógico da sala e pode sobreviver a perda de conexão.

**Presence** representa conectividade transitória associada a uma `connectionId`, como conectado/desconectado. Presence não cria membership e disconnect não remove membership automaticamente.

Comportamento conceitual mínimo:

- **JOIN_ROOM:** solicita criação/admissão de membership; a autoridade valida entrada, estabelece o `playerId` correspondente, devolve esse identificador no resultado aceito e fornece estado autorizado para inicializar a `ClientReplica`. O mecanismo concreto de autenticação/admissão fica aberto.
- **LEAVE_ROOM explícito:** pede remoção voluntária do membership; se aceita, a mudança é autoritativa e pode afetar barriers/regras conforme política da sala/jogo.
- **Disconnect involuntário:** encerra a presença daquela `connectionId`, mas preserva membership até política explícita decidir o contrário.
- **Reconnect:** cria nova `connectionId`, reassocia-a de forma autorizada ao `playerId` existente e não cria novo membership.

Fluxo mínimo de reconnect/resync na V1:

1. conexão cai;
2. membership permanece;
3. cliente reconecta e é autorizado a reassociar a nova conexão ao mesmo `playerId`;
4. cliente informa sua última revision conhecida ou envia `ResyncRequest`;
5. autoridade responde com `Snapshot` autoritativo da projeção permitida;
6. `ClientReplica` substitui sua cópia local e adota a revision do Snapshot;
7. fluxo incremental recomeça a partir da revision canônica.

A V1 não exige retenção permanente de Events perdidos: Snapshot é suficiente para recuperar consistência. Timeout final de abandono e efeitos específicos de participante desconectado permanecem políticas de sala/jogo.

## 13. Clock e timers

Tempo que afeta regra pertence à autoridade. O cliente nunca decide expiração de turno, janela de resposta ou timeout de barrier apenas com `Date.now()` ou timer local.

O `AuthoritativeRoomRuntime` decide deadlines e pode publicar referências como `startsAt`, `endsAt` ou equivalente em estado/Event/Snapshot. O cliente usa o relógio local somente para renderização aproximada e recalcula a apresentação a partir do estado autoritativo após reconnect, retorno do background ou nova referência temporal.

Para fases sincronizadas, o modelo conceitual preferido é preparar o estado e publicar um timestamp futuro de início; clientes renderizam com base nessa referência, enquanto somente a autoridade decide quando a regra efetivamente expirou/avançou.

O runtime deve aceitar clock injetável em testes. Algoritmo avançado de NTP/clock sync não é requisito desta fase.

## 14. Barrier/checkpoint

Barrier/checkpoint representa um ponto reutilizável em que a autoridade espera uma condição coletiva antes de avançar.

Cada barrier possui conceitualmente:

- identificador/tipo;
- conjunto de membros esperados;
- conjunto de membros concluídos/satisfeitos;
- estado de conclusão.

Somente o `AuthoritativeRoomRuntime` considera um barrier concluído e executa a transição decorrente. Presence não adiciona nem remove automaticamente membros do conjunto esperado.

Timeout, abandono, remoção de membership e eventuais overrides continuam políticas específicas da sala/jogo, mas qualquer efeito sobre o barrier deve ocorrer por transição autoritativa explícita. Não será criado um framework de workflow mais complexo na V1.

## 15. Public state vs Private player state

O contrato de projeção é:

```text
CanonicalState
      |
      +--> PublicProjection
      |
      +--> PrivateProjection(playerId)
```

Cada cliente recebe somente `PublicProjection + PrivateProjection(do próprio playerId)`. Nunca recebe `CanonicalState` completo nem private payload de outro jogador.

Essa garantia protege conteúdo, não invisibilidade absoluta de metadados de sequência. Com revision global, markers/no-op Events podem revelar que alguma transição autoritativa ocorreu e seu timing aproximado, sem revelar conteúdo privado. O `GameAdapter` não pode depender de “ninguém saber que ocorreu qualquer alteração” para uma ação privada enquanto usar diretamente esse modelo global.

Ausência visual na UI não é proteção: informação proibida não deve atravessar o `RoomTransport`. No online, o ambiente de backend deve entregar somente a projeção autorizada; na LAN, o aparelho host materialmente possui estado canônico, mas cada conexão recebe apenas a projeção correspondente ao seu membership.

Em jogos como Impostor da Palavra, isso exige adaptar o modelo atual: a autoridade produz briefings privados individualizados e uma projeção pública sem segredos. Testes devem provar ausência de canonical state e private payload alheio no protocolo, não apenas na renderização. Eles não devem assumir, na V1, que a mera existência/timing de toda transição privada é indistinguível para outros membros.
## 16. Online authority

No modo online, o backend hospeda e executa o `AuthoritativeRoomRuntime`, que exerce a autoridade lógica da sala. Clientes autenticados/autorizados enviam Commands através de uma implementação de `RoomTransport`; o runtime valida membership, fase, payload e regra do jogo antes de alterar o estado. O runtime não deve conhecer o fornecedor de backend nem detalhes do transporte.

A tecnologia de backend não é decidida nesta fase. Supabase não foi instalado nem escolhido como compromisso arquitetural.

Persistência de sala, retenção, recovery após restart do backend, escalabilidade e estratégia de distribuição entre processos são decisões posteriores. O contrato de domínio deve evitar dependência direta do fornecedor escolhido.

## 17. LAN authority

No modo LAN, o aparelho host hospeda e executa o mesmo `AuthoritativeRoomRuntime` usado conceitualmente no modo online. Esse runtime mantém o estado canônico, valida Commands, incrementa revision e projeta estado para cada cliente. O mecanismo LAN escolhido é apenas transporte e descoberta; não deve alterar a semântica lógica do runtime.

O transporte LAN permanece em aberto. Esta fase não escolhe WebSocket, TCP, Bonjour, hotspot ou qualquer plugin nativo. A escolha futura deve considerar Android/iOS reais, descoberta, permissões, foreground/background, segurança e estabilidade de conexão.

O `GameAdapter` e as regras do runtime não devem saber se a autoridade está no backend ou no host local. Acima do `RoomTransport`, online e LAN compartilham o mesmo `AuthoritativeRoomRuntime`, o mesmo modelo de envelopes, a mesma semântica de `revision`, a mesma idempotência, o mesmo `GameAdapter` e a mesma regra de public/private projection. Mudam apenas ambiente de hospedagem, implementação de transporte, mecanismos concretos de autenticação/conexão e persistência/recovery da infraestrutura.

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
- Não enviar `CanonicalState` completo nem private payload de outros jogadores.
- Markers/no-op Events de revision global nunca carregam jogador, tipo de ação privada, payload ou motivo da mutação além do mínimo necessário para sequenciamento.
- Tratar existência/timing aproximado de avanços de revision como metadado potencialmente observável na V1; o `GameAdapter` não pode classificar esse metadado como secreto sob este modelo.
- Limitar tamanhos de payload, frequências e recursos por sala.
- Tratar reconnect e replay sem reexecutar efeitos.
- Evitar colocar segredos duráveis ou private state diretamente em QR de convite.
- Definir proteção de transporte e threat model tanto para online quanto LAN antes de produção.

O QR atual da Adedonha é apenas base64 de JSON e não oferece autenticação ou integridade. Ele pode inspirar o fluxo de compartilhamento visual, mas não deve ser promovido a credencial confiável sem um novo desenho.

## 20. Compatibilidade offline

O modo offline continua independente de backend e deve manter os fluxos atuais.

A introdução do multiplayer deve ser uma capacidade paralela: o modo offline pode continuar usando os stores/sessões atuais e `LocalPreferences`, enquanto o modo multiplayer usa `GameAdapter` + `ClientReplica` + `RoomTransport` sob o `AuthoritativeRoomRuntime`.

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
- **Protocol versioning:** garantir rejeição explícita de `protocolVersion` incompatível, sem adaptação silenciosa.

Random e clock devem ser injetáveis nos testes autoritativos para resultados determinísticos.

A Fase 2 deve conseguir exercitar runtime, protocolo lógico, `ClientReplica`, revision, idempotência, membership, barriers, clock e projeções sem rede real e sem jogo real. Fake/in-memory é ferramenta de teste/harness, não tecnologia de produção, e adapters mínimos de teste podem validar o contrato do core sem antecipar Adedonha.

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
- Jogos com segredos exigem projeções por jogador; replicar o estado canônico inteiro ou private payload alheio vazaria informação.
- A revision global com markers/no-op evita gaps de projeção, mas expõe metadados de sequência: membros conectados podem observar que alguma transição autoritativa ocorreu e aproximadamente quando. Isso é um limite assumido da V1, não uma garantia de invisibilidade de ações privadas.
- Online e LAN podem divergir se não compartilharem a mesma semântica de runtime e uma suíte comum de contrato.
- LAN em Android/iOS envolve descoberta, permissões, suspensão em background e mudanças de rede ainda não validadas.
- QR atual não autentica conteúdo e não deve ser usado como prova de identidade ou autorização.
- Falha do host LAN V1 interrompe a autoridade; a UX e a política de recuperação ainda precisam ser definidas.
- A V1 fecha rejeição explícita de `protocolVersion` incompatível, mas compatibilidade/migração entre futuras versões do app e do protocolo ainda exigirá política de evolução.
- Manter simultaneamente caminhos offline e multiplayer pode gerar drift de regras se adapters duplicarem lógica em vez de delegar ao domínio compartilhado.
## 23. Decisões fechadas

Consideram-se fechadas para orientar a implementação futura:

- Offline permanece funcional sem backend; multiplayer é modular e adicional.
- A nomenclatura conceitual é `AuthoritativeRoomRuntime`, `GameAdapter`, `RoomTransport` e `ClientReplica`.
- Zustand e telas não fazem parte do protocolo; cliente envia intenção e autoridade valida/executa.
- Há exatamente uma autoridade lógica por sala, exercida pelo `AuthoritativeRoomRuntime`.
- O backend hospeda/executa o runtime no online; o aparelho host hospeda/executa o mesmo modelo lógico de runtime na LAN.
- `roomId` identifica sala; `playerId` identifica membership persistente a reconnect; `connectionId` identifica conexão efêmera; `commandId` identifica intenção estável.
- O protocolo lógico possui `Command`, `CommandResult`, `Event`, `Snapshot` e `ResyncRequest`.
- `CommandResult` diferencia accepted, rejected, recoverable_error e incompatible_protocol e correlaciona com `commandId`; sua `revision` é informativa e nunca atualiza `lastAppliedRevision`.
- Somente `Event` incremental efetivamente aplicado ou `Snapshot` aceito atualiza a revision aplicada da `ClientReplica`; a ordem de chegada de `CommandResult` e `Event` não altera essa regra.
- `protocolVersion` inicial é conceitualmente `1`; incompatibilidade falha explicitamente, sem adaptação silenciosa.
- `revision` é por sala, começa em `0` e cada transição autoritativa aceita que altere estado sincronizado avança exatamente `+1`.
- Comando rejeitado, erro sem transição e retry deduplicado não avançam `revision`; gaps exigem Snapshot/resync.
- Deduplicação lógica usa `(roomId, commandId)`; mesma intenção não reexecuta e reutilização conflitante é rejeitada.
- Membership e presence são conceitos separados; disconnect não remove membership automaticamente e reconnect reassocia nova conexão ao mesmo `playerId`.
- Snapshot é suficiente para recuperação de consistência na V1; não há obrigação de reter Events perdidos indefinidamente.
- Tempo de regra vem da autoridade; clientes apenas renderizam referências como `startsAt`/`endsAt`; clock do runtime é injetável em testes.
- Barrier possui identificador/tipo, conjunto esperado, conjunto concluído e estado de conclusão; somente a autoridade conclui barrier.
- Estado público e privado são projeções distintas; cada cliente recebe public state + private state do próprio `playerId`, nunca canonical state completo ou private payload alheio.
- A V1 não garante ocultação da existência/timing de toda transição privada: revision global e markers/no-op podem ser observáveis, mas não carregam identidade, tipo de ação, payload ou motivo privado.
- `RoomTransport` é somente comunicação; não valida regra, não altera canonical state e não decide revision.
- `GameAdapter` contém somente semântica específica do jogo e deve ser testável sem UI/transporte; o core não conhece Adedonha ou qualquer outro jogo concreto.
- Online e LAN compartilham runtime, envelopes, revision, idempotência, GameAdapter e regra de projeção; mudam ambiente de hospedagem e transporte.
- LAN V1 não terá host migration automática.
- Bluetooth não faz parte do escopo.
- WebRTC não faz parte do escopo salvo necessidade técnica posterior comprovada.
- Adedonha é o primeiro consumidor real, somente após o core e o fluxo online; Impostor da Palavra permanece validador posterior.
- Nenhum fornecedor de backend ou tecnologia concreta de transporte foi selecionado nesta fase.

## 24. Decisões abertas

Continuam abertas apenas decisões que não precisam ser resolvidas para implementar o core independente de infraestrutura:

- formato concreto/serialização dos envelopes e assinaturas TypeScript;
- geração concreta de `roomId`, `playerId`, `connectionId` e `commandId`, respeitando os escopos conceituais fechados;
- detalhes completos do lifecycle da sala além de JOIN/LEAVE/reconnect: criação, encerramento, expiração e papéis de host/moderador;
- mecanismo concreto de autenticação/autorização para entrada e reassociação de membership;
- formato final de token/convite e credenciais de sala;
- retenção física/TTL e armazenamento da deduplicação por `commandId`;
- retenção de event log, caso a infraestrutura futura mantenha um; event log não é requisito do core V1;
- persistência/recovery da autoridade online após restart/process failure;
- tecnologia/provedor do backend online, incluindo decisão futura entre Supabase ou outra solução;
- uso ou não de Realtime, tabelas, Edge Functions, RPC ou mecanismos equivalentes;
- implementação concreta do transporte online;
- descoberta e transporte LAN compatíveis com Android/iOS, incluindo decisão futura sobre WebSocket/TCP, Bonjour, Local Only Hotspot ou alternativas;
- necessidade ou não de plugin nativo Kotlin/Swift para LAN;
- política de background/foreground e timeouts de rede específicos de cada transporte;
- política definitiva de falha do host LAN além da decisão de não haver migração automática na V1;
- limites concretos de payload, rate limiting e capacidade por sala;
- políticas de timeout, abandono, remoção e override que alterem barriers em cada sala/jogo;
- política de observabilidade, logs e correlação operacional;
- política de evolução/migração entre futuras versões do protocolo/app além da rejeição explícita da V1;
- algoritmo exato de clock sync, caso venha a ser necessário além das referências autoritativas de tempo;
- proteção concreta de transporte, TLS LAN e threat model de produção;
- reavaliação do modelo de projeção/sequenciamento se um jogo futuro precisar ocultar também a existência ou timing de uma ação privada; alternativas possíveis, sem decisão nesta fase, incluem revision/sequência por destinatário, batching ou outro mecanismo que desacople canonical revision da sequência observável pelo cliente;
- decisão funcional sobre a fila de impostores antes do `GameAdapter` multiplayer do Impostor.
## 25. Roadmap técnico resumido por fases

### Fase 1.1 — Auditoria e arquitetura inicial

Concluída, revisada e aprovada. Registrou baseline, arquitetura existente, invariantes, riscos e arquitetura-alvo sem implementar core multiplayer.

### Fase 1.2 — Fechamento dos contratos da fundação

Estado atual. Fecha nomenclatura e contratos mínimos de runtime, identidade, envelopes, revision, idempotência, membership/presence, reconnect/resync, barriers/checkpoints, clock, projeções, transporte lógico, versionamento e erros. A implementação da fundação permanece proibida até aprovação desta fase.

### Fase 2 — Multiplayer core independente de transporte real

Implementar o core conforme os contratos aprovados: `AuthoritativeRoomRuntime`, protocolo conceitual, revision/resync, idempotência, membership, barriers/checkpoints, authoritative clock, public/private projection e `ClientReplica`. O core pode usar fake/in-memory e adapters mínimos de teste, mas não depende da Adedonha nem de qualquer jogo real para provar suas invariantes.

### Fase 3 — Harness e integração multi-cliente em memória

Validar o core com múltiplos clientes simulados contra uma autoridade em memória, incluindo ordem de eventos, duplicatas, gaps, snapshots, reconnect, projeções e falhas controladas. Esta etapa permanece anterior ao primeiro jogo real e ao primeiro transporte real.

### Fase 4 — Transporte e autoridade online

Escolher somente nesta etapa a infraestrutura online. Hospedar o mesmo `AuthoritativeRoomRuntime` no backend e integrar uma implementação online de `RoomTransport`, preservando os contratos do core e a compatibilidade offline.

### Fase 5 — Adedonha multiplayer online

Criar a Adedonha como primeiro consumidor real da fundação, por meio de seu `GameAdapter`, usando o core e o transporte online já validados.

### Fase 6 — Validação arquitetural e hardening do fluxo online

Validar o primeiro fluxo real ponta a ponta e endurecer compatibilidade de protocolo, segurança, limites, observabilidade, recovery, reconnect e regressões offline antes de iniciar LAN.

### Fase 7 — Spike técnico LAN

Investigar em aparelhos e plataformas alvo descoberta, conectividade local, permissões, foreground/background, segurança e perda do host. Esta etapa serve para decidir as necessidades nativas e a tecnologia de transporte LAN; não implementa LAN junto com o online.

### Fase 8 — Transporte LAN

Implementar o transporte LAN escolhido utilizando o mesmo contrato lógico do core. O aparelho host hospeda o mesmo `AuthoritativeRoomRuntime`; diferenças de rede não devem alterar semântica de revision, idempotência, membership, barriers, clock ou projeções.

### Fase 9 — Adedonha LAN

Executar Adedonha em LAN reutilizando o mesmo `GameAdapter` e o mesmo core sempre que aplicável, trocando apenas o ambiente de hospedagem da autoridade e a implementação de `RoomTransport`.

### Fase 10 — Validação em dispositivos Android/iOS reais

Validar Adedonha online e LAN em dispositivos Android e iOS reais, incluindo descoberta, reconnect, background/foreground, mudanças de rede, perda do host e compatibilidade entre clientes.

### Fase 11 — Impostor da Palavra

Antes de criar o adapter multiplayer do Impostor, resolver a divergência funcional já registrada sobre a seleção do impostor. Depois, usar a mesma fundação já validada por Adedonha online e LAN para testar private state e informação secreta por jogador.

### Fase 12 — Hardening de private state, barriers e reconnect

Validar e endurecer private state, barriers/checkpoints, reconnect, resync e falhas tanto online quanto LAN, além de testes de segurança e regressão da fundação compartilhada.
## 26. Critério de aceite para iniciar implementação do multiplayer core

Os contratos conceituais mínimos necessários à Fase 2 estão fechados neste documento: naming, identidade, envelopes, `CommandResult`, revision, idempotência, membership/presence, reconnect/resync, public/private projection, authoritative clock, barriers, `RoomTransport`, `GameAdapter`, `protocolVersion` e categorias mínimas de erro.

A Fase 2 pode começar somente depois que o gestor revisar e aprovar esta Fase 1.2. Essa aprovação deve confirmar que:

- `AuthoritativeRoomRuntime`, `GameAdapter`, `RoomTransport` e `ClientReplica` são as fronteiras conceituais aceitas;
- a semântica documentada de `Command`, `CommandResult`, `Event`, `Snapshot` e `ResyncRequest` é suficiente para iniciar o core;
- revision `0`, avanço `+1`, tratamento de gaps e Snapshot/resync estão aceitos;
- deduplicação por `(roomId, commandId)` e conflito por reutilização incompatível estão aceitos;
- membership/presence/reconnect e o papel de `connectionId` estão aceitos;
- authoritative clock, barriers e public/private projection estão aceitos;
- o core permanecerá independente de fornecedor, transporte real e jogo real;
- fake/in-memory e adapters mínimos de teste serão suficientes para provar o core antes da Adedonha;
- modo offline permanece sem dependência de backend;
- a divergência do Impostor continua bloqueando apenas o futuro `GameAdapter` desse jogo.

As decisões da seção 24 não bloqueiam o início do core porque tratam de infraestrutura concreta, evolução futura, políticas específicas de sala/jogo ou detalhes de produção. Até a aprovação desta Fase 1.2, este documento permanece referência para revisão e não autoriza implementação.
