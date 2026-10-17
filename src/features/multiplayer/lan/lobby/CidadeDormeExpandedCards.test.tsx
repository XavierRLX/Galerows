import { fireEvent, render, screen, act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CidadeDormeImmersiveRound } from './CidadeDormeImmersiveRound'
import type { RoomSnapshotV2 } from '../../persistentProtocol'
import type { CidadeDormeLanPublic, CidadeDormeLanPrivate } from '../../cidadeDormeLanGame'

afterEach(()=>{cleanup();vi.useRealTimers()})

function screenFor(step:'reveal'|'watchman-turn'|'watchman-result', personal: Partial<CidadeDormeLanPrivate>) {
  const state: CidadeDormeLanPublic = {
    step, round:1, phaseRevision:1, phaseEventId:'test-'+step,phaseStartedAt:0,
    seenCount:0,totalPlayers:4,players:['host','watcher','target','guest'].map(id=>({id,alive:true})),
    votedCount:0,eligibleVoters:4,nightResult:null,voteResult:null,winner:null,
    winReason:null,winnerPlayerId:null,finalRoles:null,
  }
  const mine: CidadeDormeLanPrivate={role:'watchman',alive:true,acknowledged:false,
    canAct:step==='watchman-turn',voted:false,...personal}
  const snapshot = {
    protocolVersion:2,roomId:'a',revision:1,nextClientSeq:1,
    roomState: {phase:'playing',hostPlayerId:'host',currentGameSessionId:'s',
      selectedConfig:{enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false},
      members:['host','watcher','target','guest'].map(id=>({playerId:id,displayName:id,connected:true,ready:true,role:'guest',participation:'active'}))},
    gamePublicState:{gameId:'cidade-dorme',gameSessionId:'s',data:state},
    privateState:{gameId:'cidade-dorme',gameSessionId:'s',data:mine},
  } as unknown as RoomSnapshotV2
  const cb=vi.fn()
  render(<CidadeDormeImmersiveRound snapshot={snapshot} playerId="watcher" isHost={false}
    busy={false} connected={true} onAction={cb} onEnd={vi.fn()} onBackToLobby={vi.fn()}
    onReconnect={vi.fn()} onLeave={vi.fn()} onClose={vi.fn()}/>)
  return cb
}
describe('Cidade Dorme expanded card and private watcher UI',()=>{
  it('draws a preassigned illustration with one tap, then acknowledges only its private role',()=>{
    vi.useFakeTimers()
    const cb=screenFor('reveal',{role:'watchman'})
    act(()=>vi.advanceTimersByTime(3300))
    expect(screen.queryByText('Vigia')).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:/pegue sua carta no monte/i})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/pegue sua carta no monte/i}))
    expect(screen.getByRole('img',{name:/carta ilustrada.*vigia/i})).toHaveAttribute('src',expect.stringContaining('vigia-v2.webp'))
    expect(screen.getByText('Vigia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/confirmar meu papel/i}))
    expect(cb).toHaveBeenCalledWith('ACK_ROLE',null)
  })
  it('authorizes the watcher to observe precisely one person, without showing role labels',()=>{
    const cb=screenFor('watchman-turn',{acknowledged:true})
    fireEvent.click(screen.getByRole('button',{name:/selecionar target/i}))
    fireEvent.click(screen.getByRole('button',{name:/observar pessoa/i}))
    expect(cb).toHaveBeenCalledWith('WATCH',{playerId:'target'})
  })
  it('shows street movement only on the watcher screen and requires a private acknowledgement',()=>{
    const cb=screenFor('watchman-result',{acknowledged:true,
      watchmanObservation:{targetId:'target',result:'passed'}})
    expect(screen.queryByText(/passou pela rua/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/conferir observação/i}))
    expect(screen.getByText(/passou pela rua/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/entendi.*vou dormir/i}))
    expect(cb).toHaveBeenCalledWith('ACK_WATCHMAN_RESULT',null)
  })
})
