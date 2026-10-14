# Operação Infiltrado — protótipo visual v2

Protótipo isolado para revisar a experiência do Impostor da Palavra no celular de cada jogador. **Não usa LAN real** nem altera a sala atual.

## Prévia

- Lobby: http://127.0.0.1:4179/__prototype/impostor-room
- Jogo: http://127.0.0.1:4179/__prototype/impostor-game
- Resultado: http://127.0.0.1:4179/__prototype/impostor-result

Para outro servidor: VITE_APP_PREVIEW=1 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort

As rotas existem somente em desenvolvimento. Nenhuma rota LAN ativa foi substituída.

## Roteiro de revisão

1. Lobby: o anfitrião escolhe modo do impostor, tipo de conversa e cronômetro. Em Explorar protótipo, use Simular todos prontos, depois Iniciar partida. A contagem 3-2-1 conduz à tela do jogo.
2. Identidade: o jogo não tem cabeçalho grande nem logo. A carta começa oculta, pode ser revelada e ocultada repetidamente até a votação.
3. Aviso coletivo: em Explorar protótipo, use Simular todos visualizaram. A instrução de dicas aparece sem retirar a carta; o anfitrião pode iniciar o cronômetro e liberar a votação. Convidados aguardam.
4. Voto: selecione um suspeito e confirme. Depois aparece o estado aguardando demais participantes. Em Explorar protótipo, use Simular os demais votos e mostrar resultado.
5. Resultado: exibe vencedor e pontuação fictícia; Nova rodada e Voltar ao lobby estão disponíveis.
6. Variantes: na área Explorar protótipo alterne anfitrião/convidado e agente/impostor. O modo palavra alternativa nunca denuncia o impostor.

## Limitações e decisões antes do motor real

- O anfitrião da Room deve sincronizar a transição e a contagem 3-2-1 para todos os celulares, sem carregar jogo no lobby.
- A confirmação de visualização da identidade deve ocorrer uma única vez por jogador. O segredo fica disponível para consulta até a votação, é ocultado ao perder foco ou conexão e nunca é exposto no estado público.
- O motor LAN atual registra uma única acusação por comando do anfitrião. **Voto individual por cada celular ainda não foi implementado**: exige comandos autenticados por jogador, idempotência, contagem de votos, regra de empate, estado de espera e resultado só ao completar todos os votos.
- O jogo LAN atual concede ao impostor encontrado uma última chance de acertar a palavra. Confirmar a decisão de manter ou retirar essa regra antes da integração, pois afeta vitória e pontos.
- O cronômetro atual é exclusivamente demonstrativo, local. Na LAN precisa ser derivado do estado autoritativo do host.
- Pontos fictícios seguem o motor atual: +1 para não impostores quando o grupo vence, +2 para o impostor quando vence, sem persistência.
- Sem rede, certificado, QR, votos reais, time-sync, engine de jogo ou novas dependências. As rotas de protótipo ficam fora do build de produção.

Sem commit, push, deploy, instalação de APK ou mudanças na branch principal.

## Cidade Dorme — prévia temática

- Rota de desenvolvimento: `http://127.0.0.1:5188/__prototype/cidade-dorme` (iniciar com `VITE_APP_PREVIEW=1 npm run dev -- --host 0.0.0.0 --port 5188 --strictPort`).
- Crie a sala e use **Explorar protótipo** para adicionar três jogadores simulados. Escolha Cidade Dorme, ajuste os mesmos quatro controles de papéis do lobby LAN, salve, marque seu pronto e simule os demais prontos.
- Quando todos estão prontos, a contagem local de cinco segundos começa automaticamente; o anfitrião pode pará-la e reiniciá-la. Depois do anoitecer, cada perspectiva recebe somente seu snapshot privado. Revele e confirme o papel; simule as confirmações e ações dos outros participantes pelos controles de prévia.
- A partida usa `AuthoritativeRoomRuntimeV2` e o adapter real `cidadeDormeLanGame` em memória. Fases, ações noturnas, sigilo, votos, vitória, pontos e retorno à mesma sala vêm dessas regras. Não há QR, convite válido, socket, sincronização entre aparelhos nem dados persistidos; o código `CD 04` é ilustrativo.
- A transição usa CSS de opacidade e transformação, com alternativa suave em `prefers-reduced-motion`. A carta é ocultada ao trocar de perspectiva ou ao perder foco.
- A rota é carregada apenas quando `import.meta.env.DEV` está ativo e não substitui a tela LAN existente.
