# Galerows — laboratório LAN com edição ao vivo (13/10/2026)

## Propósito
Permitir editar **React/TypeScript/CSS, home, Minha Galera, criação de sala, descoberta, lobby e telas dos jogos LAN** e observar atualizações no **app Android nativo** via Capacitor + Vite HMR, sem recompilar APK em cada alteração.

## Ambiente confirmado
- Repositório: `/Users/renanxavier/Documents/GitHub/galerows`, branch `feat/ux-hub-header-brand`, base HEAD `8ec6a01`. `main` preservada.
- Mac mini: Vite live port **4182**, comando:
  ```sh
  VITE_APP_PREVIEW=1 VITE_GAMES_FIRST_LAN_ENTRY=1 VITE_LAN_PERSISTENT_LOBBY_UI=1 ./node_modules/.bin/vite --host 0.0.0.0 --port 4182 --strictPort
  ```
  Servidor já iniciado como PID 75361 nesta sessão, log `/tmp/galerows-lan-live-vite.log`. Não criar segunda instância sobre a mesma porta. É um servidor de desenvolvimento sem autenticação; enquanto estiver ativo, evitar rede Wi-Fi pública e encerrar ao terminar.
- APK experimental em árvore **TEMPORÁRIA, fora do repositório**:
  `/tmp/galerows-lan-live-20261013/android/app/build/outputs/apk/debug/app-debug.apk`.
  Pacote **`com.galerows.app.lanlive`**, rótulo **Galerows LAN (Ao Vivo)**, instalado e iniciado nos 3 Androids físicos e no emulador. **Não substitui** `com.galerows.app.lanpilot` (versão de testes estável), nem `com.galerows.app` (principal).
- A cópia de Android temporária usa `server.url = http://127.0.0.1:4182`, debug `usesCleartextTraffic`, e `debug_network_security_config.xml` com 127.0.0.1 e antigo endereço de diagnóstico. **Nunca incorporar esses ajustes ao release** ou à configuração de produção.
- ADB reverse redireciona conexões do Android para o Vite no Mac, via cabo USB:
  ```sh
  ADB="$HOME/Library/Android/sdk/platform-tools/adb"
  for serial in <S25_FE_ADB_SERIAL> <S23_ADB_SERIAL> <MOTO_ADB_SERIAL> emulator-5554; do
    "$ADB" -s "$serial" reverse tcp:4182 tcp:4182
  done
  ```
  Após desconectar/reconectar USB, refazer `adb reverse`; sem o cabo, a versão `Ao Vivo` não abre a interface. A rede Wi-Fi permanece responsável pelo tráfego nativo WSS/NSD entre jogadores. Esse transporte USB foi escolhido porque o S23 abortou o HTTP direto por Wi-Fi, embora respondesse ping ao Mac.
- O navegador do Mac em `http://localhost:4182` não consegue hospedar/entrar em LAN nativa, pois o código impede LAN em plataforma web; **para editar/testar as telas de sala use o emulador Android com janela** ou os celulares `Ao Vivo`. A prévia de home no navegador continua independente em `localhost:4179`.

## Homologação executada
- Emulador, Moto G6, Samsung S23 e Samsung SM-S731B abrem `http://127.0.0.1:4182/` na WebView Capacitor com plataforma `android`, usando Vite `@vite/client`; sem modificação dos apps estáveis.
- Samsung SM-S731B criou **Room nativa WSS** no app `Ao Vivo`; Moto G6 descobriu a sala automaticamente por NSD e entrou; emulador entrou com convite completo via WSS. Ambos convidados e host exibiram **3 membros** na mesma sala, sem alertas.
- Samsung S23 carregou a home ao vivo por ADB reverse. No momento do gate, a interface DevTools desse aparelho ficou intermitente; o ingresso automático do S23 nesta nova Room **não foi homologado** (pode entrar manualmente pela lista quando estiver visível).
- Teste HMR na sala ativa: propriedade CSS temporária `--galerows-live-hmr-probe` aplicada em `lobby.css`, reconhecida no host + Moto + emulador sem recriar a sala, revertida e removida corretamente nos três. **Arquivo CSS voltou ao conteúdo original**, sem alteração persistente ou commit.
- Nas edições de JS/React, Fast Refresh pode preservar estado em casos compatíveis, mas certas mudanças ocasionam recarga completa, e isso **pode interromper a sala efêmera**. Testes de jogos e conexão continuam exigindo atenção a esse limite.

## Procedimento para continuar
1. Manter os quatro dispositivos autorizados por USB e conectados à mesma rede Wi-Fi, além de manter o Mac acordado.
2. Verificar Vite: `curl -I http://localhost:4182/`. Se não estiver ativo, executar o comando Vite indicado acima no diretório do repo.
3. Confirmar ou refazer `adb reverse tcp:4182 tcp:4182` para cada serial.
4. Abrir o ícone **Galerows LAN (Ao Vivo)** em cada Android. Se ficar erro de página indisponível, verificar cabo/ADB reverse, Vite ativo e tentar reabrir o app.
5. No host físico, `Minha Galera → Criar sala`. Nos convidados, `Minha Galera → Entrar em sala`, procurar sala na lista. Emulador NAT pode exigir convite completo + código verificador.
6. Alterar os arquivos da UI, por exemplo `src/features/multiplayer/lan/lobby/*.tsx` e `lobby.css`. Salvar: CSS/React costuma atualizar em segundos no app aberto.
7. **Não usar** esse APK debug/live como release. Alterações em Java, Manifest, plugins ou configuração nativa exigem rebuild/reinstalação do app experimental.
8. Quando terminar, parar o servidor Vite live (PID pode mudar); os apps de teste estáveis continuam disponíveis independentemente.

## Estado Git
A preparação do laboratório e APK ocorreu inteiramente em `/tmp` e no SDK/ADB. A única edição permanente neste branch até o início do laboratório era o trabalho de header e respectivos testes de UX. Esta nota documental foi acrescentada para facilitar a retomada; **nenhum commit, push, merge ou publicação foi feito nesta operação**.
