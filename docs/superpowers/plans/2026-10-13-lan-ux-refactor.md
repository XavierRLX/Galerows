# Refatoração de Minha Galera e lobby LAN

**Objetivo:** implementar o briefing de UX fornecido em 13/10/2026, no checkout atual, preservando alterações locais.
**Arquitetura:** manter RoomSessionProvider como único proprietário da sessão. Rotas são views. O scanner entrega um convite ao método específico joinScannedInvite(raw); o contrato de transporte e dos três jogos permanece intacto.
**Stack:** React 19, TypeScript, Capacitor, Vitest.
**Restrições:** sem commit/push/merge/deploy, sem modificar main, sem APK/dados de aparelhos, sem servidor online. Preservar flags experimentais e header em andamento.

## Design adotado
- /players → /criar: inicia criação uma vez; erro permite tentar novamente e abrir Opções de rede. Nunca repete o menu.
- /players → /entrar: inicia descoberta, lista primeiro; código de seis dígitos só sob demanda; QR como alternativa independente de mDNS.
- Header simples com voltar para /players. Navegação não chama leave/close.
- Lobby: sala/conexão, participantes, jogo/regras/prontidão; convite recolhível, placar após controles, confirmação explícita de saída.
- QR presencial é o canal de confiança do fingerprint/capability. Sem texto completo na UI. Decoder, pinning e validação pelo anfitrião não mudam.
- Código público não resolve endereços sem descoberta: orientar QR, sem varredura de sub-rede.

## Execução / ledger
- [x] A: auditar baseline e alterações, ler contratos e laboratório.
- [x] B: testes RED para criação direta e navegação; implementar rotas/header.
- [x] C: testes RED para descoberta/código e QR; implementar entrada e scanner.
- [x] D: reorganizar lobby e seção Minha Galera; preservar jogos e placar.
- [x] E: suíte completa, typecheck, lint, builds padrão/experimental, revisão visual 320/360/375/384/430/768/desktop e revisão independente.

Ruling: seguir o desenho detalhado já autorizado pelo usuário e executar sem pedir nova aprovação de plano; não aplicar etapas de commit das skills, proibidas pelo pedido.
Ruling: usar colaboração da skill subagent-driven-development para a unidade QR e revisão; alterações de UI integradas neste agente para evitar conflitos no mesmo arquivo.

Resultado: implementação e gates automatizados concluídos; 689 testes, typecheck, lint e ambos builds passam. Relatório e limites físicos em `../reviews/2026-10-13-lan-ux/README.md`. Leitura óptica física/QR nativo completo e partidas completas permanecem pendentes de homologação.
