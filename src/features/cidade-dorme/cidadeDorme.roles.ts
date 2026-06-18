import type { RoleDefinition, RoleKey } from './cidadeDorme.types'

export const ROLE_KEYS: RoleKey[] = ['citizen', 'killer', 'detective', 'doctor', 'jester']

export const CIDADE_DORME_ROLES: Record<RoleKey, RoleDefinition> = {
  citizen: {
    key: 'citizen',
    name: 'Cidadao',
    shortDescription: 'Vota durante o dia e tenta encontrar os assassinos.',
    objective: 'Eliminar todos os assassinos antes que eles dominem a cidade.',
    wakesAtNight: false,
    team: 'city',
  },
  killer: {
    key: 'killer',
    name: 'Assassino',
    shortDescription: 'Escolhe uma vitima durante a noite.',
    objective: 'Igualar ou superar o numero de inocentes vivos.',
    wakesAtNight: true,
    nightOrder: 1,
    team: 'killers',
  },
  doctor: {
    key: 'doctor',
    name: 'Medico',
    shortDescription: 'Protege uma pessoa durante a noite.',
    objective: 'Ajudar a cidade impedindo mortes durante a noite.',
    wakesAtNight: true,
    nightOrder: 2,
    team: 'city',
  },
  detective: {
    key: 'detective',
    name: 'Detetive',
    shortDescription: 'Investiga uma pessoa durante a noite.',
    objective: 'Descobrir quem e suspeito e orientar a cidade.',
    wakesAtNight: true,
    nightOrder: 3,
    team: 'city',
  },
  jester: {
    key: 'jester',
    name: 'Coringa',
    shortDescription: 'Tenta ser eliminado pela votacao da cidade.',
    objective: 'Vencer se for eliminado por votacao.',
    wakesAtNight: false,
    team: 'neutral',
  },
}

export function getRoleDefinition(roleKey: RoleKey) {
  return CIDADE_DORME_ROLES[roleKey]
}

export function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === 'string' && ROLE_KEYS.includes(value as RoleKey)
}

