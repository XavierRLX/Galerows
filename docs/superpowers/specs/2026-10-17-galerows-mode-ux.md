# Galerows — UX única para modos presenciais (17/10/2026)

## Aprovação e objetivo

O usuário aprovou a divisão de responsabilidades e especificou: na **home principal permanece apenas “Minha Galera”** como atalho de grupo. Dentro dessa área, distinguir sem ambiguidade **“1 celular”** (participantes locais salvos) e **“Multiplayer local”** (uma pessoa por dispositivo, mesma rede). A vitrine dos jogos redesenhada pelo Astra deve ser mantida.

## Navegação

1. **Home:** catálogo game-first da nova identidade; apenas o atalho de grupo “Minha Galera”. Ranking permanece acessível no cabeçalho de Minha Galera, não no conjunto de atalhos da home.
2. **Minha Galera:** dois controles com linguagem curta, “1 celular — Uma tela para o grupo” e “Multiplayer local — Um celular por pessoa”. Exibir apenas o conteúdo pertinente ao modo escolhido, mantendo persistência do grupo.
3. **1 celular:** gerenciar jogadores locais; não exigir Room, Wi-Fi nem autenticação LAN; ações de retorno ao catálogo e configuração local seguem existentes.
4. **Multiplayer local:** criar sala, entrar em sala e retomar sala ativa; não exigir pré-cadastro na lista local de jogadores; apenas Android com flags experimentais disponibiliza LAN, outros ambientes explicam a indisponibilidade sem prometer suporte.
5. **Cidade Dorme, Impostor da Palavra e Pista Única:** entrada comum em suas telas iniciais, com a escolha explícita do modo. Um celular continua no fluxo local existente; multiplayer vai a uma sala existente ou cria/entra em sala Android.
6. **Contexto do jogo:** criar via `/__lan-lobby-v2/criar?game=<id>` permite preselecionar `cidade-dorme`, `impostor-da-palavra` ou `pista-unica` em **Room recém-criada**, depois da criação autoritativa. Não aplicar essa intenção a Room ativa, nem aceitar jogos arbitrários. Convidados entram por `/__lan-lobby-v2/entrar`; o jogo é definido pelo host.
7. **Sem segundo lobby:** após READY + início, a experiência vai para a fase própria do jogo. Não duplicar Room, modificar os contratos de transporte WSS nem regras dos três jogos.

## Identidade e usabilidade

Respeitar logo vetorial oficial, carvão `#101014`, verde-lima `#D2F86A`, lavanda `#B8A0FF`, branco quente `#F5F3EF`. Manter cores/acento próprio de cada jogo. UI mobile-first 320/375/430px, áreas tocáveis adequadas, feedback claro de indisponibilidade e acessibilidade básica. Não transformar a home num formulário longo nem alterar o redesign Astra.

## Contratos e autoria

**Remote Desktop Commander:** `HubHeader.tsx`, `hub.css` no atalho, `PlayersScreen.tsx` e seus testes, `HomeRoomActions.tsx` e testes, `LanPersistentLobbyScreen.tsx` e testes. Dono do contrato de intenção LAN, gate de testes e integração.

**Codex:** `CidadeDormeHomeScreen.tsx`, `ImpostorDaPalavraHomeScreen.tsx`, `PistaUnicaHomeScreen.tsx`, componente compartilhado de escolha do modo, estilos desse novo componente e respectivos testes. Não editar arquivos do primeiro grupo, `RoomSessionProvider`, regras, protótipos, Git `main` nem identidades de marca.

## Requisitos de aceite

- Na home, somente “Minha Galera” entre atalhos de grupo; catálogo e configurações permanecem.
- Em “Minha Galera”, entender em segundos a diferença entre salvar participantes e criar/entrar numa Room; alternar sem perder dados.
- Escolher um dos três jogos permite acessar local ou LAN coerentemente com flags e plataforma, sem apresentar recurso indisponível como operacional.
- Criar uma sala partindo do jogo escolhido não exige repetir sua seleção.
- Tests RED→GREEN; Vitest, TypeScript, ESLint, build e `git diff --check` antes de integrar.
- Nenhum teste físico é declarado aprovado; iOS LAN não habilitado, `main` intocada, sem push/merge/deploy.
