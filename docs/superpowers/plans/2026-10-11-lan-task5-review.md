# Galerows — revisão do gate da Task 5 (11/10/2026)

**Resultado:** Task 5 aceita como prova técnica de retomada autenticada Android ↔ Android. **Task 6 ainda não autorizada**; corrigir primeiro a transição de confirmação do ingresso inicial (correção curta de segurança/consistência, com TDD).

## Evidências revisadas

- Fonte: `docs/lan-task5-resume-evidence.md` e implementação real em `src/features/multiplayer/lan/` e `android/app/src/main/java/com/galerows/app/`.
- Branch verificada: `feat/multiplayer-lan-task1-wss`; HEAD `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`; alterações das Tasks 1–5 e arquivos untracked preservados.
- `git diff --check` sem erro. Testes relatados (não repetidos nesta revisão): 376 Vitest, 22 JVM, typecheck, lint, builds Release e secureProbe, ensaio físico S23/S25 FE no hotspot sem WAN.
- Fluxo de retomada com token individual rotativo, `resumeAck`, verificação nativa de `resumeHello` e cofre Android com AES-GCM/Android Keystore.

## Ressalva a resolver antes da Task 6

No ingresso inicial, `LanRoomHost.finish(..., true)` publica binding/membership após a escrita do frame `admitted`, enquanto `LanRoomSession.connectInvite()` **só depois** persiste a credencial com `native.storeResumeCredential`. Se o armazenamento falhar ou a resposta se perder, pode restar membership desconectado que o cliente não consegue retomar. O protocolo atual tem ACK de **retomada** (`resumeAck`), mas não confirmação equivalente de **armazenamento/admissão inicial**.

**Micro-gate recomendado (Codex + TDD):** definir e implementar uma confirmação de ingresso durável ou compensação segura (com timeout limitado), antes de tratar a admissão como concluída; separar credencial efetivamente persistida de mera escrita no socket. Cobrir falha/timeout do armazenamento, ACK perdido, desconexão e `stop()` durante confirmação, revisões/deliveries visíveis, reutilização de convite proibida e ausência de membership órfão. Preservar a política de retomada já testada; não mascarar falha convertendo em ingresso novo. Não modificar o runtime compartilhado salvo teste demonstrando necessidade.

## Limite aceito para V1

Encerramento abrupto do processo host sem `roomClosed` pode aparecer inicialmente como `connection_lost`; a UI posterior deve indicar estado indeterminado/tentativa de reconexão com timeout e mensagem clara quando for impossível retomar, sem afirmar falsamente encerramento confirmado nem implementar migração automática.

## Próximos passos

1. Resolver e testar exclusivamente o micro-gate do ingresso inicial; registrar evidências complementares.
2. Revisão curta pelo Remote Desktop Commander sem repetir suites se logs e resultados bastarem.
3. Só então autorizar Task 6: tela mínima de criar/entrar via QR, código de confirmação presencial, conexão/erro/retomada, sem jogo.

**Restrições:** preservar branch e working tree, não criar commit/merge/push, não alterar main, não iniciar Task 6/7, jogos, backend, iOS nem configurações inseguras de rede.
