# CITY-AUTOPILOT-PHYSICAL-01 — teste físico LAN com voz Lucas (15/10/2026)

## Ambiente e integridade
- Repositório/worktree: `/Users/renanxavier/Documents/GitHub/galerows-city-orchestration`
- Branch: `feat/cidade-dorme-auto-orchestration-01`, HEAD da execução `ab23190`
- App de teste: `com.galerows.app.secureprobe`, variante `assembleSecureProbe`, APK ~12 MB.
- Sem modificar, desinstalar ou limpar os aplicativos Live (`com.galerows.app`, `com.galerows.app.lanlive` ou `com.galerows.app.lanpilot`).
- Build Vite com flags LAN, Capacitor sync e Android Gradle/Java 21: PASS. `android/capacitor.settings.gradle` gerado foi restaurado; worktree limpa antes dos testes.
- Aparelhos via ADB: Samsung S23 (anfitrião, rede `192.168.0.94/24`), Samsung S26 FE (participante, `192.168.0.95/24`), Moto G6 (participante, `192.168.0.91/24`) e emulador Android 13 (participante em NAT `10.0.2.16`).
- Portas de processos preexistentes 4182 e 4183 preservadas.

## Admissão e rede
- S23 criou Room por UI; S26 FE encontrou a sala por anúncio na rede local.
- A primeira tentativa de entrada por descoberta/código do S26 FE **falhou** com mensagem genérica de transporte (requer investigação; descoberta não implica admissão segura).
- A primeira tentativa com a imagem do QR retornou **convite expirado**, portanto o QR foi renovado no S23.
- Após a renovação, a entrada pelo **QR assinado** passou para S26 FE, Moto G6 e emulador, sem expor valores de convite ou tokens em logs.
- A imagem do QR do anfitrião foi apresentada ao `LanQrScanner` como **fluxo de câmera sintético via WebView** (Canvas captureStream) para permitir automação CDP. Isso valida decodificação/convite/transporte/admissão real; **não valida a câmera óptica física**.
- Todos os quatro chegaram ao mesmo lobby com 4/4 prontos e configuração Cidade Dorme: condução automática, 1 Assassino, Médico e Detetive habilitados, Coringa desabilitado e revelação do papel ao morrer desabilitada.

## Partida real completa — PASS com ressalvas
Ações foram disparadas pelos botões e interfaces dos WebViews reais via CDP. **Não foram efetuadas chamadas diretas ao reducer/servidor**.
1. Partida iniciada no S23 por toque injetado pelo protocolo de entrada da WebView (não por `.click()` em JavaScript). Quatro aparelhos chegaram à identidade secreta.
2. O `Audio.play()` inicial do S23 resolveu e o arquivo `01_identidade.mp3` foi reproduzido. Nas três telas convidadas, nenhum arquivo de narração foi instanciado/reproduzido.
3. Todos os quatro revelaram/confirmaram seus papéis no próprio cliente. Identidades e atribuição de papéis não foram salvas nem impressas.
4. Primeira noite: Assassino escolheu Médico; Médico protegeu um Cidadão; Detetive investigou Assassino e confirmou pista privada. Todos chegaram ao mesmo amanhecer. Sequência de áudio encerrada no anfitrião: `01_identidade`, `02_cidade_dorme`, `03_assassino`, `04_volte_dormir`, `05_medico`, `04_volte_dormir`, `06_detetive`, `07_pista`.
5. Médico foi eliminado no amanhecer **sem papel público revelado**; a narração de morte ocorreu. A discussão encerrou automaticamente no intervalo configurado.
6. Três sobreviventes votaram individualmente nos seus próprios aparelhos; o Médico morto **não recebeu ações de voto**. O servidor decidiu empate público, seguido da segunda noite. Áudio `11_discussao`, `12_votacao`, `13_empate` concluído no S23.
7. Segunda noite: Assassino escolheu Cidadão. A fase do Médico eliminado **permaneceu presente** nos quatro dispositivos; o celular do Médico mostrou apenas modo espectador e nenhum botão de proteção.
8. O host reproduziu `04_volte_dormir.mp3` + `05_medico.mp3`, aguardou aproximadamente **14 s** e avançou automaticamente sem proteção inventada.
9. O Detetive vivo investigou normalmente, recebeu/confirmou pista privada; todos chegaram ao segundo amanhecer.
10. Encerramento por vitória dos assassinos: os quatro exibiram o mesmo resultado; `15_fim.mp3` concluiu no S23, sem reprodução nos convidados.

## Evidências
- Monitoramento via WebView CDP dos eventos `Audio.play()` (promessa resolvida) e `ended` no S23; nenhum registro de áudio nos três convidados. Isso comprova fluxo técnico, **não equivale a confirmar volume/clareza percebidos por ouvinte humano**.
- Sem alertas de UI nas etapas verificadas.
- Processos `com.galerows.app.secureprobe` ativos nos quatro aparelhos no fim.
- Amostra recente do `logcat`: nenhum `FATAL EXCEPTION` observado, porém não é auditoria integral desde o boot.
- A comparação final da pontuação/placar **não foi concluída**: na consulta seguinte, as quatro telas já haviam retornado ao início de uma nova partida; não se atribuiu a mudança a nenhum ator sem evidência.

## Gate
- **PASS (limitado)**: partida LAN ponta a ponta de quatro participantes, host participante, narração Lucas offline no host, fases secretas, voto individual, empate, segunda noite, papel eliminado simulado, resultado final sincronizado.
- **PENDENTE**: caminho de admissão por descoberta/código após a falha inicial, câmera física QR, comparação final de placar, reconexão durante partida, interrupção e retomada de áudio real, Wi-Fi/hotspot e comportamento ao apagar a tela, quatro celulares físicos (4º foi emulador).
- **RISCO DE PRIVACIDADE TEMPORAL**: o turno sem ator é simulado após pelo menos 14 s, ao passo que um turno com ação real pode terminar antes; observadores podem tentar inferir a ausência do papel pelo tempo. Para sigilo forte, padronizar janelas de duração percebida ou desenhar mecanismo de confirmação com tempo uniforme para papéis vivos e eliminados; requer decisão de produto e novo teste.
- **BLOQUEIO COMERCIAL**: titularidade/licença comercial dos MP3 Lucas precisa ser confirmada antes da publicação.
- Nenhum deploy/merge/push para Live. O pacote de testes foi instalado apenas como aplicativo separado.

## Próximo gate
Reproduzir falha de conexão por descoberta/código com logging de falha categorizado e dados de rede sanitizados, sem logar token/certificado; testar a entrada com QR pela câmera física; medir duração e equalizar a cadência dos papéis antes de validar confidencialidade como concluída. Depois testar reconexão e comparar pontuação.
