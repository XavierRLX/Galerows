# Galerows — PL-03 Android físico (12/10/2026)

**Branch:** `feat/multiplayer-lan-task1-wss`. APK experimental isolado `com.galerows.app.secureprobe`.

**Ambiente:** Galaxy S23 como host e Galaxy S25 FE como convidado. Ambos conectados por USB ao Mac e à rede Wi-Fi APTO402.

## Resultado

**PL03_PHYSICAL_UI_PASS steps=12**, repetido duas vezes após as correções. Evidências locais:
- `/tmp/galerows-pl03-ui-physical-wifi.log`
- `/tmp/galerows-pl03-ui-physical-final.log`
- `scripts/lan/pl03-ui-physical.mjs`

O roteiro comprovou: entrada nos dois aparelhos, criação de Room WSS nativa, convite QR e manual com conteúdo idêntico, admissão autenticada, dois membros na revisão 2, renovação de convite, dois jogadores prontos, início de `toy`, revelação/ocultação deliberada da carta privada, desconexão real do Wi-Fi do convidado, retomada da mesma partida, resultados, retorno ao lobby sem perder participantes, partida `counter` sem herdar segredo, pontuação 1/3 sincronizada em ambos, saída do convidado e encerramento pelo host.

## Problemas encontrados e corrigidos

1. **QR denso demais:** PNG de 300px e margem de dois módulos não era decodificável. Passou a 512px e margem de quatro módulos. Um teste automatizado decodifica o PNG completo e verifica a igualdade com o convite manual.
2. **Seleção incorreta de rede:** o S23 anunciava a interface de hotspot mesmo quando o convidado estava na rede Wi-Fi. PL-03 agora prefere Wi-Fi e permite escolher hotspot explicitamente. O comportamento legado de chamadas sem parâmetro mantém a preferência anterior de hotspot, protegido por testes Java e TypeScript.

## Limitações

A entrada foi feita com o convite manual através da UI automatizada. O QR foi decodificado a partir do próprio PNG da interface; **a câmera física não foi usada**. Leitor de tela, longa duração, stress e terceiro aparelho continuam como verificações de UX e Release. Estes testes sintéticos não certificam jogos reais nem produção.

A automação não registra o conteúdo dos convites nem os segredos privados. `main` deve permanecer intacta; sem push, merge ou deploy.

## Fechamento de regressão — execução final

- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- `npm test`: **537/537 PASS**, 89 arquivos Vitest.
- `npm run build` sem feature flag: **PASS**.
- `npx cap copy android`: **PASS**.
- Guard em `dist/assets` e `android/app/src/main/assets/public/assets`: **RELEASE_LOBBY_FLAG_GUARD_PASS** (sem `__lan-lobby-v2`, `LanPersistentLobbyScreen` ou `pl03-entry`).
- Android `:app:testSecureProbeUnitTest :app:assembleRelease --offline`: **BUILD SUCCESSFUL**, **37/37 JUnit**, 9 suites, 0 erros/falhas.
- `git diff --check`: **PASS**.
- SHA-256 do APK Release padrão: `b8e5c2b77bdb3493dd51acad55e266af0985c7ab078abc0eee11f63a275fa074`.

**Resultado do gate:** **PL-03 — PASS para lobby Android LAN v2, interface e fluxo funcional de dois aparelhos**. O teste de leitura da câmera física, Doze prolongado, acessibilidade com leitor de tela e terceiro aparelho não estão certificados neste gate e devem permanecer como ressalvas explícitas. Sem autorização para habilitar produção ou iniciar PL-06 implicitamente.
