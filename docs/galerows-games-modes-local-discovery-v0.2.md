# Galerows — Jogos primeiro, salas LAN sem atrito (produto + UX v0.2)

**Data:** 12/10/2026 · **Estado:** direção de produto aprovada; **novas mudanças de UX v0.2 ainda não implementadas**. O PL-03 existente permanece intacto.
**Substitui a orientação de navegação e ingresso** dos itens 2 e 5 de `docs/multiplayer-persistent-lobby-spec.md` quando houver divergência. A arquitetura de Room, GameSession, WSS, private state e fail-closed do PL-02B/PL-03 continua válida. Evidência: `docs/lan-pl03-lobby-physical-2026-10-12.md`.

## 1. Decisões de produto (fechadas)

1. **O catálogo é a tela inicial canônica (`/`)**, com todos os jogos existentes; não abrir o lobby automaticamente ao iniciar o app, mesmo em feature flag. Uma sessão LAN ativa aparece em um atalho contextual **Voltar à sala**, não substitui o catálogo.
2. A home oferece **Entrar em sala** e **Criar sala** como ações de grupo; clicar num jogo apresenta apenas os modos que aquele jogo suporta de fato. Não exibir LAN como se todos os jogos fossem multiplayer.
3. Ao entrar em sala, **buscar automaticamente salas anunciadas na mesma Wi-Fi/hotspot**; exibir lista antes de outras formas de convite. Mostrar estado sem salas, carregando, permissão negada, sala cheia/em jogo, falha de conexão, rede isolada, mudança de rede e atualização manual.
4. **Entrada preferencial com um toque** na sala disponível. Fallbacks visíveis **Ler QR Code** e **Código de 6 dígitos**. Sem senha adicional, sem digitar IP/porta, sem copiar convite longo e sem obrigar comparação manual de fingerprint. Informações técnicas ficam ocultas ao usuário.
5. O código numérico de seis dígitos é **identificador curto de sala**, não senha, autenticação ou segredo; vale apenas enquanto a Room existir e a descoberta fornecer o endpoint da sala. **Não funciona como busca global** nem dispensa o NSD/mDNS. Se a descoberta for bloqueada pelo roteador, QR continua disponível e funcional.
6. Preservar **uma Room persistente e várias GameSessions sequenciais** (host, participantes, resultados → lobby → novo jogo). Abrir catálogo ou escolher jogo não pode executar `LEAVE_ROOM` nem encerrar o host inadvertidamente.
7. Somente **três jogos reais serão habilitados inicialmente no modo LAN**: Impostor da Palavra (primeiro consumidor), Adedonha (segundo) e **terceiro A DEFINIR** com o proprietário do produto. `toy` e `counter` continuam apenas testes internos; nenhum jogo real já está integrado à Room v2.
8. **Jogar em um aparelho compartilhado** e **cada jogador no seu** são experiências independentes na UX. O modo compartilhado já existente não exige LAN e não deve regredir.

## 2. Princípio de navegação — jogo primeiro, conectividade depois

```text
ABRIR APP
└─ /inicio: identidade Galerows + ação rápida Jogar com a galera + catálogo completo
   ├─ Entrar em sala → procurando salas locais
   │  ├─ sala anunciada → card (nome, jogo público, ocupação, fase) → Entrar
   │  ├─ ler QR → conectar à sala exata
   │  └─ código de seis dígitos → filtrar salas encontradas → Entrar
   ├─ Criar sala → lobby host → compartilhar QR/código → escolher jogo suportado
   ├─ Voltar à sala (se membership recuperável) → sala já existente, sem novo join
   └─ card de jogo → detalhes/regras → modos disponíveis
      ├─ Jogar neste celular → fluxo offline local atual, com turnos/segredos por passagem do aparelho
      ├─ Cada um no seu celular → escolher Criar sala / Entrar em sala
      └─ Individual (apenas em jogos que já suportam, não presumir para todos)
```

**Não fazer:** criar um segundo catálogo incompatível dentro do lobby; empurrar todos para LAN ao clicar no jogo; dizer que `isAvailableOffline` equivale a multiplayer; deixar botões aparentemente disponíveis sem adapter real.

### Home / cards de jogo

- Preservar logo, splash, tipografia e identidade da `/inicio` existente. Identidade v0.3 do PL-03: grafite `#101014`, lima `#D2F86A`, lilás `#B8A0FF`, Bricolage e DM Sans. Não adotar nova marca genérica.
- Criar bloco de ações LAN compacto: **Entrar em sala**, **Criar sala**, e **Voltar à sala** quando aplicável. Catálogo continua a área principal.
- Nos cards, sinalizar **`Neste celular`**, **`LAN · Cada um no seu`** ou **`Em breve`** conforme capacidade real, sem badge verde para modo indisponível.
- O botão de jogo nunca deve exigir configuração LAN para o modo compartilhado. Entrada pela home pode entrar em lobby genérico e escolher o jogo depois.
- Usabilidade: ações principais ≥44×44 px, alto contraste, estado de foco legível, texto em português, ícones acompanhados por rótulo, estado de carregamento e erro acionável; respeitar `prefers-reduced-motion` e leitores de tela.

### Como a seleção de modos aparece

- Em jogos com dois modos: mostrar **Jogar neste celular** (compartilhado/passa-o-celular) e **Cada um no seu celular** (LAN, um app por participante). Explicar que a segunda opção precisa da mesma rede local; o primeiro modo funciona inteiramente sem conexão.
- Em jogos só com um modo atual: abrir o fluxo existente diretamente ou indicar o modo com uma ação clara, sem menu redundante.
- Se LAN ainda não estiver aprovado para aquele jogo, usar **LAN em breve** sem CTA funcional e sem sugerir que já funciona.
- O anfitrião pode escolher outro jogo suportado dentro da Room, sem recriar a conexão; convidados acompanham estado autoritativo.

## 3. Descoberta local (PL-04) e ingressos

**Mecanismo candidato:** Android NSD/mDNS, tipo/serviço versionado do Galerows; Wi-Fi/hotspot sem Internet, sem backend, sem scanning de sub-rede agressivo. Comportamento em Android Samsung, multicast, AP isolation e hotspot deve ser **comprovado** antes de transformar a hipótese em produto. iOS/Bonjour fica para gate posterior.

**Anúncio público mínimo e efêmero:** `protocolVersion`, `roomPublicId`/código de 6 dígitos, nome sanitizado, host endpoint, capacidade/ocupação, fase pública, jogo selecionado público e expiração curta. Não transmitir no anúncio `inviteToken`, `capability`, `resumeToken`, certificados privados, palavra/impostor ou snapshot privado. Metadados podem estar desatualizados: o host revalida tudo no ingresso.

**Código `000000`–`999999`:** geração pelo host com CSPRNG, renderização agrupada `482 193`, normalização para seis dígitos exatos, sem remover zeros à esquerda. Escopo da rede atual; não usar como único `roomId` autoritativo. Detectar colisões entre salas descobertas com o mesmo código e pedir escolha da sala; não unir salas nem fazer join aleatório. O código expira quando a Room encerra e não é reutilizado como credencial de retomada.

**Lista de salas:** início automático ao abrir Entrar, busca não bloqueante; cards com nome, jogo público/aguardando/ocupação, ação **Entrar** apenas quando apropriado; botão Atualizar. Estado vazio dá instruções **Ler QR**, **Digitar código** e verificar mesma Wi-Fi. Se descoberta falhar ou roteador isolar clientes, não fingir sala inexistente: explicar limite e oferecer QR. Atualização de fase/lotação via anúncio com TTL e revalidação ao ingressar.

**QR:** caminho alternativo independente da descoberta (já validado pelo usuário no fluxo atual). Manter geração 512px e quiet zone 4 módulos, contrato versionado e TLS pinning do ingresso por QR; não exibir texto técnico nem exigir cópia do payload. O leitor de câmera precisa ser testado também no novo fluxo integrado.

## 4. Segurança e decisão ainda aberta — NÃO reduzir segurança por conveniência

**Intenção de UX aprovada:** sem senha ou código presencial extra. **Não significa** admitir que qualquer pacote da Wi-Fi é autêntico: a LAN pode ter convidados desconhecidos, cliente malicioso, roteador com isolamento ou anúncio mDNS falsificado. Uma sala pública na LAN é opt-in consciente do anfitrião; host mantém limites de vagas, fechamento, revogação, contenção de abuso e proteção dos segredos.

**Incompatibilidade arquitetural atual:** `lanPersistentInvite.ts` e host v2 exigem `capability` de convite e TLS pinado com fingerprint conferido presencialmente. O anúncio NSD é **não confiável**. É impossível obter garantia equivalente de identidade do host apenas de um código público de 6 dígitos e um anúncio falsificável; **não remover a checagem/pinning nem colocar tokens de ingresso em TXT/broadcast**.

**Gate obrigatório de ameaça + proposta de protocolo antes do novo join:**
- Comparar **primeiro ingresso sem confirmação adicional**, via sala aberta com TLS cifrado porém identidade inicial não autenticada, versus **aprovação do host de uma solicitação** sem senha (ainda exige vinculação segura da chave para não ser suscetível a intermediário). Considerar confiança previamente pinada/TOFU com advertências explícitas em primeiro ingresso e risco de troca de endpoint; isso **não é equivalente a autenticidade inicial**.
- Apresentar ao proprietário trade-offs objetivos: UX/ameaças da mesma LAN, impostor de host, griefing de convidados, descoberta forjada, replay, TTL/código duplicado, flood e lobby cheio. **Não afirmar zero-trust sem um mecanismo verificável**.
- Manter criptografia TLS, isolamento privado por `playerId`, autorização do host e credenciais de resume Keystore. O host tem autoridade sobre `JOIN`; o código de sala **não** confere privilégios.
- Decisão de produto exige ingresso com um toque em sala local visível; a implementação só é liberada após um **design review de segurança** que escolha e teste explicitamente a redução de autenticação inicial ou a alternativa de baixo atrito. Se não houver solução aprovada, não implementar auto-join inseguro; usar fallback QR já aprovado.
- Nenhuma integração LAN v1 pode mudar silenciosamente. Feature flags separadas de UI, descoberta e ingressos; rollback fácil.

## 5. Capacidades por jogo — dados, não suposições

A partir de `games.registry.ts`, `GameModule.isAvailableOffline` significa apenas executável sem Internet. Propor **metadado dedicado** ou registro separado como `gameModes: { sharedDevice: available|unavailable; lan: available|comingSoon|unsupported; solo: available|unavailable }` com estado independente de `status`. O adapter/feature gate real decide `lan: available`; rótulos visuais nunca habilitam protocolo sozinhos.

| Jogo | No mesmo celular (atual) | Cada um no seu via Room v2 | Plano |
| --- | --- | --- | --- |
| Impostor da Palavra | Preservar fluxo offline atual | **Não implementado** | Primeiro adapter LAN real após descoberta/gates |
| Adedonha | Preservar o fluxo próprio já existente; revisar sua interação por participante | **Não integrado à Room v2** | Segundo adapter LAN real |
| Terceiro jogo | Conforme catálogo/função existente | **A definir e implementar** | Escolha explícita do proprietário antes de anunciar |
| Demais jogos do catálogo | Preservar modos atuais | **Não anunciar como disponível** | Expansão posterior |
| `toy`/`counter` | Testes sintéticos | Experimentos aprovados PL-03 | Nunca visíveis na seleção de jogos reais |

**Atenção:** modo `sharedDevice` significa **um dispositivo entre várias pessoas**; não equivale a `solo`. Para segredos no celular compartilhado: revelar uma pessoa de cada vez, ocultar automaticamente, bloquear toque acidental, impedir voltar à carta de outro jogador, respeitar leitor de tela e estado de fundo. Para LAN: tela/segredo próprio por participante, estados iguais sob host autoritativo; nunca reutilizar a store do jogo compartilhado como verdade LAN.

## 6. Critérios de aceitação UX e testes

- Tela `/` mostra catálogo ao abrir com ou sem flag experimental; ações Entrar/Criar e, com Room ativa, Voltar à sala; regressão de favoritos, recentes, anúncios e `GameCard`.
- Card de jogo indica somente modos suportados; nenhum falso suporte LAN. Impostor e Adedonha continuam jogáveis no modo atual durante evolução.
- Entrar em sala mostra descoberta automaticamente; salas com nome, ocupação e estado; lista não exibe tokens; tap entry sem campo de senha. Estado vazio mostra QR e seis dígitos.
- Código aceita zeros à esquerda, rejeita entradas inválidas, trata colisão e sala expirada; sem descoberta, alerta que código sozinho não localiza endpoint.
- Autorização: sala anunciada não é confiança; ingressos falsificados/duplicados/lotados/replays/versões antigas rejeitados; isolamento privado e host-role preservados.
- Dois Android físicos (S23/S25 FE): mesma Wi-Fi sem WAN, e hotspot quando aplicável; simular descoberta bloqueada, falha de anúncio, quedas, retomar Room, troca toy→lobby→counter e ingresso por QR. Terceiro Android antes de afirmar 3-player físico.
- UI responsiva 320/375/430/768, TalkBack manual, navegação por teclado/controle quando aplicável, touch targets, `prefers-reduced-motion`. Medir tempo até encontrar sala, passos até entrar e falhas de descoberta; não inventar SLA.
- **Release gate:** nenhum código/rota/debug discovery em build padrão sem liberação; testes `npm test`, `typecheck`, `lint`, Build Android/JUnit, evidência física, privacidade logs, git diff check.

## 7. Limites e questões pendentes

- Identificar **terceiro jogo real** e confirmar min/max e UX por modo.
- Acordar protocolo de ingresso LAN sem senha em ambiente de descoberta não confiável **antes de escrever código WSS/NSD**.
- Escolher modelo de cópia e indicadores visuais de sala ocupada/em jogo; host pode configurar entrada livre/bloqueada? Requer decisão posterior, não pressupor autorização silenciosa em salas privadas.
- Decidir se code entry filtra somente salas anunciadas e quando oferecer retries/diagnóstico de rede. Recomendação: código é filtro LAN; QR é fallback completo.
- Este documento **não** autoriza alteração do app nesta etapa; implementação futura em gates controlados.

## 8. Referências de projeto

- Base funcional: `docs/lan-pl03-lobby-physical-2026-10-12.md` — 12/12 etapas em S23 + S25 FE; `npm test` 537/537, Android JUnit 37/37, Release sem probe.
- Arquitetura: `docs/multiplayer-persistent-lobby-spec.md` e `docs/superpowers/plans/persistent-lobby-technical-design.md`.
- UI atual: `src/features/hub/HubScreen.tsx`, `GameCard.tsx`, `src/app/routes.tsx`, `src/features/multiplayer/lan/lobby/`.
- Identidade: logo `public/assets/brand/galerows-logo.svg` e `src/features/landing/`.

## 9. Padrões profissionais que informam a proposta (sem copiar UI)

- **Among Us:** criação/encontro de salas e sinalização de estado/ocupação; adaptar descoberta local e cards legíveis, não transplantar regras nem interface.
- **Jackbox:** entrada social simplificada, código visual curto e clareza sobre papel do anfitrião; **diferente do Jackbox, aqui não há servidor na Internet** e seis dígitos exigem descoberta local.
- **Heads Up!:** um telefone viabilizando participação em grupo, com feedback rápido e passagem física de dispositivo; preservar a opção sem LAN.
- **Galerows:** linguagem própria de cartas e jogos sociais, cores/logo da `/inicio`, pouco texto por tela, um CTA principal, microfeedback e respeito a movimento reduzido.

Essas são referências de padrões de UX, não dependências de terceiros nem evidência de implementação.
