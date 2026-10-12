# Galerows — identidade visual

Identidade aprovada em 11/10/2026. Esta é a referência para novas aplicações da marca.

## Conceito

O G de Galerows forma a carta da frente. A carta deslocada atrás representa a dinâmica de jogar em grupo. A assinatura é `galerows.` em minúsculas, acompanhada de `JOGOS DA GALERA`. A finalização vetorial interpreta a proposta aprovada com geometria consistente e cores chapadas; a imagem gerada permanece apenas como referência histórica.

## Cores

| Cor | HEX | Uso |
| --- | --- | --- |
| Carvão | `#101014` | Fundo principal e símbolo sobre lavanda |
| Verde-lima | `#D2F86A` | G, ponto da assinatura e destaques |
| Lavanda | `#B8A0FF` | Carta traseira e fundo do ícone do app |
| Branco quente | `#F5F3EF` | Assinatura e textos sobre fundo escuro |

Não acrescentar brilho, gradientes, textura, contornos ou sombras dentro da marca. Não distorcer, girar o conjunto, reorganizar as cartas ou substituir as cores individualmente. Sobre fotografias, usar uma superfície sólida de apoio.

## Tipografia

Bricolage Grotesque 800 para a assinatura e títulos; DM Sans 400/700 para textos e a assinatura secundária. As fontes e licenças OFL estão em `public/assets/fonts`. Os SVGs da marca têm letras convertidas em caminhos e não dependem de fontes instaladas. Não redigitar a assinatura em outras fontes.

## Arquivos oficiais

Todos em `public/assets/brand`:

- `galerows-logo.svg`: assinatura completa para fundo escuro.
- `galerows-logo-dark.svg`: assinatura em carvão para fundo claro.
- `galerows-logo-light.svg`: assinatura em branco quente.
- `galerows-mark.svg`: símbolo bicolor isolado.
- `galerows-mark-dark.svg` e `galerows-mark-light.svg`: símbolos monocromáticos.
- `galerows-app-icon.svg`: símbolo carvão sobre fundo lavanda.
- `galerows-app-icon-1024.png`, `-512.png` e `-192.png`: exportações opacas.
- `galerows-maskable-512.png`: versão com margens próprias para máscara.
- `galerows-adaptive-foreground.svg`: camada frontal Android transparente.

O favicon é `public/favicon.svg`, com apenas a carta G para leitura em tamanhos mínimos. Os PNGs de fallback estão na pasta da marca. `public/icon-galerows.webp` foi atualizado para compatibilidade com referências antigas.

## Margens e tamanhos

Manter espaço livre mínimo de 1/8 da largura do símbolo ao redor da marca, além das margens internas do arquivo. A assinatura completa deve ter pelo menos 174 px de largura em interfaces; abaixo disso, usar o símbolo. Preferir símbolo completo a partir de 24 px e favicon simplificado em 16 px. Não usar o slogan isoladamente como ícone.

O ícone do app tem fundo lavanda opaco. Não desenhar cantos arredondados no arquivo iOS: a máscara pertence ao sistema. Android usa camadas de fundo e primeiro plano e inclui versão monocromática para ícones temáticos. O primeiro plano foi medido: raio máximo aproximado de 31,35 dp dentro da zona segura circular de 33 dp, em canvas de 108 dp.

## Aplicações entregues

- Landing: cabeçalho, rodapé e símbolo na prévia do celular.
- App: ícone no cabeçalho do catálogo.
- Web: favicon, apple-touch-icon e manifesto com versões comuns e maskable separadas.
- Android: cinco densidades de ícones comuns, circulares, adaptativos e monocromáticos; telas de abertura e configuração do splash moderno.
- iOS: AppIcon 1024 × 1024 sem canal alpha e imagens de abertura.

As cores próprias dos jogos e os fluxos do aplicativo permanecem independentes da marca institucional.

## Atualização reproduzível

A fonte de geometria, cores, composição e exportação é `scripts/generate-brand-assets.mjs`.

```sh
npm ci
npm run brand:generate
npm run build
```

O gerador usa Sharp e OpenType.js como dependências de desenvolvimento. Produz SVGs com tipografia em curvas, PNGs e WebP, recursos nativos e `docs/brand/identidade-final.png`. Não editar exportações raster manualmente. Depois de gerar e validar, incluir fontes e exportações no mesmo commit.

Para levar a atualização ao aplicativo instalado, gerar/sincronizar o bundle web e recompilar no fluxo normal Android/iOS. A alteração dos arquivos não atualiza automaticamente apps já instalados ou listagens das lojas.

## Validação

- Build web e TypeScript aprovados.
- 7 testes da landing e do catálogo aprovados, além dos testes de conteúdo executados pelo build.
- Marca carregada no cabeçalho e rodapé do navegador.
- Ícone iOS conferido: 1024 × 1024, opaco, sem alpha.
- Primeiro plano Android conferido: 432 × 432 em xxxhdpi, transparente e dentro da zona segura.
- Prancha final inclui versões em uma cor e reduções de 16, 24, 32 e 48 px.
- Compilação nativa Android não executada: revisão automática de aprovação falhou por limite de uso. Não houve reprovação de segurança.
- Build iOS e instalação em dispositivos físicos não realizados nesta alteração.

Referências técnicas: [Android adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive) e [Apple asset catalogs](https://developer.apple.com/documentation/xcode/configuring-your-app-icon).
