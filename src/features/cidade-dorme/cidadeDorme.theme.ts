import type { RoleKey } from './cidadeDorme.types'

export type CidadeDormeRoleTheme = {
  roleKey: RoleKey
  displayName: string
  revealTitle: string
  description: string
  mediatorScript: string
  colorClassName: string
}

export type CidadeDormeTheme = {
  id: string
  name: string
  description: string
  backgroundClassName: string
  accentClassName: string
  roles: Record<RoleKey, CidadeDormeRoleTheme>
}

export const CLASSIC_CIDADE_DORME_THEME: CidadeDormeTheme = {
  id: 'classic',
  name: 'Classico',
  description: 'Uma cidade pequena, papeis secretos e uma noite cheia de suspeitas.',
  backgroundClassName: 'bg-slate-950',
  accentClassName: 'text-blue-300',
  roles: {
    citizen: {
      roleKey: 'citizen',
      displayName: 'Cidadao',
      revealTitle: 'Voce e Cidadao',
      description: 'Voce nao acorda a noite. Observe, discuta e vote para encontrar os assassinos.',
      mediatorScript: 'Cidadaos, continuem dormindo.',
      colorClassName: 'text-sky-200',
    },
    killer: {
      roleKey: 'killer',
      displayName: 'Assassino',
      revealTitle: 'Voce e Assassino',
      description: 'Acorde a noite com os outros assassinos e escolha uma vitima.',
      mediatorScript: 'Assassinos, acordem e escolham uma vitima em silencio.',
      colorClassName: 'text-rose-300',
    },
    doctor: {
      roleKey: 'doctor',
      displayName: 'Medico',
      revealTitle: 'Voce e Medico',
      description: 'Acorde a noite e escolha alguem para proteger.',
      mediatorScript: 'Medico, acorde e escolha quem sera protegido nesta noite.',
      colorClassName: 'text-emerald-300',
    },
    detective: {
      roleKey: 'detective',
      displayName: 'Detetive',
      revealTitle: 'Voce e Detetive',
      description: 'Acorde a noite e investigue se alguem e suspeito ou inocente.',
      mediatorScript: 'Detetive, acorde e escolha uma pessoa para investigar.',
      colorClassName: 'text-amber-200',
    },
    jester: {
      roleKey: 'jester',
      displayName: 'Coringa',
      revealTitle: 'Voce e Coringa',
      description: 'Tente convencer a cidade a eliminar voce por votacao.',
      mediatorScript: 'Coringa, permaneca dormindo e prepare seu blefe para o dia.',
      colorClassName: 'text-fuchsia-300',
    },
  },
}

export function getClassicRoleTheme(roleKey: RoleKey) {
  return CLASSIC_CIDADE_DORME_THEME.roles[roleKey]
}

