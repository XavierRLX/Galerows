# Galerows — Multiplayer Phase 3 Validation

## Status

- Fase 1 concluída.
- Fase 2 concluída.
- Fase 3 concluída após aprovação do gestor e passe final de validação.
- Fase 4 ainda NÃO iniciada.
- Baseline de entrada da Fase 3: `0f903af9cc047a004d51e2b60383087964cedf65`.

Este arquivo registra apenas o estado validado ao final da Fase 3. Ele não substitui nem altera a especificação arquitetural principal.

## Objetivo da Fase 3

Validar o multiplayer core contra um harness determinístico, multi-cliente e totalmente in-memory, exercitando as fronteiras entre `RoomTransport`, `AuthoritativeRoomRuntime` e `ClientReplica` sem transporte de produção ou jogo real.

## Implementação

Arquivos da Fase 3:

- `src/features/multiplayer/testing/inMemoryRoomTransport.ts`
- `src/features/multiplayer/testing/inMemoryRoomTransport.test.ts`

O harness utiliza uma única autoridade compartilhada e múltiplos endpoints cliente que implementam o `RoomTransport` existente. A rede fake mantém uma fila determinística com tráfego `client → authority` e `authority → client`, permitindo controle explícito de delivery, drop, duplicate e reorder sem sleeps ou timing real.

## Invariantes validadas

Foram validados ponta a ponta:

- sincronização pública entre múltiplos clientes;
- isolamento de private state em Event;
- isolamento de private state em Snapshot de resync;
- `CommandResult` e `Event` recebidos fora de ordem;
- Event duplicado;
- Command duplicado e retry idempotente;
- perda de `CommandResult` seguida de retry;
- perda de Event;
- detecção de gap de revision;
- resync por `ResyncRequest` e Snapshot;
- disconnect sem remoção do membership;
- reconnect com novo `connectionId` e mesmo `playerId`;
- rejeição da conexão antiga após reassociação;
- recuperação por Snapshot após múltiplas mutations durante período offline;
- ordenação autoritativa de Commands concorrentes conforme a ordem escolhida na fila;
- revision global monotônica;
- `roomEffects`/barriers aplicados atomicamente com o game state;
- marker/no-op para destinatário cuja projeção não mudou;
- ausência de regra de jogo real no harness.

## Estado arquitetural após Fase 3

Permanecem preservadas as responsabilidades separadas de:

- `AuthoritativeRoomRuntime`;
- `GameAdapter`;
- `RoomTransport`;
- `ClientReplica`.

O multiplayer core e o harness da Fase 3 não dependem de React, Zustand, Supabase, WebSocket, LAN, Capacitor ou regra de jogo real.

## O que NÃO foi implementado

A Fase 3 não implementou:

- backend real;
- banco de dados;
- autenticação real;
- transporte online real;
- transporte LAN;
- QR multiplayer;
- integração multiplayer de qualquer jogo real.

## Próxima etapa

Fase 4 — transporte/authority online real.

A escolha e configuração concreta do fornecedor devem ocorrer na Fase 4. Supabase pode ser avaliado ou utilizado nessa etapa, mas não é registrado aqui como decisão arquitetural já fechada.

## Pontos deliberadamente futuros

Permanecem para fases futuras:

- persistência e recovery;
- autenticação e autorização concretas;
- política/TTL de idempotência;
- serialização real dos envelopes;
- fornecedor online;
- transporte e discovery LAN;
- comportamento diante de falha do host;
- integração de jogos reais;
- resolução da regra divergente do Impostor.
