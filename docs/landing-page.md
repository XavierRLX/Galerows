# Landing page Galerows

A página pública apresenta o aplicativo para iPhone e Android. O navegador abre a landing; o Capacitor continua abrindo o aplicativo atual. Nenhuma rota dos jogos foi alterada.

## Desenvolvimento

- Landing: `npm run dev`
- Aplicativo no navegador para desenvolvimento: `VITE_APP_PREVIEW=1 npm run dev`
- Build: `npm run build`
- As flags locais de diagnóstico LAN também preservam a entrada do aplicativo em desenvolvimento.

## Publicar os downloads

Configure `VITE_APP_STORE_URL` e `VITE_GOOGLE_PLAY_URL` com os links HTTPS oficiais e gere um novo build. A configuração fica em `src/features/landing/landing.config.ts`. Sem URL válida, o respectivo botão fica desativado e informa “Em breve”. Os textos da página acompanham a disponibilidade de cada loja. Atualize também o título e a descrição de pré-lançamento em `index.html` no lançamento.

Não há formulário de inscrição, coleta de e-mail, avaliações inventadas ou links fictícios. A página usa o catálogo de `games.registry.ts`, preservando seus nomes, descrições e quantidades de participantes. O celular do hero é identificado como prévia ilustrativa. A política de privacidade existente permanece acessível.

## Direção de design e marketing

Proposta: um app de jogos presenciais que transforma encontros em partidas de mímica, palavras e dedução. Linguagem brasileira, informal e centrada na dinâmica do grupo. A página progride da proposta e expectativa de lançamento para catálogo filtrável, contexto de uso, respostas às dúvidas e downloads.

Visual: mesa de cartas contemporânea; fundo carvão, roxo e verde-lima, capas originais do projeto, cartas sobrepostas, tipografia Bricolage Grotesque e DM Sans hospedada localmente com licenças OFL. A nova identidade aprovada usa o G em cartas sobrepostas, com assinatura vetorial no cabeçalho e rodapé. As imagens dos jogos foram preservadas. Consulte `docs/brand/identidade-visual.md`. Animação apenas de entrada e interações, respeitando redução de movimento.

Referências consultadas e aplicadas nesta criação (não instaladas globalmente):

- UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill — composição de showcase, profundidade das cartas, hierarquia, contraste, foco e responsividade. Consulta do gerador: `social card gaming vibrant`; adaptada ao contexto social do produto.
- Marketing Skills / Copywriting: https://github.com/coreyhaines31/marketingskills/tree/main/skills/copywriting — benefício concreto, linguagem do público e textos sem provas sociais inventadas.
- Marketing Skills / CRO: https://github.com/coreyhaines31/marketingskills/tree/main/skills/cro — progressão da página, repetição contextual da ação e dúvidas sobre disponibilidade/mobile.
- Skill Sites: orientação para páginas de apresentação e validação local no repositório existente.

## Acessibilidade e desempenho

Menu com estado expandido, filtros com estado pressionado, FAQ nativo com `details`, navegação por teclado, link para pular ao conteúdo, foco visível e `prefers-reduced-motion`. Fontes e imagens são locais. Os serviços e o bundle do aplicativo não são inicializados para visitantes da landing.
