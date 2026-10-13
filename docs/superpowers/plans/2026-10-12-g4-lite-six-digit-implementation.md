# G4-lite — Acesso LAN por seis dígitos (proposta aprovada pelo usuário em 12/10/2026)

Objetivo: substituir digitação de convite longo por 6 dígitos, automatizando a localização de uma Room no mesmo Wi-Fi, sem senha nem confirmação adicional para entrada local. Manter QR v2 original como fallback. A exigência de segurança do usuário é informal/familiar; o código é **público e de conveniência**, NÃO autenticação forte.

## Estrutura
1. Código efêmero numérico `000000`–`999999` gerado com crypto.getRandomValues no host, válido enquanto a Room estiver ativa; derivar `SHA256(versão + roomId + código)` como token hexadecimal de 64 chars. Não publicar token nem QR capability em DNS-SD.
2. Android secure host v2 registra token secundário além da capability principal original; WSS/TLS não sofre downgrade; rekey QR só gira o token original, não o token de ingresso pelo código. Host TS aceita admission `joinRequestV2` com token de código e campos de endpoint coerentes; revogação e controle de acesso seguem lógica Room v2.
3. NSD TXT publica `code`, `roomId`, fingerprint público, `app/v`; resolve transport endpoint do NSD e valida metadados (não segredo). O anúncio é falsificável na LAN; pinning protege *a chave anunciada*, não a identidade original do host. A rede local **não garante** exclusão de outros conectados.
4. Guest digita 6 dígitos, filtra salas encontradas; se única, conecta; se empate, pede escolha; sem discovery, QR/convidar permanecem. Também permite botão Entrar direto na sala visível (mesma garantia reduzida).
5. Não expor chaves, tokens, cartas ou QR capability no broadcast. Sem Internet, matchmaking, permissões inesperadas, dependências novas ou conexão com backend.
6. Preservar branch `feat/multiplayer-lan-task1-wss`, HEAD, `main`, alterações G0–G3 e os arquivos untracked. Sem commit, push, merge ou deploy.

## Verificação
Como o usuário pediu adiar testes na mensagem anterior, registrar compilação TS/ESLint/Javac/build como verificações estáticas e reportar de modo inequívoco ausência de teste real dos dois celulares. TDD fica em dívida; criar cenários de teste para posterior execução se viável.

## Riscos assumidos
Código visível em mDNS/TXT, guessable em 1e6 possibilidades, um atacante no mesmo Wi-Fi pode ver/usar a sala, host impostor no primeiro contato é possível. A identidade autenticada por QR permanece independente e mais forte. Se a rede tiver AP isolation, o código pode não encontrar a Room. Não afirmar garantia de acesso restrito aos amigos.
