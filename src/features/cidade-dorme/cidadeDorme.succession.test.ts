import { describe, expect, it } from 'vitest'
import {
  assignRolesToPlayers, checkWinCondition, createRoleDeck, getActiveKiller,
  getAliveInnocents, getAliveKillers, getMurderOrder, resolveNight,
} from './cidadeDorme.rules'
import type { GameSettings, Player } from './cidadeDorme.types'

const settings: GameSettings = {
  playerCount: 12, killersCount: 3, enableDoctor: true,
  enableDetective: true, enableJester: true, revealRoleOnDeath: false,
  doctorCanSelfProtect: false, doctorSelfProtectLimit: 1,
  doctorCanRepeatProtection: false, themeId: 'classic',
}
const roster = Array.from({ length: 12 }, (_, i) => ({ id: 'p'+i, name: 'Pessoa '+i }))
const staticRandom = () => .99999
const known = (): Player[] => [
  { id:'leader', name:'Líder', roleKey:'killer', status:'alive' },
  { id:'first', name:'Primeiro', roleKey:'traitor', status:'alive' },
  { id:'second', name:'Segundo', roleKey:'traitor', status:'alive' },
  { id:'detective', name:'Detetive', roleKey:'detective', status:'alive' },
  { id:'citizen', name:'Cidade', roleKey:'citizen', status:'alive' },
  { id:'jester', name:'Coringa', roleKey:'jester', status:'alive' },
]
const eliminated = (players: Player[], id: string, reason: 'night'|'vote'='vote') =>
  players.map(p=> p.id===id ? { ...p, status:'eliminated' as const, eliminatedAtRound:1, eliminationReason:reason } : p)
const order=['leader','first','second']
describe('Cidade Dorme — approved succession of killer and up to two traitors', () => {
  it('has one killer and one or two traitors in the role deck with 2 or 3 killer-side slots',()=>{
    expect(createRoleDeck({...settings,killersCount:1})).toContain('killer')
    expect(createRoleDeck({...settings,killersCount:1})).not.toContain('traitor')
    expect(createRoleDeck({...settings,killersCount:2}).filter(r=>['killer','traitor'].includes(r))).toEqual(['killer','traitor'])
    expect(createRoleDeck({...settings,killersCount:3}).filter(r=>['killer','traitor'].includes(r))).toEqual(['killer','traitor','traitor'])
    const assigned=assignRolesToPlayers(roster,settings,staticRandom)
    expect(assigned.filter(p=>p.roleKey==='killer')).toHaveLength(1)
    expect(assigned.filter(p=>p.roleKey==='traitor')).toHaveLength(2)
  })

  it('shuffles once to establish private murder priority, skips deceased successors, never promotes for a disconnect',()=>{
    const players=known()
    const firstOrder=getMurderOrder(players, staticRandom)
    expect(firstOrder).toEqual(order)
    const shuffled=getMurderOrder(players,()=>0)
    expect(shuffled[0]).toBe('leader')
    expect(new Set(shuffled.slice(1))).toEqual(new Set(['first','second']))
    expect(getActiveKiller(players,order)?.id).toBe('leader')
    expect(getActiveKiller(eliminated(players,'leader'),order)?.id).toBe('first')
    expect(getActiveKiller(eliminated(eliminated(players,'leader'),'first'),order)?.id).toBe('second')
    expect(getActiveKiller(eliminated(players,'first'),order)?.id).toBe('leader')
    expect(getActiveKiller(eliminated(eliminated(players,'leader'),'first'),order)?.id).toBe('second')
    expect(getActiveKiller(eliminated(eliminated(eliminated(players,'leader'),'first'),'second'),order)).toBeUndefined()
  })

  it('treats each traitor as innocent to a detective until that specific traitor becomes the active killer',()=>{
    const p=known()
    const before=resolveNight(p,{round:1,killerActorId:'leader',detectiveTargetId:'first'})
    expect(before.action.detectiveResult).toBe('innocent')
    const afterFirst=eliminated(p,'leader')
    const leaderDown=resolveNight(afterFirst,{round:2,killerActorId:'first',detectiveTargetId:'first'})
    expect(leaderDown.action.detectiveResult).toBe('suspect')
    const secondNotYet=resolveNight(afterFirst,{round:2,killerActorId:'first',detectiveTargetId:'second'})
    expect(secondNotYet.action.detectiveResult).toBe('innocent')
    const secondActive=resolveNight(eliminated(afterFirst,'first'),{round:3,killerActorId:'second',detectiveTargetId:'second'})
    expect(secondActive.action.detectiveResult).toBe('suspect')
    expect(before.action.detectiveResult).toBe('innocent')
  })

  it('counts inactive traitors as killer-side members for parity and holds city win until all three are eliminated',()=>{
    const p=known()
    expect(getAliveKillers(p).map(x=>x.id)).toEqual(['leader','first','second'])
    expect(getAliveInnocents(p).map(x=>x.id)).not.toContain('first')
    expect(checkWinCondition(eliminated(p,'leader'),settings).winner).not.toBe('city')
    const one=eliminated(eliminated(p,'leader'),'first')
    expect(checkWinCondition(one,settings).winner).not.toBe('city')
    const all=eliminated(one,'second')
    expect(checkWinCondition(all,settings)).toMatchObject({isGameOver:true,winner:'city'})
  })
  it('awards immediate neutral victory only when the jester is actually voted out',()=>{
    expect(checkWinCondition(eliminated(known(),'jester','night'),settings).winner).not.toBe('jester')
    expect(checkWinCondition(eliminated(known(),'jester','vote'),settings).winner).toBe('jester')
  })
})
