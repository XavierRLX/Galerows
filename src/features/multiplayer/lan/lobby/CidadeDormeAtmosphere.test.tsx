import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CidadeDormeAtmosphere } from './CidadeDormeAtmosphere'

const clips:string[]=[]
const pauses:string[]=[]
class FakeAudio {
  static last:FakeAudio|null=null
  src:string
  currentTime=0
  onended:(()=>void)|null=null
  constructor(src:string){this.src=src;FakeAudio.last=this}
  play(){clips.push(this.src);return Promise.resolve()}
  pause(){pauses.push(this.src)}
}
const step=(phaseEventId:string,stage:'reveal'|'killer-turn'|'doctor-turn'|'morning'='reveal',
  overrides:Record<string,unknown>={})=>({
  sessionId:'session-one',phaseEventId,step:stage,connected:true,host:false,
  mayorMode:false,paused:false,...overrides,
})
beforeEach(()=>{clips.length=0;pauses.length=0;vi.stubGlobal('Audio',FakeAudio)})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
describe('Cidade Dorme audio/captions across LAN clients',()=>{
  it('all participants display identical thematic public captions without learning secret actions',()=>{
    const guest=step('city:phase:2:1:killer-turn','killer-turn')
    render(<CidadeDormeAtmosphere {...guest}/>)
    expect(screen.getByText(/A cidade adormece\. Todos fechem os olhos/)).toBeInTheDocument()
    expect(screen.getByTestId('city-ambience')).toHaveAttribute('data-time','night')
    expect(screen.queryByRole('button',{name:/Ativar narração/i})).toBeNull()
    expect(clips).toHaveLength(0)
  })
  it('only opted-in host in automatic mode plays each canonical phase exactly once',()=>{
    const first=step('city:phase:1:1:reveal','reveal',{host:true})
    const {rerender}=render(<CidadeDormeAtmosphere {...first}/>)
    expect(clips).toHaveLength(0)
    fireEvent.click(screen.getByRole('button',{name:'Ativar narração no anfitrião'}))
    expect(clips).toHaveLength(1)
    expect(clips[0]).toContain('01_identidade.mp3')
    rerender(<CidadeDormeAtmosphere {...first}/>)
    expect(clips).toHaveLength(1)
    rerender(<CidadeDormeAtmosphere {...step('city:phase:2:1:killer-turn','killer-turn',{host:true})}/>)
    expect(clips).toHaveLength(2)
    expect(clips[1]).toContain('02_cidade_dorme.mp3')
    rerender(<CidadeDormeAtmosphere {...step('city:phase:2:1:killer-turn','killer-turn',{host:true})}/>)
    expect(clips).toHaveLength(2)
  })
  it('automatic host plays full intro + role cue before indicating that narration finished',()=>{
    const onNarrationDone=vi.fn()
    render(<CidadeDormeAtmosphere {...step('p1','killer-turn',
      {host:true,autoMode:true,onNarrationDone})}/>)
    fireEvent.click(screen.getByRole('button',{name:'Ativar narração no anfitrião'}))
    expect(clips).toEqual([expect.stringContaining('02_cidade_dorme.mp3')])
    FakeAudio.last?.onended?.()
    expect(clips.at(-1)).toContain('03_assassino.mp3')
    expect(onNarrationDone).not.toHaveBeenCalled()
    FakeAudio.last?.onended?.()
    expect(onNarrationDone).toHaveBeenCalledOnce()
    expect(onNarrationDone).toHaveBeenCalledWith('p1')
  })
  it('human mayor gets synchronized captions but no automatic voice',()=>{
    render(<CidadeDormeAtmosphere {...step('p1','doctor-turn',{host:true,mayorMode:true})}/>)
    expect(screen.getByText(/Médico, acorde/)).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:/Ativar narração/})).toBeNull()
    expect(clips).toHaveLength(0)
  })
  it('on disconnect, stops sound and never replays an old cue when connection comes back',()=>{
    const first=step('p1','reveal',{host:true})
    const {rerender}=render(<CidadeDormeAtmosphere {...first}/>)
    fireEvent.click(screen.getByRole('button',{name:'Ativar narração no anfitrião'}))
    expect(clips).toHaveLength(1)
    rerender(<CidadeDormeAtmosphere {...step('p2','killer-turn',{host:true,connected:false})}/>)
    expect(pauses.length).toBeGreaterThan(0)
    rerender(<CidadeDormeAtmosphere {...step('p2','killer-turn',{host:true})}/>)
    expect(clips).toHaveLength(1)
  })
})
