# Fase 4A — teste em dois Androids físicos

Data: 2026-10-11 (America/Sao_Paulo). Branch: `feat/multiplayer-lan-4a`. Nenhum commit criado.

## Ambiente e artefato

| Papel | Serial ADB | Modelo (`getprop`) | Android/API | Wi-Fi/IP |
| --- | --- | --- | --- | --- |
| Anfitrião | `RXCX705P3JR` | `SM-S911B` (Galaxy S23) | 16 / 36 | `APTO402` / `192.168.0.84` |
| Convidado | `RXGL30N4F3F` | `SM-S731B` | 16 / 36 | `APTO402` / `192.168.0.89` |

`adb devices -l` mostrou ambos como `device`. A conexão USB serviu para instalar e inspecionar WebViews; o WebSocket utilizou o IP Wi-Fi do anfitrião, sem `adb reverse` ou encaminhamento da porta do jogo. O encaminhamento ADB local das portas 9222/9223 foi usado apenas para inspecionar as WebViews via Chrome DevTools Protocol.

Com JDK 21 do Android Studio, `VITE_LAN_DIAGNOSTICS=1 npm run build`, `VITE_LAN_DIAGNOSTICS=1 npx cap sync android` e `./gradlew :app:testDebugUnitTest :app:assembleDebug` passaram. SHA-256 do APK usado na rede `APTO402`: `7261ea09309018c564778b05a2a76dd867192f81cc8320e29aaffaefc872d1bc`. Os hashes SHA-256 de `dist/index.html`, do asset sincronizado e do mesmo arquivo extraído do APK são idênticos: `f8afd81ad453e77b048bef06264e83ac14c17c600a0dd453d7625ca5e0ad0083`. O APK contém `LanDiagnosticScreen-VAFgRJ1H.js`. Um build web comum, sem a variável de diagnóstico, não contém esse chunk.

O APK foi instalado com `adb -s RXCX705P3JR install -r .../app-debug.apk` e `adb -s RXGL30N4F3F install -r .../app-debug.apk`; ambos retornaram `Success`. `am start -n com.galerows.app/.MainActivity` abriu o Galerows nos dois, com processos ativos 17946 e 22804 nessa sessão. O convite foi gerado aleatoriamente na página de diagnóstico e não é reproduzido aqui.

## Evidência de transporte real

Nessa sessão, o servidor nativo do S23 iniciou na porta 37697. A WebView do SM-S731B conectou a `ws://192.168.0.84:37697/` e enviou o `hello`. A WebView anfitriã recebeu pelo evento Capacitor `native connected peer=cf998dcc-4287-4777-ab85-98030e527070` às 13:31:04 UTC. Em seguida:

```text
13:31:07.350Z anfitrião: native message peer=cf998dcc-4287-4777-ab85-98030e527070 frame={"kind":"pong","protocolVersion":1}
13:31:07.391Z anfitrião: native sent ping peer=cf998dcc-4287-4777-ab85-98030e527070
13:31:07.985Z convidado: webview received {"kind":"ping","protocolVersion":1}
```

Isso percorreu WebView convidada → WebSocket Wi-Fi → `LanSocketServer` → plugin Capacitor/WebView anfitriã, e o sentido inverso pelo `send` do plugin. O Logcat final do convidado não mostrou `ERR_CLEARTEXT_NOT_PERMITTED`, bloqueio de mixed content, falha de permissão nem `FATAL EXCEPTION`.

## Casos executados

| Caso | Resultado e evidência |
| --- | --- |
| Inicialização/parada | `server started port=34703`; `server stopped` desconectou o par; nova inicialização na porta 33495 aceitou ingresso. |
| Convite válido | O servidor emitiu `native connected` após o `hello`; peer ID presente no status anfitrião. |
| Convite inválido | Convidado com token incorreto abriu o TCP/WebSocket e recebeu `client closed` em ~50 ms; anfitrião permaneceu sem peer, sem evento `connected`. |
| Bidirecional | `pong` chegou ao evento nativo; `ping` enviado pelo nativo chegou à WebView convidada nas duas sessões físicas. |
| Desconexão/reconexão | `native disconnected` do primeiro peer; novo ingresso recebeu outro peer ID. Reconexão também passou após parada/reinício do servidor. |
| Background/foreground | Com anfitrião em segundo plano, `pong` do convidado apareceu no log anfitrião ao retornar. Com convidado em segundo plano, `ping` recebido apareceu ao retornar. |
| Encerramento do anfitrião | `am force-stop com.galerows.app` encerrou o processo; convidado registrou `client closed`. |
| Sem internet, LAN mantida | Aprovado na sessão de hotspot sem WAN descrita abaixo. |

## Falhas reproduzidas e correções

1. A WebView em `https://localhost` bloqueou `ws://192.168.0.84` como mixed content (`SecurityError`). Configurou-se `allowMixedContent` apenas ao criar o APK de diagnóstico com `VITE_LAN_DIAGNOSTICS=1`; o build comum o mantém desligado.
2. Após isso, o socket ainda falhou por política cleartext. O teste instrumentado `LanDebugNetworkPolicyTest` falhou primeiro em `isCleartextTrafficPermitted("192.168.0.84")`. Adicionou-se configuração de rede **somente em `src/debug`**, inicialmente para esse IP. Na sessão de hotspot, o teste foi alterado primeiro para o novo IP `10.245.112.98` e falhou contra o APK antigo; após atualizar a configuração Debug, passou, negando o IP antigo, o IP do convidado e `example.com`. O endereço é específico da sessão e deve ser atualizado se o IP anfitrião mudar.

Os testes JVM do servidor e codec passaram (9 + 6), assim como os 8 testes Vitest LAN. O `hello` válido é validado no servidor antes do evento `connected`. O `open` do navegador ocorre antes da validação do convite e, sozinho, não comprova ingresso; o diagnóstico usa o evento nativo para essa conclusão.

## Hotspot sem internet — 2026-10-11

O S23 hospedou o hotspot na interface `swlan0`, endereço `10.245.112.98/24`. O SM-S731B (Galaxy S25 FE) conectou ao SSID `S23 de Renan` pela interface `wlan0`, endereço `10.245.112.245/24`. Dados móveis estavam desativados nos dois. `ip -4 route get 10.245.112.98` no convidado usou `dev wlan0`; a rota inversa no anfitrião usou `dev swlan0`. `adb forward --list` continha apenas `tcp:9222` e `tcp:9223` para depuração das WebViews, sem encaminhamento para a porta do jogo. O ADB USB continuou disponível só para instalar e ler evidências.

Ausência de internet foi verificada durante o teste: no S23, `ip -4 route get 1.1.1.1` e `ping 1.1.1.1` retornaram `Network is unreachable`; no convidado, o ping a `1.1.1.1` retornou `Destination Net Unreachable` originado por `10.245.112.98` (0/1 resposta). Pings bidirecionais entre os aparelhos tiveram 2/2 respostas e 0% de perda em cada direção.

O APK Debug atual tem SHA-256 `852930944cbc218b28866ef24a271c4ead9a4c50ae8832d7268430bef1ff758a`. Foi instalado com `adb -s` em ambos (`Success`); os `base.apk` extraídos de cada aparelho têm exatamente esse hash. O hash do `index.html` em `dist`, no asset sincronizado e dentro do APK permanece `f8afd81ad453e77b048bef06264e83ac14c17c600a0dd453d7625ca5e0ad0083`. `:app:testDebugUnitTest`, `:app:assembleDebug` e o teste instrumentado `LanDebugNetworkPolicyTest` passaram. Este teste permite `10.245.112.98` e nega `192.168.0.84`, `10.245.112.245` e `example.com`.

O servidor nativo do S23 iniciou na porta informada em tempo de execução, **37677**. A WebView convidada conectou a `ws://10.245.112.98:37677/` e enviou o `hello` com convite gerado para a sessão. O servidor emitiu `native connected peer=05c94455-bc38-435b-a19b-706abc1ef055`. Mensagens nos dois sentidos:

```text
13:41:40.869Z anfitrião: native message peer=05c94455-bc38-435b-a19b-706abc1ef055 frame={"kind":"pong","protocolVersion":1}
13:41:40.920Z anfitrião: native sent ping peer=05c94455-bc38-435b-a19b-706abc1ef055
13:41:41.455Z convidado: webview received {"kind":"ping","protocolVersion":1}
```

O convidado desconectou e o anfitrião registrou `native disconnected` às 13:41:45Z. Um convite incorreto abriu o WebSocket e recebeu `client closed` em cerca de 15 ms, sem novo `native connected` no anfitrião. Após restaurar o convite válido, o servidor emitiu `native connected peer=91e9820f-698b-4fdb-be27-6ec0f8bf651f`; novo `pong` chegou ao plugin e novo `ping` à WebView convidada. O Logcat final do convidado não mostrou `ERR_CLEARTEXT_NOT_PERMITTED`, bloqueio de mixed content, falha de permissão ou `FATAL EXCEPTION`.

**Resultado técnico:** aprovado o transporte WebSocket LAN Android ↔ Android no hotspot local sem internet e sem roteador externo, inclusive autenticação inicial, troca bidirecional, rejeição e reconexão. Ao terminar, o convidado foi desconectado e o servidor parado. Isso conclui a validação técnica solicitada da Fase 4A; não é conclusão formal nem implementação da Fase 4B. Não foram criadas telas definitivas, integração com Adedonha, backend ou commits. O documento `multiplayer-offline-first-requirements.md` não foi alterado.
