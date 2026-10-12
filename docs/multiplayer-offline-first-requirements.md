# Galerows — Requisitos multiplayer offline-first

Status: direção de produto aprovada em 11/10/2026; viabilidade técnica e implementação pendentes.

## Objetivo

Permitir partidas multiplayer entre celulares próximos SEM internet, inclusive na rua e sem roteador: um aparelho cria/hospeda a sala e outros entram. Preservar também salas online via internet e jogos solo/offline existentes.

## Distribuição e participação — decisão fechada

- O Galerows é exclusivamente um aplicativo mobile para Android (Google Play) e iOS (Apple App Store), desenvolvido com Capacitor.
- Cada participante deve ter o aplicativo instalado em seu próprio celular para participar da sala multiaparelho.
- Navegador, página web para convidados, PWA e servidor HTTP para entregar uma interface web aos participantes estão **fora do escopo**.
- QR Code e código de sala são mecanismos de convite/descoberta **dentro do aplicativo**; não representam acesso por navegador.
- O propósito são jogos sociais presenciais entre pessoas no mesmo ambiente, usando celulares como apoio à brincadeira; não há matchmaking público nem requisito de jogar com desconhecidos ou remotamente.
- Salas online são uma opção futura de transporte para grupos presenciais quando houver internet, não a experiência principal. A possibilidade de participantes remotos não é requisito do MVP.

## Ordem de integração dos jogos — decisão de 11/10/2026

- **Primeiro jogo multiplayer: Impostor da Palavra**, substituindo Adedonha como primeiro consumidor real do núcleo compartilhado.
- **Segundo jogo: Adedonha (Stop)**, para verificar reutilização sem duplicar runtime, protocolo, salas, transporte ou reconexão.
- Esta escolha altera somente a ordem dos `GameAdapters`, integrações de UI e testes de jogo; **não altera nem descarta** a infraestrutura LAN, os contratos `AuthoritativeRoomRuntime` / `RoomTransport` / `ClientReplica` ou as validações da Fase 4A.
- Os modos offline/single-device atuais devem permanecer funcionais; multiplayer é opcional e adicional.
- Antes de implementar o `GameAdapter` do Impostor, auditar e fechar a regra funcional existente de seleção/fila de impostores e o fluxo de distribuição de palavras/papéis, sem inventar mudanças nas regras locais.
- A autoridade determina os papéis e palavras; cada participante recebe somente sua projeção privada. Exigir testes de isolamento de segredos, reconnect, snapshots, barreiras/rodadas e ausência de vazamento por logs e telas.
- O primeiro jogo só começa após os gates de conectividade e integração do transporte com o núcleo comum; **a Fase 4A continua restrita ao transporte LAN**, sem implementação de jogo neste momento.
- Esta decisão atualiza a prioridade do roadmap histórico `docs/multiplayer-architecture.md`: referências a Adedonha como primeira integração, Impostor como segunda e fases online-first não representam mais a ordem de execução aprovada.

## Cenários obrigatórios

1. Mesma rede Wi-Fi: dispositivos jogam mesmo quando a rede não tem acesso à internet.
2. Sem roteador disponível: permitir que um celular disponibilize conectividade local (por hotspot ou tecnologia P2P compatível) e os demais ingressem, sem depender de dados móveis.
3. Online (complementar, futuro): grupos presenciais podem usar um backend como transporte quando houver internet; partidas entre jogadores remotos não são requisito do produto.
4. Queda de internet: partida LAN não deve depender de serviços remotos para criar, jogar ou concluir; partida online requer política própria de reconexão.
5. QR/código de sala: facilitar entrada, mas validar o canal de descoberta e as permissões por plataforma; QR não substitui a conexão.

## Diretrizes arquiteturais

- Reutilizar `AuthoritativeRoomRuntime`, `GameAdapter`, `RoomTransport` e `ClientReplica` já implementados; não duplicar engine por modo.
- LAN: host no aparelho; online: autoridade no backend.
- Não depender de Supabase, autenticação remota ou APIs de internet no fluxo LAN.
- Descoberta e transporte são responsabilidades distintas; prever conexão manual por endereço/código como fallback quando tecnicamente viável.
- Proteger estado privado por jogador, validar comandos na autoridade, definir reconexão, encerramento da sala e ausência de migração automática de host na primeira versão.
- Android e iOS exigem validação em aparelhos físicos, inclusive permissões, isolamento de clientes em hotspot, descoberta e limitações de execução em segundo plano.
- Bluetooth/BLE: reabrir a exclusão anterior para estudo de viabilidade; NÃO assumir suporte multiplataforma nem escolher Bluetooth como transporte obrigatório antes de protótipo técnico.
- Wi-Fi Direct: candidato a avaliar, não requisito de implementação universal; suporte e interoperabilidade variam por plataforma.

## Ajuste de prioridade proposto

Antes de contratar ou implementar o backend online da Fase 4, realizar spike de conectividade local em dispositivos físicos e definir a estratégia LAN/hotspot. Replanejar Fase 4 em gates independentes (LAN discovery/transport e online authority/transport), sem descartar o trabalho já concluído nas Fases 1–3. A ordem final depende do resultado do spike.

## Critérios mínimos de aceite

- Dois ou mais celulares entram na mesma sala sem internet e jogam uma partida completa.
- Funciona em Wi-Fi local sem internet e em ao menos um cenário sem roteador, documentando aparelhos e versões testadas.
- Reconnect e isolamento de estado privado validados; host desconectado encerra ou suspende sala com mensagem clara.
- O modo offline solo existente não sofre regressão.
- Modo online mantém plano separado e compatível com os mesmos contratos.

## Limites

Documento de requisitos e planejamento. Nenhum transporte LAN, hotspot, Bluetooth ou backend foi implementado por esta decisão. Alterar o status da Fase 4 somente após testes reais.


## Atualização de produto — Sala persistente multi-jogos (11/10/2026)

Após os testes físicos da UI LAN experimental da Task 6 (S23/S25 FE, hotspot sem WAN), foi aprovada a direção de **uma Room persistente com lobby e múltiplas GameSessions sequenciais**, sem reconectar nem trocar playerId entre jogos. A sala persiste somente enquanto o host mantém a autoridade; a V1 não terá host migration automática. O anfitrião escolhe o jogo, e cada GameAdapter respeita suas regras e mínimos/máximos de participantes. Primeiro Impostor da Palavra, depois Adedonha. Descoberta de salas próximas é desejada, mas requer spike separado e fallback QR/manual; nunca substitui autenticação/ingresso com canal TLS pinado. O status histórico no topo deste arquivo antecede as Tasks 1–6; **não** indica que a UI experimental ainda não exista. Referências: `multiplayer-persistent-lobby-spec.md`, `superpowers/plans/2026-10-11-persistent-lobby-roadmap.md` e `lan-task6-physical-gate-evidence.md`. **Ainda não foi implementado lobby multi-jogos ou descoberta; Release permanece pendente.**
