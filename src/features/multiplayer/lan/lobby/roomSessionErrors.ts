/**
 * User-safe messages for the existing PL-03 WSS protocol.
 * Never render native exception messages, capability codes, or invitation contents.
 */
export function describeRoomSessionError(reason: unknown): string {
  const code = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : ''
  if (code.includes('lan_interface_unavailable')) return 'Ative o Wi-Fi ou hotspot e espere a rede conectar para criar a sala.'
  if (code.includes('invite_expired')) return 'Este convite venceu. Peça outro ao anfitrião.'
  if (code.includes('invite_used')) return 'Este convite já foi usado. Peça ao anfitrião para renovar o QR.'
  if (code.includes('too_many_attempts')) return 'Muitas tentativas de entrada. Peça um convite novo ao anfitrião.'
  if (code.includes('incompatible_invite')) return 'Este convite é incompatível com a versão atual do Galerows.'
  if (code.includes('invalid_invite')) return 'O convite não é válido. Confira o texto ou leia o QR novamente.'
  if (code.includes('host_identity_mismatch')) return 'O código não confere. Verifique pessoalmente com o anfitrião.'
  if (code.includes('room_full')) return 'A sala está cheia. Aguarde uma vaga ou peça ao anfitrião para criar outra.'
  if (code.includes('room_closed')) return 'Esta sala foi encerrada pelo anfitrião.'
  if (code.includes('invalid_resume') || code.includes('resume_vault_failed')) {
    return 'Não foi possível retomar a sala com segurança. Confirme a rede e tente reconectar.'
  }
  if (code.includes('secure_lan_connect_failed')) {
    return 'Não foi possível conectar ao anfitrião. Confirme que os celulares estão na mesma rede Wi-Fi ou hotspot e peça um convite atualizado.'
  }
  if (code.includes('not_ready')) return 'Ainda há jogadores que não marcaram pronto.'
  if (code.includes('invalid_player_count')) return 'São necessárias pelo menos duas pessoas conectadas.'
  if (code.includes('transition_pending')) return 'Aguarde a entrada ou reconexão de outro jogador.'
  if (code.includes('resync_required')) return 'O estado da sala precisa ser sincronizado. Aguarde ou reconecte.'
  if (code.includes('connection') || code.includes('disconnected') || code.includes('timeout')) {
    return 'A conexão caiu. Confirme a rede Wi-Fi local e tente reconectar.'
  }
  return 'Não foi possível concluir a ação. Verifique a sala e tente novamente.'
}
