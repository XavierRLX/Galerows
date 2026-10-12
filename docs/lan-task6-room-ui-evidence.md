# Task 6 — Interface de salas LAN

Data: 11/10/2026. Branch: `feat/multiplayer-lan-task1-wss`. HEAD histórico preservado: `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`. A working tree já continha alterações e arquivos não rastreados das Tasks 1–5; nada foi removido, commitado, mesclado ou enviado.

## Escopo implementado

- Tela Android experimental em `/__lan-room`, incluída somente com `VITE_LAN_ROOM_UI=1` e plataforma nativa. O build padrão não registra essa rota. As rotas temporárias de diagnóstico continuam sob suas próprias flags.
- Anfitrião: descoberta nativa de IPv4 privado em Wi-Fi/hotspot ativo, com preferência pelo hotspot; sala com `LanRoomHost`, `AuthoritativeRoomRuntime` e adapter de contador sem estado privado; membro local, QR gerado por `qrcode`, convite textual copiável, código presencial separado, endereço/porta, validade, renovação após consumo, expiração e alteração de IP, participantes e desconexões, comando de teste e encerramento confirmado.
- Convidado: scanner próprio com `jsqr` e câmera liberada na leitura, fechamento, erro e desmontagem; entrada manual; decoder `galerows-lan-v1:` separado do formato legado da Adedonha; erros de convite; comparação presencial de código somente após TLS pinado; progresso de conexão; estado “Na sala” apenas após `admissionConfirmed`; saída, fechamento definitivo e retomada autenticada com até três tentativas automáticas após perda transitória.
- `LanRoomSession` expõe fases de ingresso para apresentação e permite desconectar enquanto a comparação presencial ainda está pendente. `LanRoomHost` expõe renovação, snapshot e estado dos membros locais sem transferir a autoridade para a UI.

## TDD e testes focados

Foram observadas falhas antes das mudanças em `LanRoomHost` (snapshot/renovação e desconexão), `LanRoomSession` (fases e cancelamento), scanner (permissão, liberação de câmera e stream duplicado) e tela (convite legado e comando do adapter). Após implementação, as suítes focadas passaram. O teste nativo de descoberta começou com falha de compilação e terminou com quatro casos JVM aprovados.

Os testes de componente cobrem QR e código separados, entrada manual, convite vencido, QR legado, alteração de IP, comparação divergente, confirmação pendente, fechamento autenticado e limite de três tentativas de retomada. A bateria existente cobre convite consumido, timeout de ingresso, TLS pin divergente, credencial de retomada e compensação do handshake.

## Validação automatizada

| Verificação | Resultado |
| --- | --- |
| Vitest completo | 69 arquivos, 401 testes aprovados na bateria final. |
| TypeScript | `npm run typecheck` aprovado. |
| ESLint | `npm run lint` aprovado. |
| Vite padrão | `npm run build` aprovado. |
| Vite experimental | `VITE_LAN_ROOM_UI=1 npx vite build` aprovado e copiado com `npx cap copy android`. |
| Android JVM | `:app:testSecureProbeUnitTest` aprovado: 26 testes, zero falhas. |
| Android APK | `:app:assembleSecureProbe` aprovado com a UI experimental; após o ensaio parcial, assets padrão restaurados por `npm run build` e `npx cap copy android`, e `:app:assembleRelease` aprovado sem a rota experimental. |
| `git diff --check` | Aprovado. |

## Ensaio físico

O Galaxy S23 `RXCX705P3JR` está conectado por USB, com hotspot `swlan0` em `10.245.112.98/24` e somente rota local `10.245.112.0/24`, sem rota padrão/WAN. O APK experimental `secureProbe` foi instalado, e a tela LAN foi aberta e criou uma sala com QR no aparelho. SHA-256 do APK experimental final: `3df130e5780f29deee1d4717f72e594ecbf43cb4d0786d073273337a0a64c519`. SHA-256 do APK Release padrão final: `9ce9176e93c68fdacdeed8a6378942820726194b4d059ad13c356162ae298d67`. Nenhum encaminhamento ADB da porta de jogo foi usado. O Galaxy S25 FE `RXGL30N4F3F` ainda não está visível em `adb devices`; uma tentativa de alcançá-lo no último IP documentado não respondeu. Por isso QR pela câmera do convidado, novo handshake entre dois aparelhos, comando remoto, reconexão e encerramento remoto ainda não foram ensaiados fisicamente nesta Task. Não considerar a validação física completa até esses casos serem executados.

## Limites

O adapter é apenas um contador de infraestrutura; não há integração de Impostor da Palavra nem Adedonha. A saída do convidado desconecta o socket e conserva a credencial para retomada, pois o contrato LAN atual não possui mensagem de retirada definitiva do membership. A interface está sob flag experimental e não estabelece prontidão de distribuição. Task 7 e iOS continuam fora deste escopo.

## Complemento — gate físico executado em 11/10/2026

A pendência de dois Androids da entrega inicial foi resolvida após a conexão do Galaxy S25 FE. **Task 6: PASS para UI LAN experimental Android.** Foram verificados por ADB/CDP nos aparelhos reais ingresso por convite manual, leitura física do QR pela câmera, comparação presencial, confirmação de ingresso, comandos sincronizados, renovação do convite, reconexão automática após encerramento remoto do socket, detecção da perda real de Wi-Fi, retomada após retorno ao hotspot e aviso de sala encerrada. O mesmo APK experimental (SHA-256 `3df130e5780f29deee1d4717f72e594ecbf43cb4d0786d073273337a0a64c519`) foi utilizado nos dois aparelhos. Ver evidência detalhada e ressalvas em `docs/lan-task6-physical-gate-evidence.md`. O gate de distribuição Release permanece pendente da Task 7. Não houve modificações funcionais, commit, merge ou push nesta validação complementar.
