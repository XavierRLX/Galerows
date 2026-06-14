# Roadmap do Galerows

Atualizado em: 13 de junho de 2026

## Status atual

**Fase:** segundo jogo concluído para o MVP

O Galerows já funciona como Hub mobile e possui dois jogos finalizados no escopo necessário para jogar partidas completas offline: **Nem Ferrando** e **Impostor da Palavra**. A base compartilhada de jogadores, conteúdo multilíngue e persistência local está em uso pelos dois jogos.

### Legenda

- ✅ Concluído
- 🟡 Em andamento ou parcialmente concluído
- ⬜ Planejado
- ⏸ Fora do MVP atual

## Fundação técnica

- ✅ Vite, React, TypeScript, TailwindCSS, React Router e Zustand.
- ✅ Capacitor configurado para Android e iOS.
- ✅ Safe Area, Status Bar, Splash Screen, haptics e botão voltar.
- ✅ Interface e baralhos preparados para `pt-BR`, `en-US` e `es-419`.
- ✅ Funcionamento offline sem backend, login ou dependência de rede.
- ✅ Persistência local versionada com Capacitor Preferences.

## Minha Galera

- ✅ Um grupo persistente por aparelho.
- ✅ Criação, edição, exclusão e reordenação de jogadores.
- ✅ Validação de nomes vazios e duplicados.
- ✅ Seleção parcial da galera na preparação da partida.
- ✅ Jogadores temporários que não alteram o grupo salvo.
- ✅ Limites de jogadores validados pelo jogo.

## Conteúdo offline

- ✅ Manifesto comum versionado para baralhos.
- ✅ Schemas específicos de cartas para Nem Ferrando e Impostor da Palavra.
- ✅ Baralhos separados por idioma e fallback para `pt-BR`.
- ✅ Validação de estrutura, IDs duplicados, regras editoriais e paridade das traduções.
- ✅ Área de administração habilitada somente por flag de desenvolvimento.
- ✅ Importação, validação, pré-visualização e override local de JSON.
- ✅ Conteúdo oficial empacotado e distribuído por atualização do app.

## Nem Ferrando

**Status:** ✅ Concluído para o MVP

**Critério alcançado:** um grupo consegue configurar os jogadores, iniciar, jogar e finalizar uma partida completa no mesmo aparelho, inclusive retomando a sessão após fechar o aplicativo.

- ✅ Tela inicial com objetivo e regras detalhadas.
- ✅ Preparação para 2 a 12 jogadores.
- ✅ Limites de 10, 15 ou 20 Ferros.
- ✅ Cartas com tema, valor e curiosidades numéricas.
- ✅ Numeração editorial fixa e paridade entre os três idiomas.
- ✅ Contagem de cartas e progresso de curiosidades restantes.
- ✅ Uma troca de carta por turno, sem consumir a carta trocada.
- ✅ Fila embaralhada: todas as cartas passam antes de qualquer repetição.
- ✅ Novas passagens reutilizam apenas cartas com curiosidades disponíveis.
- ✅ Jogador inicial sorteado e abertura diferente da partida anterior.
- ✅ Ordem da fila, passagem e abertura preservadas no autosave.
- ✅ Transições curtas e haptics nas ações principais.
- ✅ Seleção da curiosidade, desafio, revelação e penalidade manual.
- ✅ Resumo da rodada com pontuação atualizada antes do próximo jogador.
- ✅ Curiosidades usadas não se repetem; opções ocultas continuam disponíveis.
- ✅ Rotação de jogadores e rodadas.
- ✅ Encerramento por limite de Ferros ou fim do baralho.
- ✅ Ranking pelo menor número de Ferros, incluindo empates.
- ✅ Autosave, continuação e descarte da partida.
- ✅ Bloqueio de retomada quando a versão do baralho é incompatível.

## Impostor da Palavra

**Status:** ✅ Concluído para o MVP

**Critério alcançado:** um grupo consegue configurar jogadores, escolher modo, revelar informações secretas no mesmo aparelho, dar pistas, acusar, resolver a tentativa final do impostor, pontuar e finalizar um ciclo completo offline.

- ✅ Tela inicial com objetivo, fluxo e regras detalhadas.
- ✅ Preparação para 3 a 12 jogadores com Minha Galera e convidados temporários.
- ✅ Três modos: sem palavra, com dica e palavra diferente.
- ✅ Dois formatos de conversa: uma palavra e perguntas guiadas pelo app.
- ✅ Um impostor por rodada e cada participante como impostor exatamente uma vez por partida.
- ✅ Revelação individual com informação escondida por padrão e sem persistir visibilidade no autosave.
- ✅ Palavra, dica, palavra alternativa e perguntas carregadas por JSON offline.
- ✅ Baralho inicial com 36 palavras e 12 perguntas em `pt-BR`, `en-US` e `es-419`.
- ✅ Validação de conteúdo, referências de perguntas e paridade entre idiomas.
- ✅ Fila de palavras sem repetição dentro da partida.
- ✅ Ordem de fala sorteada e abertura variada quando possível.
- ✅ Acusação coletiva registrada no app.
- ✅ Tentativa final do impostor quando a acusação está correta.
- ✅ Pontuação automática, ranking e suporte a empates.
- ✅ Autosave, continuação, reinício com mesma configuração e descarte da partida.
- ✅ Bloqueio de retomada quando idioma ou versão do baralho é incompatível.

## Qualidade atual

- ✅ Testes de jogadores, persistência, conteúdo, admin e regras das partidas.
- ✅ Testes integrados desde a configuração até o resultado final para os jogos disponíveis.
- ✅ ESLint, TypeScript, testes e build de produção configurados.
- 🟡 Fluxos nativos ainda precisam de validação manual em aparelhos reais.
- 🟡 Textos novos de gerenciamento e partida ainda precisam de revisão final de localização e acessibilidade.

## Próximas etapas

### 1. Refinar o Impostor da Palavra em testes presenciais

- ⬜ Validar se os três modos têm ritmo e dificuldade adequados.
- ⬜ Ajustar palavras, dicas, alternativas e perguntas com base em partidas reais.
- ⬜ Avaliar se votação secreta, temporizador ou mais formatos de conversa entram depois.
- ⬜ Revisar traduções com falantes dos três idiomas.
- ⬜ Medir se a pontuação 2/1 mantém a disputa equilibrada.

### 2. Validar o MVP em aparelhos

- ⬜ Testar Android e iOS reais, incluindo safe areas e botão voltar.
- ⬜ Revisar contraste, foco, leitores de tela e tamanhos de toque.
- ⬜ Fazer sessões presenciais e ajustar ritmo, regras e quantidade de cartas.
- ⬜ Revisar traduções com falantes dos três idiomas.
- ⬜ Criar ícone e splash screen definitivos.

### 3. Ampliar o conteúdo dos jogos

- ⬜ Produzir um baralho inicial maior para o Nem Ferrando.
- ⬜ Revisar fontes e precisão das curiosidades antes da publicação.
- ⬜ Ampliar o baralho do Impostor da Palavra com categorias e palavras testadas em mesa.
- ⬜ Definir um processo editorial para versões e traduções dos baralhos.
- ⬜ Adicionar categorias ou filtros somente se os testes indicarem necessidade.

### 4. Distribuição externa

- ⬜ Definir versões mínimas de Android e iOS.
- ⬜ Configurar builds assinados e pipeline de CI.
- ⬜ Preparar política de privacidade e informações das lojas.
- ⬜ Distribuir pelo Google Play Internal Testing e TestFlight.

## Fora do MVP

- ⏸ Login e contas.
- ⏸ Backend e sincronização entre dispositivos.
- ⏸ Multiplayer online.
- ⏸ Pagamentos, anúncios e assinatura premium real.
- ⏸ Download remoto de baralhos.
- ⏸ Versão web pública ou PWA.
