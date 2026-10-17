# Galerows — MVP app completion (2026-10-17)

## Origem e isolamento

- Branch de trabalho: `feat/mvp-app-completion-01`
- Worktree: `/Users/renanxavier/Documents/GitHub/galerows-mvp-app-completion`
- Baseline integrado: `d8d81599de458dbfee1d8ac5bdd5a0b2420dedfb`
- Nove worktrees preexistentes examinados sem alterações pendentes; preservados.
- `feat/ux-hub-header-brand` diverge antes da integração e altera/removeria fluxos, narração e testes; não é baseline substituto.
- Superpowers SKILL.md não encontrado entre skills expostas nem na instalação .codex do Mac; seguir disciplina de plano, RED→GREEN, revisão e evidências sem afirmar uso de skill indisponível.

## Contratos

- Preservar identidade visual, conteúdo e regras dos jogos.
- Não alterar credenciais, `applicationId`, `versionCode`/`versionName`, dados dos usuários nem protocolo WSS.
- Sem dependência de backend, analytics, anúncios ou login.
- Não dar `push`, `merge`, `deploy` nem publicar política automaticamente.
- Testes físicos diferenciados de simulação e marcados pendentes quando indisponíveis.

## Entregas e critérios de aceite

1. **Sobre e suporte**: Settings mostra app, plataforma, modalidade offline/LAN, versão e build reais pelo `@capacitor/app`; e-mail pré-preenchido minimamente com versão/build/plataforma, sem segredos; privacidade e avaliação existentes reutilizadas; TDD, i18n pt/en/es, commit.
2. **Erro global**: boundary não captura erros de transporte via render; fallback visual com retry e home seguros, sem reset de dados nem criação de sala; estados assíncronos/LAN com orientação contextual; teste de throw/retry.
3. **Privacidade**: política e strings de aviso esclarecem armazenamento local, transmissão P2P LAN, câmera e limpeza; versionamento de aviso; documentação de Play Data Safety revisada; sem publicação externa.
4. **Primeiro uso**: orientação dispensável dos três modos, persistida, consultável em Settings, acessível, sem duplicar modal privacy; saída imediata sem bloquear.
5. **Ajuda LAN**: central e pontos contextuais com criar/entrar, descoberta, QR, seis dígitos, mesma rede, hotspot, reconexão e saída segura; sem novo transporte.
6. **Tela ativa**: controlador único Android, somente em rotas de partida ativa, limpa em desmontagem e background, restaura adequadamente; teste do lifecycle; evitar dependência nativa desnecessária.
7. **Fechamento**: Vitest, typecheck, ESLint, Vite normal/LAN, Gradle Debug/JVM, diff-check, layout mobile 320/375/430, revisão offline e ADB físico se houver; relatório em `docs/superpowers/reviews/`.

## Ciclo por entrega

Inspeção e critérios → teste RED → menor implementação → GREEN → revisão → commit local seletivo → próxima entrega.

## Riscos conhecidos

- LAN habilitado somente no Android nativo com `VITE_GAMES_FIRST_LAN_ENTRY=1` e `VITE_LAN_PERSISTENT_LOBBY_UI=1`; o build padrão não inclui o provedor LAN.
- Política publicada em GitHub Pages corresponde à versão antiga, até autorização de publicação.
- Homologação de dois ou mais celulares exige evidência física real.
