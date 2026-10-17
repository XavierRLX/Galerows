# Cidade Dorme — Expansão de papéis, cartas e narração (16/10/2026)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and test-driven-development. Steps use checkboxes for verification.

**Goal:** Expandir o MVP fechado sem alterar a Room persistente, o transporte WebSocket ou o baseline funcional.

**Architecture:** As regras e presets continuam no módulo cidade-dorme; o adapter autoritativo LAN processa os novos turnos e projeta resultados por participante; a UI imersiva consome exclusivamente a projeção privada. Áudios e imagens são recursos estáticos embarcados. Manter campos legados para compatibilidade.

**Tech Stack:** React, TypeScript, Vitest, Vite, Capacitor, LAN offline-first.

**Spec:** Especificação fornecida em 16/10/2026 (anexo desta tarefa); retificação prevalecente: **7–10 jogadores = 1 assassino + 1 traidor, 11–12 = 1 assassino + 2 traidores**.

## Restrições globais
- Baseline: `3becef4` na `feat/cidade-dorme-auto-orchestration-01`; branch atual `feat/cidade-dorme-expanded-roles-01`.
- Não tocar em `main`, worktrees preexistentes, Room persistente ou transporte LAN; sem merge, push ou deploy.
- Reutilizar assets 8 personagens e dois áudios Lucas existentes; não gerar mídia paga.
- Médico e Detetive obrigatórios para novas composições, com leitura de sessões legadas sem perda de compatibilidade.
- Sem teste físico; diferenciar validação automatizada de homologação real.

## Task 1 — Presets e tipos
**Files:** `src/features/cidade-dorme/{cidadeDorme.types.ts,cidadeDorme.setup.ts,cidadeDorme.roles.ts,cidadeDorme.rules.ts}`, testes `cidadeDorme.setup.test.ts` e teste novo da expansão.
- [ ] Criar testes RED dos 9 presets, fronteira de 7, Coringa 0–2, 1 cidadão obrigatório, configuração legado.
- [ ] Executar Vitest e registrar falhas esperadas.
- [ ] Implementar e executar testes GREEN; executar testes existentes.

## Task 2 — Adapter autoritativo LAN e privacidade
**Files:** `src/features/multiplayer/cidadeDormeLanGame.ts`, testes LAN.
- [ ] Criar testes RED: Vigia, matriz, Traidor ativo, decoy morto, projeção privada, dois tipos de condução.
- [ ] Introduzir fases `watchman-turn` e `watchman-result`, comando `WATCH` e confirmação de resultado privado.
- [ ] Preservar transitions e revisar idempotência, reset, histórico e replay.

## Task 3 — Cartas e configurações de jogo
**Files:** `CidadeDormeImmersiveRound.tsx`, `cidadeDormeImmersive.css`, `LobbyRoomView.tsx` e testes React.
- [ ] Testar fluxo retirada/virada/ACK, reconexão e ocultação.
- [ ] Vincular carta ao papel atribuído pelo servidor, recursos WebP e detalhes de aliados exclusivos.
- [ ] Expor Vigia, Sonâmbulo e Coringas customizáveis, preservando mínimo de 1 cidadão.

## Task 4 — Narração
**Files:** `cidadeLucasNarration.ts`, `cidadeNarration.ts`, `cidadeAutopilot.ts`, assets e testes.
- [ ] Testar mapeamento e ordem da noite com vigia habilitado e decoy.
- [ ] Validar e copiar `vigia_acorde.mp3` e `vigia_confira.mp3` como 16/17 sem tocar nos primeiros 15.
- [ ] Validar exclusividade do narrador e fluidez do replay.

## Task 5 — Gate, registro, commits
- [ ] Rodar Vitest completo, TypeScript, ESLint, build e testes Android se existentes.
- [ ] Revisar `git diff --check`, status, alterações fora do escopo.
- [ ] Relatar cobertura, pendências, assets, commits e validação física pendente.
