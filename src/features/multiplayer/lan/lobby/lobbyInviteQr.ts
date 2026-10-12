import QRCode from 'qrcode'

/** Dense versioned LAN tickets need a four-module quiet zone and a high-resolution source. */
export function createLobbyInviteQr(invite: string): Promise<string> {
  return QRCode.toDataURL(invite, { margin: 4, width: 512, errorCorrectionLevel: 'M' })
}
