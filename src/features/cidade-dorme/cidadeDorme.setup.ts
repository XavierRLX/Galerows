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
    enableDoctor: true,
    enableDetective: true,
    enableJester: false,
    jesterCount: 0,
    enableWatchman: playerCount >= 7,
    enableSleepwalker: playerCount >= 7,
    revealRoleOnDeath: false,
    doctorCanSelfProtect: true,
    doctorSelfProtectLimit: 1,
    doctorCanRepeatProtection: false,
    themeId: 'classic',
  }
}

export function getRecommendedKillersCount(playerCount: number) {
  assertSupportedPlayerCount(playerCount)
  if (playerCount >= 11) return 3
  if (playerCount >= 7) return 2
  return 1
}

export function getJesterCount(settings: GameSettings): number {
  return settings.jesterCount ?? Number(settings.enableJester)
}

/** The original one-device toggle must update both legacy and explicit counts. */
export function toggleCidadeDormeJester(settings: GameSettings): Pick<GameSettings, 'enableJester' | 'jesterCount'> {
  const enabled = getJesterCount(settings) === 0
  return { enableJester: enabled, jesterCount: Number(enabled) }
}

export function getCidadeDormeRoleCounts(settings: GameSettings): CidadeDormeRoleCounts {
  const specialRoles =
    settings.killersCount
    + Number(settings.enableDoctor)
    + Number(settings.enableDetective)
    + Number(settings.enableWatchman)
    + Number(settings.enableSleepwalker)
    + getJesterCount(settings)
  return {
    citizen: Math.max(0, settings.playerCount - specialRoles),
    killer: 1,
    traitor: settings.killersCount - 1,
    detective: settings.enableDetective ? 1 : 0,
    doctor: settings.enableDoctor ? 1 : 0,
    watchman: Number(settings.enableWatchman),
    sleepwalker: Number(settings.enableSleepwalker),
    jester: getJesterCount(settings),
  }
}

export function getCidadeDormeSetupWarnings(settings: GameSettings): string[] {
  const warnings: string[] = []
  const roleCounts = getCidadeDormeRoleCounts(settings)
  if (roleCounts.citizen === 0) warnings.push('Inclua pelo menos um Cidadao para manter blefes simples.')
  if (settings.playerCount <= 5 && getJesterCount(settings) > 0) warnings.push('O Coringa deixa grupos pequenos muito instaveis.')
  if (settings.killersCount >= settings.playerCount / 2) warnings.push('Assassinos demais podem encerrar a partida cedo.')
  return warnings
}

function assertSupportedPlayerCount(playerCount: number) {
  if (!isSupportedCidadeDormePlayerCount(playerCount)) throw new Error('Cidade Dorme exige entre 4 e 12 jogadores.')
}
