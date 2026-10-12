# Galerows — Task 6: fechamento da validação física Android (11/10/2026)

**GATE TASK 6: PASS para a UI LAN experimental Android.** **Não equivale a Release distribuível; Task 7 não iniciada.** A avaliação física integra `docs/lan-task6-room-ui-evidence.md` e substitui a situação "pendente" da entrega inicial.

## Ambiente, controles e proveniência

- Repositório `/Users/renanxavier/Documents/GitHub/galerows`; branch `feat/multiplayer-lan-task1-wss`; HEAD histórico `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`. Alterações/arquivos untracked preservados; sem commit, merge, push ou alterações em `main`.
- Galaxy S23 `RXCX705P3JR` (host): `swlan0`, `10.245.112.98/24`. Galaxy S25 FE `RXGL30N4F3F` (convidado): `wlan0`, `10.245.112.245/24`. No cenário conectado, ambos tinham apenas a rota local `10.245.112.0/24`, sem rota padrão IPv4. Hotspot do S23, sem dependência de WAN.
- Mesmo APK `android/app/build/outputs/apk/secureProbe/app-secureProbe.apk` instalado com sucesso por ADB USB nos dois aparelhos; SHA-256 `3df130e5780f29deee1d4717f72e594ecbf43cb4d0786d073273337a0a64c519`, equivalente ao relatório Task 6.
- Controle de interface por CDP de WebView sobre ADB USB em portas locais 19222/19223; **sem ADB port-forward da porta do multiplayer**. Quaisquer convites de teste foram transferidos em memória entre WebViews e nunca impressos em logs. O aplicativo executou os comandos e eventos por WSS nativo no hotspot.
- Build padrão/Release preservado sem rota experimental, conforme evidência da Task 6. Os 401 testes Vitest, 26 JVM e builds são resultados do Codex anteriores e **não foram reexecutados** nesta verificação física.

## Resultados físicos

| Caso | Resultado | Evidência observada |
| --- | --- | --- |
| Dois aplicativos nativos no hotspot sem WAN | PASS | ADB identificou S23 e S25 FE; mesmas sub-rede/rotas LAN; APK de hash idêntico |
| Criar sala | PASS | Host criou `/__lan-room`, detectou IP/porta, exibiu QR, código presencial e participante local |
| Ingresso por convite manual | PASS | Convidado recebeu convite em memória pelo controle de UI, mostrou `Verificando anfitrião`, passou por confirmação e alcançou `Na sala` |
| Comando remoto | PASS | Contador 0→1 no S23 e S25 FE |
| Câmera real e QR da tela do S23 | PASS | Permissão de câmera concedida durante o uso; `video.readyState=4`, `videoWidth=480`, scanner reconheceu QR e avançou à comparação; convidado ingressou com `Na sala` |
| Comando após QR por câmera | PASS | Host tinha convidado ativo; contador 1→2 simultaneamente no host e convidado |
| Renovação de convite | PASS | Botão do host gerou convite diferente e QR presente; não se registrou a capacidade |
| Retomada manual | PASS | Após `Sair` (desconexão voluntária), botão `Tentar retomar` entrou novamente e comando subsequente foi aceito |
| Reconexão automática após queda real do socket | PASS | `GalerowsLanServer.closePeer` no host fechou a conexão WSS do convidado; estados observados: `Na sala → Retomando (1/3) → Na sala`. Host mostrou participante conectado e comando posterior sincronizou |
| Wi-Fi desativado durante sessão ativa | PASS para detecção | `cmd wifi set-wifi-enabled disabled` no S25 FE provocou estados `Retomando (1/3)` e `Retomando (2/3)` |
| Perda prolongada de rede e restabelecimento | PASS para comportamento delimitado | Ao reativar Wi-Fi, Android escolheu `APTO402` fora da LAN e esgotou 3 tentativas, mostrando `Retomada indisponível`. Ao voltar à rede salva `S23 de Renan`, retomada manual funcionou (`Na sala`), sem novo jogador; contador 0→1 em ambos |
| Encerramento do host | PASS | `Encerrar sala → Confirmar encerramento` no S23; S25 FE mostrou `Sala encerrada` e aviso do anfitrião, sem retomada indevida |
| QR legado da Adedonha e convites inválidos | PASS automatizado | Testes de componente da Task 6; não repetidos fisicamente neste ensaio |
| Reutilização de convite consumido / expiração | PASS automatizado | Suítes de contrato e admissão; no físico foi confirmada a renovação, não a rejeição do token velho |

## Observações e limites para Release

1. **Semântica de saída:** `Sair` apenas desconecta e preserva a credencial/membership. Em um ensaio, o host mostrou `Convidado 1 · desconectado` e, após novo ingresso, `Convidado 2 · conectado`. Essa retenção pode ocupar vagas da sala (limite nativo 16). Definir saída definitiva com revogação e `runtime.leave`, separada de falha transitória, antes da liberação aos usuários; não corrigido durante esta auditoria.
2. **Troca de rede:** o Android pode se associar automaticamente a outro Wi-Fi, fora do hotspot. O Galerows não pode restaurar uma LAN indisponível; UI limitada a três tentativas e botão de retomada manual quando o caminho volta. Não prometer retomada automática universal durante ausência prolongada do hotspot.
3. **Código presencial e QR:** a segurança depende de conferir na tela do host o código digitado no convidado. Não é garantida contra substituição completa de QR se o usuário não fizer a comparação física.
4. **Isolamento privado de dois convidados físicos simultâneos:** ainda não foi exercitado com três aparelhos; testado via bridge simulada nas Tasks 3–5.
5. **Série de Release:** o APK ensaiado é `secureProbe` experimental; o artefato Release normal não foi instalado/validado nesta etapa. O projeto requer Task 7 antes de distribuir.
6. **Teste de queda intencional versus inesperada:** uma chamada externa ao método nativo `GalerowsLanSecureClient.disconnect()` é um desligamento voluntário interno, com `generation` invalidada. Esse método não deve ser utilizado como prova de perda espontânea. O ensaio aprovado usou fechamento do lado servidor com `closePeer` e interrupção física da interface Wi-Fi.

## Encerramento

**Task 6 física: PASS para a UI Android experimental de criar/entrar/QR/comando/retomar/encerrar sala.** Gate de produto/Release: **NÃO APROVADO AINDA**. Próximo passo é revisar a saída definitiva (ou registrar decisão explícita de produto) e executar a Task 7 somente com autorização. Nenhuma modificação funcional, nenhuma alteração na `main`, nenhum commit/merge/push foram feitos pelo Remote Desktop Commander neste ensaio.
