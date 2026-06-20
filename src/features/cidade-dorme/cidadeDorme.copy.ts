import type { TFunction } from 'i18next'
import type { RoleKey } from './cidadeDorme.types'

export function getTranslatedRole(t: TFunction<'cidade-dorme'>, roleKey: RoleKey) {
  return {
    name: t(`roles.${roleKey}.name`),
    shortDescription: t(`roles.${roleKey}.shortDescription`),
    objective: t(`roles.${roleKey}.objective`),
  }
}
