# CITY-EXPANDED-ROLES-01 — Revisão técnica e gate (17/10/2026)

## Origem e segurança
- Baseline fechado: `3becef4` na branch `feat/cidade-dorme-auto-orchestration-01`.
- Implementação retomada em `feat/cidade-dorme-expanded-roles-01`, worktree `galerows-city-expanded-roles`.
- Nenhum push, merge, deploy ou alteração da `main`.
- A árvore de trabalho já continha mudanças e scripts auxiliares quando foi auditada; alterações preexistentes foram preservadas e revisadas.

## Revisão do comportamento
- Presets corrigidos: 4–6 participantes, 1 Assassino; 7–10, 1 Assassino + 1 Traidor; 11–12, 1 Assassino + 2 Traidores.
- Médico e Detetive obrigatórios nos presets e nas novas configurações LAN; sessões legadas continuam aceitas.
- Vigia observa movimentação canônica; Sonâmbulo vivo circula; Traidores inativos ficam em casa e só o sucessor ativo tem mãos sujas. Um ataque por noite.
- Retirada visual de carta com papel previamente atribuído e confirmação; oito WebP disponíveis, todos 1024×1536; consulta privada e informações da equipe assassina limitadas à projeção de seus integrantes.
- Dois MP3 locais do Vigia: `16_vigia.mp3` (aprox. 9,17s) e `17_resultado_vigia.mp3` (aprox. 7,47s); 15 anteriores mantidos.
- Fases do Vigia e resultado privado incorporados às conduções automática e humana; o Prefeito tem ação para preservar a simulação dos turnos de Vigia eliminado.
- Campo novo `jesterCount` prevalece sobre `enableJester` quando definido; o toggle do modo de um celular mantém ambos sincronizados.
- Coringas independentes, sucessão e vencedores individuais cobertos por testes específicos.

## Evidências automatizadas
- RED observado para divergência de Coringas, obrigatoriedade de novos papéis, turno do Prefeito e toggle de Coringa.
- Ajuste de compatibilidade: a regra obrigatória permanece na validação das novas configurações LAN; o núcleo tolera documentos legados, sem reescrever sessões salvas.
- Suíte Vitest completa: 148 arquivos e 876 testes aprovados, 0 falhas.
- TypeScript, ESLint e Vite build: verificar saída do gate final.
- Android: `./gradlew :app:compileDebugJavaWithJavac --offline --no-daemon` passou (120 tarefas UP-TO-DATE), com `ANDROID_HOME` apontando para SDK já instalado. Não equivale a compilação de APK novo ou teste físico.
- `git diff --check`: verificar saída do gate final.

## Limites conhecidos
- Sem teste em dispositivos físicos LAN, sem homologação UX presencial, sem APK instalado.
- `android/capacitor.settings.gradle` contém modificação gerada apontando a dependências de outro worktree, NÃO incorporada aos commits da funcionalidade.
- Scripts temporários `.city-expanded-*.py` não rastreados, preservados e excluídos dos commits.
- Um total global de testes verdes não substitui uma auditoria de cada requisito do documento de origem.
