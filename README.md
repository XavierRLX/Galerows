<div align="center">
  <img src="public/icon-galerows.webp" alt="Ícone do Galerows" width="100" />
  <h1>Galerows</h1>
  <p><strong>Jogos sociais mobile, offline-first e feitos para reunir pessoas.</strong></p>
  <p>Aplicativo desenvolvido em React + TypeScript, distribuído em builds nativos com Capacitor.</p>
</div>

---

## O projeto

O **Galerows** é um catálogo de jogos para encontros presenciais. O problema de produto é simples: permitir que um grupo comece uma partida rapidamente, sem cadastro obrigatório ou dependência de um servidor para os jogos locais.

Além das interfaces, este projeto explora persistência de partidas, regras de domínio testáveis, conteúdo versionado e uma arquitetura experimental de partidas entre aparelhos na rede local (LAN).

**Público-alvo:** pessoas que querem jogar presencialmente usando o celular, com configuração de participantes e jogos de palavras, dedução e desafios.

## Principais capacidades

| Área | Implementação |
| --- | --- |
| **Hub de jogos** | Catálogo e navegação mobile-first com telas específicas por jogo |
| **Minha Galera** | Cadastro local de participantes reutilizáveis e seleção para partidas |
| **Partidas offline** | Regras executadas no dispositivo, sem precisar de backend para as partidas locais |
| **Continuidade** | Persistência local e retomada dos fluxos que oferecem autosave |
| **Conteúdo** | Baralhos e definições organizados por jogo, com verificações de consistência |
| **Plataformas** | Código web em Vite/React e projetos nativos Android/iOS via Capacitor |
| **LAN experimental** | Componentes de comunicação e sala em rede local, com evidências técnicas e critérios de validação separados |

O código contém módulos de jogos como **Impostor da Palavra**, **Nem Ferrando**, **Cidade Dorme**, **Pista Única**, **Mímica**, **Adedonha** e outros. A presença de um módulo no catálogo **não significa** que todos os modos estejam lançados ou homologados para publicação.

## Stack técnica

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, TypeScript, Vite, Tailwind CSS |
| Navegação e estado | React Router, Zustand |
| Mobile | Capacitor 8, Android e iOS |
| Persistência | Capacitor Preferences e dados locais |
| Conteúdo e localização | JSON versionado, i18next |
| Rede local | Componentes nativos Android e protocolos LAN documentados |
| Qualidade | Vitest, Testing Library, ESLint, TypeScript |

### Organização por responsabilidades

```text
src/
├── app/                  # Entrada, rotas e inicialização
├── components/           # Elementos de UI reutilizáveis
├── features/
│   ├── hub/              # Catálogo e experiência inicial
│   ├── players/          # Minha Galera
│   ├── multiplayer/      # Contratos e implementação LAN
│   ├── impostor-da-palavra/
│   ├── cidade-dorme/
│   ├── pista-unica/
│   └── ...               # Outros jogos e recursos
├── i18n/                 # Internacionalização
├── lib/                  # Capacitor, persistência e utilitários
└── test/                 # Infraestrutura de testes
```

As regras de cada jogo ficam organizadas em módulos específicos, reduzindo o acoplamento entre telas, estado persistente e transições de partida. Em jogos que usam store, a UI não deve ser a fonte das regras de negócio.

## Como executar

**Pré-requisitos:** Node.js e npm compatíveis com o projeto. Para builds nativos, instalar Android Studio/JDK e/ou Xcode conforme a plataforma.

```bash
git clone https://github.com/XavierRLX/Galerows.git
cd Galerows
npm ci
```

**Abrir a landing no navegador:**

```bash
npm run dev
```

**Abrir a experiência do aplicativo no navegador para desenvolvimento:**

```bash
VITE_APP_PREVIEW=1 npm run dev
```

O build nativo abre o aplicativo independentemente dessa flag. Consulte [documentação da landing](docs/landing-page.md) e [exemplo de configuração](.env.example). Não é necessário copiar credenciais reais para desenvolver os fluxos offline.

### Qualidade e build

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

O comando de build também executa as verificações de conteúdo definidas no `package.json`.

Para sincronizar a versão web com o projeto Android:

```bash
npm run cap:android
```

A configuração da distribuição nas lojas, assinatura de artefatos e declaração de privacidade exigem etapas adicionais. **Build bem-sucedido não equivale a aprovação em loja nem a homologação do multiplayer.**

## Decisões de engenharia

1. **Offline-first:** partidas locais não precisam de login, API remota ou infraestrutura permanentemente disponível.
2. **Estado e regras separados:** módulos específicos organizam inicialização, transições e persistência.
3. **Conteúdo como dado:** catálogos e baralhos são versionados e possuem validações automatizadas.
4. **LAN com autoridade explícita:** a arquitetura diferencia a lógica da sala, o transporte, a identidade dos participantes e a projeção de estado privado.
5. **Qualidade mobile:** atenção a safe areas, navegação, interação por toque e testes em dispositivos físicos.

### Multiplayer: escopo e evidências

A evolução LAN é incremental. Foram documentados testes de comunicação nativa e fluxos de lobby entre aparelhos Android, mas isso não constitui, isoladamente, certificação de todas as partidas multiplayer ou das plataformas.

- [Requisitos offline-first da LAN](docs/multiplayer-offline-first-requirements.md)
- [Arquitetura multiplayer e histórico de decisões](docs/multiplayer-architecture.md)
- [Evidência de validação do lobby em Android](docs/lan-pl03-lobby-physical-2026-10-12.md)
- [Checklist para teste interno na Play Console](docs/play-console-internal-test.md)

## Estado do produto

**Projeto em desenvolvimento e validação.** O repositório disponibiliza o código e a documentação técnica; a disponibilidade de builds nas lojas depende das etapas de distribuição e testes. Consulte o histórico de commits e os relatórios específicos para avaliar cada recurso.

O [ROADMAP.md](ROADMAP.md) conserva uma referência histórica de escopo; não deve ser interpretado sozinho como o estado atual de todos os módulos.

## Licença

Código disponibilizado sob a [licença MIT](LICENSE). Marcas, imagens, trilhas, vozes e outros materiais de terceiros podem possuir condições próprias de uso; a licença do código não transfere automaticamente direitos sobre esses assets.

