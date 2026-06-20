import type { GameSettings, RoleKey } from './cidadeDorme.types'

export const CIDADE_DORME_MIN_PLAYERS = 4
export const CIDADE_DORME_MAX_PLAYERS = 12

export type CidadeDormeRoleCounts = Record<RoleKey, number>

export function isSupportedCidadeDormePlayerCount(playerCount: number) {
  return Number.isInteger(playerCount) && playerCount >= CIDADE_DORME_MIN_PLAYERS && playerCount <= CIDADE_DORME_MAX_PLAYERS
}

export function createDefaultCidadeDormeSettings(playerCount: number): GameSettings {
  assertSupportedPlayerCount(playerCount)
  return {
    playerCount,
    killersCount: getRecommendedKillersCount(playerCount),
    enableDoctor: playerCount >= 5,
    enableDetective: true,
    enableJester: false,
    revealRoleOnDeath: false,
    doctorCanSelfProtect: false,
    doctorSelfProtectLimit: 1,
    doctorCanRepeatProtection: false,
    themeId: 'classic',
  }
}

export function getRecommendedKillersCount(playerCount: number) {
  assertSupportedPlayerCount(playerCount)
  if (playerCount >= 12) return 3
  if (playerCount >= 8) return 2
  return 1
}

export function getCidadeDormeRoleCounts(settings: GameSettings): CidadeDormeRoleCounts {
  const specialRoles =
    settings.killersCount
    + Number(settings.enableDoctor)
    + Number(settings.enableDetective)
    + Number(settings.enableJester)
  return {
    citizen: Math.max(0, settings.playerCount - specialRoles),
    killer: settings.killersCount,
    detective: settings.enableDetective ? 1 : 0,
    doctor: settings.enableDoctor ? 1 : 0,
    jester: settings.enableJester ? 1 : 0,
  }
}

export function getCidadeDormeSetupWarnings(settings: GameSettings): string[] {
  const warnings: string[] = []
  const roleCounts = getCidadeDormeRoleCounts(settings)
  if (roleCounts.citizen === 0) warnings.push('Inclua pelo menos um Cidadao para manter blefes simples.')
  if (settings.playerCount <= 5 && settings.enableJester) warnings.push('O Coringa deixa grupos pequenos muito instaveis.')
  if (settings.killersCount >= settings.playerCount / 2) warnings.push('Assassinos demais podem encerrar a partida cedo.')
  return warnings
}

function assertSupportedPlayerCount(playerCount: number) {
  if (!isSupportedCidadeDormePlayerCount(playerCount)) throw new Error('Cidade Dorme exige entre 4 e 12 jogadores.')
}
