# Galerows — Execução paralela: Minha Galera e entradas de jogo (17/10/2026)

## Baselines

- Expansão Cidade Dorme: `236b300` em `feat/cidade-dorme-expanded-roles-01`.
- Home Astra foi salva em `6448377`, na `feat/ux-hub-header-brand`; commit equivalente cherry-picked na branch de integração: `cb5d336`.
- Worktree da integração: `/Users/renanxavier/Documents/GitHub/galerows-mode-unification`; branch `feat/game-modes-ux-integration-01`.
- Preservar alterações locais/untracked do worktree original `galerows`; não copiar seu conteúdo solto nem fazer `git add .`.

## Entrega A — Remote Desktop Commander

1. TDD atalho único home: teste para “Minha Galera”; remover Ranking somente da home.
2. TDD “Minha Galera”: entrada “1 celular” (jogadores salvos, edição e catálogo) e entrada “Multiplayer local” (criar/entrar/retomar). Ingresso não depende de jogadores cadastrados.
3. TDD preservar contexto de jogo na criação: rota `/__lan-lobby-v2/criar?game=cidade-dorme|impostor-da-palavra|pista-unica`, seleção apenas após Room nova e somente para IDs permitidos.
4. Verificar os testes direcionados, suíte completa, lint, typecheck, build, diff; commit local `feat(modes): clarify My Group and preserve game room intent`.

## Entrega B — Codex

1. Em um worktree/branch separado, criar componente de seleção de modo reutilizável nos três jogos, aproveitando identidade visual e microcopy.
2. Modo local chama `/games/<id>/setup` ou continuação local conforme cada store atual; não alterar sessões/saves existentes.
3. Modo LAN: botões `Criar sala` -> `/__lan-lobby-v2/criar?game=<id>`, `Entrar em sala` -> `/__lan-lobby-v2/entrar`; Room ativa apresenta `Voltar à sala` e não é substituída.
4. Testes garantem os três jogos (incluindo habilitação experimental Android e mensagem para web/iOS) e coerência com configuração local.
5. Commit(s) locais na branch Codex, sem merge/push/deploy.

## Revisão e integração

- Após Codex concluir, revisar commits do worktree Codex antes de cherry-pick na branch de integração.
- Reexecutar TDD/regressões, typecheck, lint, build LAN e padrão, `git diff --check` na integração.
- Conferir layout em 320/375/430px e conceitos “um aparelho para o grupo” vs “um por pessoa”.
- Gate físico da Room continua HOLD até dispositivos reais suficientes e autorização explícita; não instalar APK nesta tarefa.
