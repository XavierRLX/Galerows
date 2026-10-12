# PL-02B — revisão de encerramento e segurança (12/10/2026)

**Repositório:** Galerows. **Branch obrigatória:** `feat/multiplayer-lan-task1-wss`. **Baseline inicial:** `e6859c1`. Escopo isolado no WSS LAN v2, sem integrar jogos reais, sem ativar probe na distribuição.

## Evidências existentes e aceites

- Protocolo de ingresso v2, resync, reconnect, leave, Room persistente e rekey: `docs/lan-pl02b-admission-v2-evidence.md`, `docs/lan-pl02b-commands-resync-evidence.md`, `docs/lan-pl02b-resume-leave-v2-evidence.md` e `docs/lan-pl02b-rekey-evidence.md`.
- Prova física anterior de dois Android via WSS para `toy A → resultados → lobby → counter B`: `docs/lan-pl02b-physical-v2-evidence.md`. Também há prova física separada do rekey com 10 etapas, rev 17 sincronizada e remoção de guest na rev 18.
- Esta revisão não substitui os ensaios prévios; testes com três participantes foram **simulados**, não em três telefones reais.

## Novas falhas encontradas por TDD e corrigidas

1. **`stop` concorrente com `registerResumeToken` do rekey.** Um callback do registrador nativo pode completar após a sala entrar em fechamento; o host enviava uma nova oferta de token depois de marcar `closed`. Teste RED com registro nativo suspenso e `stop` concorrente; GREEN após revalidar `closed` ao sair da chamada nativa e revogar o novo token em vez de enviá-lo ao convidado.
2. **Admissão pendente com revogação incerta.** Durante compensação de uma admissão, uma falha da revogação fazia `native.stop` e alterava `closed`, mas pulava parte da limpeza de timers, `listener` e `currentInvite`. Teste RED/GREEN verifica fail-closed, destruição final do listener e impossibilidade de atualizar o convite. A compensação agora agenda o fechamento completo sem `await stop()` dentro da fila serializada (evita deadlock).

## Proteção de logs de credenciais Android

Capacitor 8, em modo debug, registra pelo bridge `pluginId`, `methodData` e mensagens WebView (incluindo argumentos com tokens WSS). A aplicação passou a declarar `android.loggingBehavior: 'none'` em `capacitor.config.ts` tanto para `secureProbe` quanto para Release. Criado teste de regressão `lanBridgeLoggingSafety.test.ts`.

**Validação:** após `cap copy android`, o `capacitor.config.json` gerado contém `loggingBehavior: none`. Build `assembleSecureProbe` aprovado. Inspeção agregada dos logs do **Galaxy S23** (sem emitir ou conservar payloads na evidência) mostrou **0** eventos `methodData`, `rekeyOfferV2`, `resumeHello`, `rekeyAckV2` ou callback bridge no namespace `Capacitor`, para o processo testado. Isto verifica a política de logging do framework, não todas as fontes possíveis de logs nem captura do tráfego via ADB autorizado.

**Limitação do ensaio repetido:** o **Galaxy S25 FE** desconectou do ADB/USB antes da execução automatizada (falha `fetch` ao conectar no DevTools remoto). O ensaio novo em dois aparelhos **não foi concluído**; não declarar novo E2E PASS. O S23 permaneceu conectado para a auditoria local dos logs. Os E2E anteriores, realizados antes da alteração de logging, continuam aprovados como evidência de protocolo.

**Cuidados:** `secureProbe` permanece `debuggable=true` com DevTools USB, exclusivo de diagnóstico; não distribuir esse APK. O bloqueio de logs do Capacitor não equivale a isolamento contra dispositivos com root, debugging autorizado ou inspeção do processo.

## Resultado e política de saída

- TDD: **27/27** testes focados de host/resume com os dois novos casos, depois teste adicional de logging.
- Regressão global: **521/521 Vitest PASS (85 arquivos)**.
- **Atenção:** não concluir PL-03/PL-04/PL-05 nem modificar Impostor da Palavra neste gate. Próxima etapa permitida pelo planejamento: **PL-03 — interface de lobby persistente e UX Android sob feature flag**, jogos sintéticos, sem migração da main nem integração de jogo real.
- Pendências para PL-05/Release: validação com terceiro Android físico (ou delimitação formal), background/Doze prolongado, validação das condições de rede e teste de distribuição sem diagnósticos. A Room ainda é fechada por watchdog após 23h e convidados offline além do TTL de 2h não têm retomada garantida.

**Segurança operacional:** dados de testes e tokens não são registrados neste documento; nenhuma implantação, merge ou push autorizados/realizados como parte do gate.
