import type { ConversationMode, ImpostorDaPalavraConfig, ImpostorMode } from './impostorDaPalavra.types'

export const IMPOSTOR_MODES = ['no-word', 'hint', 'alternate-word'] as const satisfies readonly ImpostorMode[]
export const CONVERSATION_MODES = ['one-word', 'guided-questions'] as const satisfies readonly ConversationMode[]
export const IMPOSTOR_TIMER_SECONDS = [0, 120, 180, 300] as const

/** Shared gameplay settings, independent from the device or Room transport. */
export function isImpostorCoreConfig(value: unknown): value is ImpostorDaPalavraConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const config = value as Record<string, unknown>
  return IMPOSTOR_MODES.some(mode => mode === config.impostorMode)
    && CONVERSATION_MODES.some(mode => mode === config.conversationMode)
}

/** A local session must not persist LAN-specific fields or unknown settings. */
export function isImpostorLocalConfig(value: unknown): value is ImpostorDaPalavraConfig {
  if (!isImpostorCoreConfig(value)) return false
  const config = value as Record<string, unknown>
  return Object.keys(config).every(key => key === 'impostorMode' || key === 'conversationMode' || key === 'timerSeconds' || key === 'scoringMode')
    && (config.timerSeconds === undefined || IMPOSTOR_TIMER_SECONDS.some(duration => duration === config.timerSeconds))
    && (config.scoringMode === undefined || config.scoringMode === 'classic' || config.scoringMode === 'individual')
}
