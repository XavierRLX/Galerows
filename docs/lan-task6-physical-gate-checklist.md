# Galerows — Task 6: roteiro de validação física pendente

Data: 11/10/2026. **Checklist; testes não executados por este documento.** Task 7 não autorizada.

## Estado verificado pelo Remote Desktop Commander

- Branch: `feat/multiplayer-lan-task1-wss`; HEAD `fbfb342e37185470e82d1d021d05ddbb7a8e9c95`.
- Task 6: UI experimental na rota `/__lan-room`, somente com `VITE_LAN_ROOM_UI=1` e app Capacitor nativo.
- Evidências de implementação e build: `docs/lan-task6-room-ui-evidence.md`.
- ADB (na revisão): S23 `RXCX705P3JR` **device**; S25 FE `RXGL30N4F3F` **não detectado**.
- O build padrão foi restaurado sem UI experimental. Para validar, usar o APK secureProbe **devidamente recompilado com flag experimental**, ou confirmar que o artefato existente é o mesmo e está instalado. Não confundir com Release padrão. Não alterar a main/commits; preservar working tree/untracked.

## Pré-condições

1. Ambos Androids conectados ao ADB (S23 host, S25 FE guest), autorizados e com estado `device`; executar `adb devices -l`.
2. S23 hotspot ligado e S25 FE conectado a ele; desligar dados móveis/WAN quando possível e confirmar interfaces e rotas locais **em ambos**, sem default route.
3. Conferir hash do APK experimental em ambos. `docs/lan-task6-room-ui-evidence.md` registra SHA-256 `3df130e5780f29deee1d4717f72e594ecbf43cb4d0786d073273337a0a64c519`.
4. Abrir a mesma UI experimental nos dois aparelhos; cuidado para não instalar Release padrão sem a rota.

## Ensaios físicos obrigatórios da Task 6

- [ ] Host cria sala sem IP digitado manualmente, exibe endereço/porta e QR.
- [ ] Convidado lê QR pela câmera real (o usuário poderá precisar apontar fisicamente o aparelho), com permissão e limpeza da câmera.
- [ ] Comparar código presencial mostrado no S23 com o digitado no S25 FE; confirmar que não é aceito ingresso antes da confirmação.
- [ ] Handshake completo atualizado: `admitted → armazenamento → admissionAck → admissionConfirmed`, observando **Na sala** apenas no último passo.
- [ ] Convidado incrementa contador de teste; anfitrião vê atualização do estado e resultado autorizado.
- [ ] Provocar perda de socket/retorno, confirmar 1–3 tentativas e retorno ao **mesmo playerId**, com snapshot atualizado.
- [ ] Host renova convite após consumo e comprovar que token antigo não é reutilizado.
- [ ] Host encerra sala; convidado exibe encerramento definitivo, revoga credencial e não tenta retomada indevida.
- [ ] Verificar eventual erro real de câmera e fallback manual sem interpretar QR da Adedonha como convite LAN.
- [ ] Documentar falhas/observações por aparelho, horário, comandos executados, APK hash e resultado. Não incluir tokens, QR completo ou credenciais nos logs/evidências compartilhadas.

## Ressalva de produto observada na revisão

O botão **Sair** do convidado atualmente faz `LanRoomSession.disconnect()` e preserva credencial/membership no host. É desconexão voluntária retomável, **não saída definitiva do membro**. A interface não deve prometer remoção efetiva. Decidir e testar contrato de saída definitiva antes de distribuir o multiplayer aos usuários; se necessário, tratar como escopo explícito do gate posterior, sem implementar por acidente aqui.

## Conclusão do gate

Somente aprovar a Task 6 **fisicamente** depois que todos os ensaios essenciais acima passarem nos dois aparelhos. Se algum falhar, registrar diagnóstico reproduzível e corrigir apenas o bloqueio específico antes de avançar. Não iniciar Task 7 nem integrar jogos nesta verificação.
