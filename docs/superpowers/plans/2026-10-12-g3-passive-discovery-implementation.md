# G3 — Descoberta passiva de salas LAN (implementação sem segundo aparelho)

**Autorização:** usuário pediu explicitamente continuar o desenvolvimento e deixar os testes para depois. O último G2 permaneceu pendente de validação física. G3 não equivale a homologação do G2; nenhuma claim de funcionamento entre telefones.

## Constraints
- Branch `feat/multiplayer-lan-task1-wss` / HEAD `fd8cc5c`; preservar G0/G1/G2, untracked e `main`.
- No deploy, commit, push, merge, app install ou mudanças de segurança na admissão WSS, TLS pin/fingerprint, resume vault, capability.
- Implementar **somente G3**: anúncio DNS-SD do host quando native secure v2 iniciou, descoberta Android no ingresso, cards públicos e fallback QR.
- NUNCA anunciar token, fingerprint TLS, canonical room ID, private game state, convite ou qualquer segredo em TXT. TXT permitido: `app=galerows`, `v=2` e porta nativa. Nome efêmero público, não autenticador.
- Discovery **não** prova identidade. Clicar em uma sala inicia leitura do QR autenticado, não `connectV2` nem TOFU.
- Lifecycle: anúncio vinculando ao servidor, incluindo expiration e onDestroy; busca vinculada à view de entrar em sala, com cleanup e multicast lock somente durante scan. Discovery cancelada no modo Room active.
- Release web não inclui UI experimental; host publiciza apenas native secure protocol v2 (já opt-in).
- Manifest permissions `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE` para descoberta multicast; target 36 não pede `ACCESS_LOCAL_NETWORK` (SDK 37 requer revisão). <https://developer.android.com/privacy-and-security/local-network-permission>.
- Conflitos, callbacks tardios, listeners duplicados e rede sem multicast são falhas não-fatais que conduzem ao QR.

## Deliverables
1. Android native `LanRoomNsdPublisher` gerenciado por `LanServerPlugin`.
2. Capacitor `LanRoomDiscoveryPlugin`, `lanRoomDiscovery.ts`.
3. `LanRoomDiscoveryList.tsx` na tela Entrar em sala, estado searching/empty/found/error, QR e convite como fallback.
4. Documentar alterações, limites e plano de testes futuros sem simular execução.
5. **A pedido do usuário, testes funcionais e físicos ficam adiados**. Apenas checagem de compilação/typecheck, se possível, sem afirmar que os testes passaram.

## Next independent gate (future)
G3 validação: 2 Android em mesmo Wi-Fi/hotspot, sem internet, remoção de card ao stop, host expirado, multicast bloqueado, duas salas, auto list, leitura QR WSS e segurança de anúncios. G4 só após threat model revisado explicitamente.
