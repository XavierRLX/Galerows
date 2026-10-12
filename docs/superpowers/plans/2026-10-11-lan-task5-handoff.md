# Galerows — Handoff enxuto para Task 5 (retomada LAN)

Data: 11/10/2026. **Planejamento/handoff somente; Task 5 nao implementada.**

## Fonte de verdade

- `docs/superpowers/plans/2026-10-11-lan-core-integration.md` — executar **somente Task 5**.
- `docs/lan-task4-guest-session-evidence.md` — evidencias e limites da Task 4.
- `docs/lan-task1-secure-channel-evidence.md`, `docs/lan-task2-invite-admission-evidence.md`, `docs/lan-task3-room-host-evidence.md`.
- `docs/multiplayer-offline-first-requirements.md`.

## Baseline verificado por Remote Desktop Commander

- Repositorio: `/Users/renanxavier/Documents/GitHub/galerows`.
- Branch: `feat/multiplayer-lan-task1-wss`; HEAD `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`.
- Tasks 1–4 possuem alteracoes locais e arquivos untracked. **Preservar integralmente; sem commit, merge, push ou mudanca de main**.
- `git diff --check` sem erros. Testes da Task 4 relatados como 362/362 Vitest, 16 JVM e builds/typecheck/lint aprovados; nao foram reexecutados nesta auditoria.

## Dependencia tecnica critica descoberta na revisao

`android/app/src/main/java/com/galerows/app/LanHelloAuthenticator.java` valida o primeiro `hello` do socket TLS **somente contra o token de convite atual** (`inviteToken`). O token e rotacionado apos admissao. Portanto, um convidado que perdeu o socket nao pode abrir um novo WSS usando o convite antigo, e usar o token do QR novamente nao prova a identidade do membro.

A Task 5 precisa definir/testar **um ingresso nativo de retomada distinto**, ainda sobre WSS pinado, com credencial individual e prova de posse. Separar o acesso preliminar ao socket da autorizacao de reassociar membership: `playerId` autodeclarado nao vale como autenticacao. Avaliar ataques de replay, brute force, concorrencia, token expirado, credencial vazada e consumo/rotacao apos confirmacao. Nao reabilitar `ws://`, mixed content ou cleartext.

## Gates de seguranca e consistencia

1. Credencial individual gerada com fonte criptograficamente segura, aleatoria, vinculada a `roomId` + `playerId` e limitada no tempo; nunca no QR, nos logs ou nas projections; definir armazenamento protegido no Android, sem plaintext persistente.
2. `runtime.reassociate(playerId, newConnectionId)` somente apos autorizacao comprovada pelo host, conservando `playerId` e criando nova `connectionId`; conectar e TLS validado sozinhos nao autorizam comandos.
3. Revogar o peer/socket antigo ao reassociar e rejeitar comandos/resync antigos; impedir duas retomadas simultaneas, duplicacao de membership e replay.
4. Definir protocolo seguro para **perda de resposta na rotacao de credencial**, de modo que o cliente nao fique irreversivelmente bloqueado por falha de transporte. Documentar expiracao/revogacao/rotacao e o comportamento no limite de 24h do certificado TLS.
5. Recuperar `Snapshot` autorizado, `ClientReplica.lastAppliedRevision` e retries com `commandId` estavel sem mutacao duplicada. Respeitar filas limitadas e ordenacao da Task 4.
6. Diferenciar fechamento definitivo/perda do runtime do host versus desconexao transitória; sem migracao automatica de host.
7. Provar isolamento privado entre membros por testes automatizados; testar fisicamente S23 (`RXCX705P3JR`) e S25 FE (`RXGL30N4F3F`) por hotspot sem WAN, se disponiveis; declarar expressamente o que nao foi testado fisicamente.

## Execucao

- Aplicar Superpowers + TDD: testes vermelhos, correcao minima, regressao. Inspecionar o codigo real e revisar o desenho antes de modificar nativo e contrato TS.
- Apenas Task 5. Nao implementar UI da Task 6, gate 7, Impostor, Adedonha, Supabase, backend ou iOS. Nao reescrever o core sem justificativa com teste.
- Rodar testes focados antes de suites completas; evitar repetir compilacoes longas sem mudancas relevantes. Registrar falhas, resultados e limites.
- Documentar resultados em `docs/lan-task5-resume-evidence.md` e **parar antes da Task 6** para aprovacao.
