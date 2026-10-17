# Galerows / Cidade Dorme — Instalação de teste e suspensão do gate físico

**Data:** 17/10/2026
**Branch:** `feat/cidade-dorme-expanded-roles-01`
**Baseline funcional:** `065c9a2` (expansão de papéis, cartas, narração e testes previamente commitados).

## Preparação de build

- `npm run build`, `npx cap sync android` e `./gradlew :app:assembleDebug --offline --no-daemon --console=plain`: **PASS** na tentativa final.
- O build Android final foi gerado com `VITE_GAMES_FIRST_LAN_ENTRY=1` e `VITE_LAN_PERSISTENT_LOBBY_UI=1`, permitindo a navegação experimental LAN. As flags foram variáveis de ambiente do comando, **não alterações no código nem na configuração de produção**.
- APK gerado somente na máquina local: `android/app/build/outputs/apk/debug/app-debug.apk`. O APK é artefato gerado, não foi versionado.
- Os 876 testes Vitest aprovados pertencem ao gate anterior de implementação. **Não** são evidência de uma partida física nesta etapa.

## Estado observado dos dispositivos

| Dispositivo | Resultado |
| --- | --- |
| Samsung FE / SM-S731B (chamado S26 FE na conversa) | APK experimental com LAN habilitada instalado com sucesso pelo ADB e app iniciado |
| Emulador Android `Galerows_LAN_4` / Android 13 | APK experimental com LAN habilitada instalado com sucesso pelo ADB e app iniciado |
| Galaxy S23 / SM-S911B | APK inicial sem flags LAN foi instalado; nova instalação LAN ficou pendente por intermitência ADB. Aparelho apresentou problema de tela e foi **excluído do teste por solicitação do usuário** |
| Moto G6 | ADB apareceu brevemente, mas desconectou antes da instalação: **APK não instalado** |
| iPhone | Não utilizado: versão atual desabilita multiplayer LAN no iOS por ausência da paridade de transporte seguro / plugins nativos |

## Gate e decisão

- O plano original era S23 como host e demais Android como convidados. **Nenhuma Room de quatro participantes foi criada ou validada nesta tentativa**.
- Após o problema do S23, havia apenas S26 FE + emulador disponíveis pelo ADB; Moto G6 não estava conectado no momento da última verificação.
- Usuário determinou **adiar os testes físicos**, pois Cidade Dorme exige pelo menos quatro participantes para iniciar uma partida.
- Estado correto: **BUILD/INSTALAÇÃO PARCIAL; HOMOLOGAÇÃO FÍSICA PENDENTE / HOLD**. Não relatar PASS de rede, reconexão, áudio ou partida real.

## Segurança, rastreabilidade e próximo passo

- Nenhum `push`, `merge`, `deploy` ou alteração na `main` foi solicitado ou realizado.
- Preservar os worktrees existentes, a modificação gerada de `android/capacitor.settings.gradle` e oito scripts temporários `.city-expanded-*.py` já existentes; não incluí-los nos commits.
- Retomar somente com quatro participantes Android operacionais, mesma rede Wi-Fi/hotspot, host definido pelo usuário e telas desbloqueadas/ADB disponível. Emulador substitui um participante, mas sua descoberta NSD pode exigir fluxo alternativo de convite, a ser validado no gate.
