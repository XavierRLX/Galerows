# Galerows — homologação LAN real: Impostor imersivo

Data: 2026-10-14. Branch: feat/ux-hub-header-brand. Sem commit, push, deploy ou reinstalação.

## Dispositivos

- Samsung SM-S731B, ADB <S25_FE_ADB_SERIAL>, host da Room.
- Samsung Galaxy S23 SM-S911B, ADB <S23_ADB_SERIAL>, convidado.
- Emulador Android 13, ADB emulator-5554, convidado.
- Moto G6 não detectado pelo ADB nesta sessão.

Os três apps com package com.galerows.app.lanlive estavam instalados e usaram o Vite em 4182 por ADB reverse. O transporte real foi LAN TLS/WSS do app nativo, e as ações de UI foram conduzidas com CDP sobre WebViews reais. Não houve fake Room ou mock de votos.

## Resultado da sessão

Room criada no host: sufixo público 8688C3.
S23 ingressou por descoberta automática NSD. O QR inicial falhou por invite_expired (TTL de 120 s, relógios de aparelhos sincronizados); o host renovou o convite e o emulador ingressou após simulação do callback de QR no componente da câmera. A decodificação do QR foi real, mas não foi testada a câmera física do emulador.

- Três participantes sincronizados na mesma Room: PASS.
- Host selecionou Impostor, regras do novo fluxo e timer de dois minutos; 3/3 READY: PASS.
- START_GAME levou os três diretamente à tela imersiva de identidade, com contagem inicial e sem segundo lobby: PASS.
- Três revelações individuais pelo dispositivo; exatamente um impostor; informações privadas preservadas: PASS.
- Banner Todos visualizaram visível em todos sem remover a carta; reconsulta do segredo permitida: PASS.
- START_TIMER e contagem 01:59 consistente em três aparelhos: PASS.
- START_VOTING host-only abriu votação em todos e removeu a carta: PASS.
- Três votos registrados separadamente pelo app, aguardando 1/3 e 2/3 e sem mostrar escolhas: PASS.
- Terceiro voto levou os três simultaneamente à vitória da galera, pontos e revelação final: PASS.
- END_GAME pelo host registrou um jogo pontuado; RETURN_TO_LOBBY devolveu os três à mesma Room, com membros preservados e prontidão zerada: PASS.

## Ajuste detectado e corrigido durante a homologação

Sem displayName no ingresso via descoberta, a lista de votação tinha dois convidados indistinguíveis chamados Jogador. Alteração em ImpostorImmersiveRound.tsx mantém números públicos únicos: Jogador 02, Jogador 03 etc. TypeScript aprovado após alteração. Constatado na votação real nos três dispositivos.

## Limites

- Homologação em dois celulares físicos + um emulador, não três celulares + emulador.
- O QR foi injetado no callback do leitor para testar o fluxo de admissão. Validação do QR com câmera física continua pendente.
- Não foram testados nesta sessão empate, nova rodada completa, reconexão durante a votação ou perda de anfitrião.
- A regressão total do repositório enfrenta um teste novo do protótipo paralelo de Cidade Dorme: cidadeDormePreviewRoom.test.ts. Ao excluir somente esse teste, 710/710 testes passaram; TypeScript, ESLint, build padrão e experimental LAN passaram.
- O teste foi realizado na versão experimental Galerows LAN (Ao Vivo), não na release pública.

## Evidências locais no Mac

/tmp/galerows-join-3-real.log
/tmp/galerows-qr-refresh-emulator.log
/tmp/galerows-config-and-ready.mjs
/tmp/galerows-start-real-round.log
/tmp/galerows-identity-live.log
/tmp/galerows-live-real-vote.log
/tmp/galerows-real-room-return.log

Logs de teste não guardam o conteúdo do QR, a palavra secreta ou a identidade específica do impostor.
