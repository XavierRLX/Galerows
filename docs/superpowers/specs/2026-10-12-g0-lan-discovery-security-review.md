# Galerows — G0: segurança e descoberta local sem atrito

**12/10/2026 · Status: REVIEW / BLOCKER G4 · Sem autorização de alteração de WSS, pinning, credenciais ou código nativo.**
Complemento à proposta `2026-10-12-games-first-g0-ux-architecture.md`; prevalecem os invariantes `docs/lan-pl03-lobby-physical-2026-10-12.md` e `docs/multiplayer-persistent-lobby-spec.md`.

## 1. Inventário verificado e limites

- `lanPersistentInvite.ts`: convite `galerows-lan-v2:`, `version=2`, `roomId`, `hostIp`, `port`, `fingerprint`, `issuedAt`, `expiresAt`, `capability`; limite 1024 bytes. **A capability é segredo** e o fingerprint do convite fornece material para pinning TLS.
- `lanPersistentGuestAdmission.ts`: `connectInvite()` chama `connectV2(hostIp, port, fingerprint, roomId, capability)` e exige `hostVerificationCode(fingerprint)` informado pelo participante; confirma ingresso com ACK; grava credencial de resume antes do ACK; `resume()` usa vault nativo e pin anterior; `leaveRoom()` não equivale a `disconnect()`.
- `LanPersistentLobbyScreen.tsx`: ingresso manual atual coleta convite longo + código presencial; UI experimental tem QR v2 legível em teste de PNG. **Não há descoberta NSD/mDNS implementada** nem credencial derivada de seis dígitos.
- `android/variables.gradle`: compile/target SDK **36** no baseline; `AndroidManifest.xml` contém INTERNET e CAMERA, não `ACCESS_LOCAL_NETWORK`. Upgrade ao target 37 altera a avaliação de permissões.
- PL-03 passou nos dois Samsung **somente conforme relatório histórico**. O relatório confirma PNG decodificado e ingresso manual automatizado; **câmera física QR pendente** no relatório.
- O sistema operacional, SSID, um TXT record e o código público **não** constituem identidade do host. Endpoints podem mudar com Wi-Fi/hotspot, reconexão e mudança de interface.

## 2. Domínios de confiança

```text
Rede Wi-Fi/hotspot (NÃO CONFIÁVEL)
 ├─ NSD/mDNS ← anúncio/TTL/ocupação/nome/IP/rede pública falsificáveis
 ├─ Código 6 dígitos ← filtro público com 10^6 possibilidades, não senha
 └─ WSS client → certificado/identidade (pin verificado de forma independente)
                      ├─ capability de convite / novo mecanismo de admissão
                      ├─ host autoritativo: join/revoke/role/phase/limite
                      └─ credencial individual de resume em Keystore
Projeções: host detém Room canônica; guest recebe público + seu próprio privado
```

**Invariantes inegociáveis em G0–G3:** não inserir `capability`, `inviteToken`, `resumeToken`, segredo do jogo, snapshots privados, assinatura de sessão privada ou chave TLS privada no anúncio; não piná-lo cegamente por fingerprint encontrado em TXT; não derivar segredo de `roomCode`; não usar conexão `ws://` ou ignorar erros TLS; não publicar host IP/token em logs/analytics; não alterar o fluxo v1.

## 3. Modelo passivo proposto de NSD/mDNS — G3, não implementado

**Android NsdManager** com DNS-SD/mDNS; anúncio opt-in somente enquanto a Room está aberta, host acessível e interface local selecionada. Tipo de serviço **candidato** `_galerows-lan._tcp`, com versionamento de contrato nos metadados (nome do service type e compatibilidade devem ser validados no G3). Endereço e porta vêm da resolução nativa do service info, associados à rede/interface correta; nunca iniciar varredura de todos os IPs ou depender da Internet.

**Exemplo conceitual de DTO público, não wire aprovado:**
```ts
type PublicLanAdvertisementV1 = {
  schemaVersion: 1
  protocolVersion: 2
  publicRoomCode: string     // string exata de 6 dígitos, inclusive 0 à esquerda
  publicRoomId: string       // identificador EFÊMERO, distinto de credencial e ID canônico
  displayName: string       // sanitizada, <= limite de bytes a definir em G3
  selectedGameId: string | null // apenas informação pública
  phase: 'lobby' | 'configuring' | 'playing' | 'results'
  members: number
  capacity: number
  advertisementEpoch: string // deduplicação/refresh, NÃO nonce de autenticação
}
```

**Detalhes importantes:** limitar tamanho de TXT/nomes, sanitizar UTF-8; o serviço NsdManager publica nome + porta; se TXT exceder limite, reduzir atributos em vez de expor estado sensível. “Último visto” é determinado pelo cache local e callback de perda, com expiração visual e `debounce`, não por relógio confiado ao TXT. Preferir eventos de descoberta + resolve/update nativos, sem polling de sub-rede. Ativar a busca ao entrar em `/salas/entrar`, pausar ao sair da tela; **host advertising** persiste com a Room (não com a view). Filtrar anúncios próprios/incompatíveis, duplicatas e interfaces obsoletas, mas **não** tratá-los como confiáveis por passarem validação de schema.

**Código público:** host gera `000000`–`999999` com CSPRNG, vida vinculada à Room; exibição `004 201`, entrada aceita espaços visuais mas valida exatamente seis dígitos, preserva zero inicial. Só filtra anúncios resolvidos no segmento de rede. Código duplicado → mostrar ambas salas com nome/ocupação/fase e exigir escolha do usuário (ainda sem autenticar nenhuma). Sem anúncio visível não há como mapear o código para IP/porta sem mecanismo extra — **não prometer lookup global offline**.

**Fallback QR:** utiliza contrato v2 atual (IP, porta, fingerprint e capability), independentemente de mDNS. É viável quando a conectividade IP host↔guest existe; se AP isolation bloquear os peers, QR identifica mas o socket ainda falha. Preservar QR original `512px`/quiet zone `4` e não confundir com QR de categorias da Adedonha. Desativar QR com fingerprint/capability vencido, renovar no host conforme política atual, nunca copiar o token para TXT.

**Android/API:** `NsdManager` é assíncrono; APIs de descoberta e updates variam com SDK Extensions. A documentação Android atual informa que antes de **T extension 7** alguns devices precisam de `WifiManager.MulticastLock` no foreground; a partir daí o Android costuma gerenciar recepção multicast em primeiro plano. Evitar lock em background sem fundamento; liberar lock/listeners com segurança. Para apps mirando **Android 17 / target 37+**, acesso à LAN passa a exigir `ACCESS_LOCAL_NETWORK` runtime, ou picker de serviços mediado pelo sistema em casos suportados. O target baseline é **36**, mas G3 deve validar a matriz real de SDK/target/permissões e UX antes de manifest. Picker não autentica o anfitrião.

**Matriz física futura:** S23 host/S25 FE guest na mesma Wi-Fi com/sem WAN; hotspot em ambos os sentidos suportados; `wlan0` e interface hotspot; sem permissão; multicast bloqueado/AP isolation; SSID alterado; IP trocado; doze/background; dois anúncios iguais/código repetido; `onServiceLost` versus card stale; IPv4/IPv6; clean-up de listener; terceiro aparelho para três private states quando disponível. Não assumir que Samsung AP anuncia multicast de forma confiável até teste.

Fontes públicas para conferir no momento de G3:
- Android `NsdManager`: https://developer.android.com/reference/android/net/nsd/NsdManager
- Android permissão de rede local: https://developer.android.com/privacy-and-security/local-network-permission
- RFC 6762 §21 (mDNS em rede adversarial e spoofing): https://www.rfc-editor.org/rfc/rfc6762.html

## 4. Threat model e decisões que precisam de aceite

| Ameaça | Ataque plausível | Defesa / teste proposto |
| --- | --- | --- |
| Host impostor | Outro aparelho anuncia “Galera do João” com mesmo código, IP próprio e fingerprint próprio | NÃO confiar no anúncio; impedir primeira associação automática a host desconhecido; provar MITM/rogue-host |
| MITM no bootstrap | Rede adversarial troca endpoint e finge primeira chave; WSS cifra ligação **com atacante** | TLS sem vínculo independente não autentica host real; manter pin oriundo de QR físico ou associação anterior autenticada |
| Enumerar código | Atacante testa 10^6 códigos, identifica sala sem segredo | Código público não é senha; rate-limit por peer/room, limites de JOIN, abandono/cooldown, sem revelar membership privado |
| TXT malicioso | Nome longo/control chars, gameId inválido, fase/ocupação mentirosa, parser spam | UTF-8/limites/enum/schema/TTL; tratar card como alegação e revalidar fase/capacidade no host |
| Replay/duplicata | JOIN antigo, fingerprint de sala encerrada, capability renovada, comando duplicado | Rejeitar convite vencido/consumido, binding TLS/peer e room atual, ack idempotente, seq/revision monotônicos |
| Host/guest abusivo | Flood de pedidos, lotação, múltiplas sessões, rekey e reconexão agressivos | Um ingresso em voo, limitação de taxa, vagas e revogação por host, timeouts/cancelamento; nunca conceder host role a guest |
| Mudança de rede | IP/porta antigos no cache, interface errada em hotspot, conexão falsa no cartão | invalidar endpoint resolvido, reconfirmar rede e conexão; não chamar LEAVE por mudança de rede; reconectar por identidade anterior |
| Segredo vazado | Modo compartilhado/guest mostra segredo anterior ao voltar do catálogo | limpar projeção ao disconnect e em mudança de GameSession; snapshot só para player autenticado; background masking |
| Owner destruído | UI unmount fecha host WSS, revoga Room sem comando explícito | G2 owner acima do router, testes host+guest `lobby→catálogo→lobby`, nenhum stop/disconnect por navegação |

## 5. Três propostas de ingresso de baixo atrito (comparativo)

| Opção | Primeira entrada em sala desconhecida | Conveniência | Autenticidade inicial | Status |
| --- | --- | --- | --- | --- |
| **A — TOFU / pin pelo anúncio** | Tocar no card e confiar na primeira chave recebida | 1 toque | **NÃO**: host falso/MITM inicial possível; o pin protege apenas mudanças futuras | **Não recomendada** para liberar sem risco explícito e testes |
| **B — anfitrião aprova pedido** | Tocar no card; host aprova identidade/convite no próprio celular | 1 toque guest + 1 aprovação host | **Insuficiente isoladamente**: host pode aprovar pedido MITM; exigiria canal autenticado/chave vinculada, anti-relay | Pesquisa de protocolo, **não aprovada** |
| **C — QR inicial autenticado + pin persistido; 1 toque nos reencontros** | Primeira associação: QR **na tela do host**, com fingerprint/capability íntegros; depois salas já reconhecidas podem ter 1 toque usando identidade pinada e ticket do host | 1 scan inicial; 1 toque nos reencontros | **Mais forte com canal óptico genuíno**; rede adversarial não substitui fingerprint sem alterar QR | **Recomendada como baseline seguro**; requer análise sobre retirar confirmação manual pós-QR |

**Recomendação de engenharia para G4:** escolher C como caminho seguro inicial **sem senha extra**: o primeiro contato escaneia um QR da sala exibido presencialmente, que transporta a identidade criptográfica e a capacidade de ingresso; quando voltar à mesma identidade previamente vinculada, o app poderá exibir um card “Sala conhecida” e conectar em um toque **após** desenvolver troca segura de ticket individual/rekey sem divulgação broadcast. Fluxo para sala desconhecida anunciada pode mostrar dados e CTA “Ler QR do anfitrião” — não afirmar join de um toque sem prova. Não reutilizar capability de um QR público em multicast; cuidado com replay, câmera/QR de terceiros e host identity rotation. Qualquer remoção da comparação presencial manual no QR exige revisão de segurança e teste com QR capturado versus QR remoto, além de preservar o pin. A implementação atual **ainda** exige o código presencial.

**Alternativa para objetivo “qualquer sala desconhecida = um toque”:** somente com protocolo adicional que dê prova verificável e autenticada de identidade no primeiro contato (p.ex. proximidade segura com hardware/canal fora da banda ou âncora externa confiável, a investigar). Sem PIN, QR, identidade prévia, infraestrutura confiável ou aceitar TOFU, **não existe autenticação robusta de um host desconhecido a partir de mDNS + seis dígitos públicos**. Aprovar um botão dessa natureza exige aceitar formalmente a redução de garantia, não mascará-la como “seguro por WSS”.

## 6. Sequência proposta de handshake por QR (NÃO implementação)

```text
HOST: Room WSS + identidade TLS → exibe QR privado de ingresso (inclui fingerprint+capability)
GUEST: escaneia QR visualmente da tela do host
GUEST: conecta por WSS com fingerprint PINADO ao QR (rejeita mismatch)
HOST: valida capability efêmera, fase/vagas/rate limit → admite e envia confirmação
GUEST: persiste resume credential no Android Keystore antes de ACK
GUEST/HOST: aplica snapshot privado correto e mantém revisão; rekey por canal autenticado
FUTURO: após vínculo autenticado persistente, descoberta indica endpoint; reconexão
         compara identidade já pinada e usa credencial/ticket renovável, nunca código público
```

**Atenção:** o passo “scan → sem digitar código” é **mudança proposta**, não existe no v2 atual. É necessária revisão específica do modelo de ameaça do QR como canal fora da banda, rejeição de QR de origem desconhecida e comportamento diante de relay/troca de aparelho. Não presumir que clicar anúncio e ler QR são equivalentes. Caso o host perca a identidade TLS ou o app seja reinstalado, o guest deve tratar como **nova associação**, não reduzir o pin automaticamente. Resume do vault não pode autorizar novo host apenas porque o IP coincide.

## 7. Gates de aceitação de segurança

**G3 (passivo):** anúncio publicamente auditável, zero secrets em DNS-SD/TXT/telemetria, permissões e limpeza, sem novo caminho `join`, sem fundo/host falso auto-conectando, prova física S23/S25 FE, fallback de QR existente intacto.

**G4 (admissão):** revisão escrita e aprovação explícita do usuário para garantia escolhida; casos RED→GREEN: host falso com mesmo nome/código, TLS fingerprint divergente, QR adulterado, relay/downgrade, multicast falso, capability replay, join lotado/bloqueado, resume/Keystore, code collision `000000`, rate limit/flood, troca de rede, múltiplas GameSessions e isolamento private. Teste Android físico e compliance de logs/release.

**Nenhuma decisão de UX em G0 autoriza** desligar `hostVerificationCode`, trocar para `ws://`, publicar `capability` em TXT, dispensar pinning ou iniciar admissão experimental numa build normal.

## 8. Aprovações separadas pendentes

- **SEC-G0-01:** aceitar como compromisso temporário que **salas desconhecidas precisam de QR**, enquanto salas previamente vinculadas poderão ter toque único (opção C)?
- **SEC-G0-02:** permitir um redesign futuro do ingresso **QR presencial → pinning criptográfico → admissão**, sem código digitado, condicionado a threat review e demonstração física?
- **SEC-G0-03:** permitir G3 de descoberta **somente para listar** antes de resolver G4? Recomendado SIM, sem anunciar “entrar com 1 toque” para desconhecidos.

**Conclusão:** descoberta não é autenticação. G4 permanece bloqueado e WSS/vault/pinning do PL-03 permanecem intocados até decisão e teste formal.
