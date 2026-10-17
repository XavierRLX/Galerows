import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { getCityLucasNarrationSequence } from './cidadeLucasNarration'
import { getCityNarrationSubtitle } from './cidadeNarration'
import { decideCityAutopilot } from './cidadeAutopilot'
import type { CidadeDormeLanPublic } from '../../cidadeDormeLanGame'

describe('CITY-EXPANDED — Lucas offline watchman', () => {
  it('bundles two valid watchman MP3 clips, without generating audio at runtime', () => {
    for (const file of ['16_vigia.mp3','17_resultado_vigia.mp3']) {
      const path='public/assets/cidade-dorme/narracao-lucas/'+file
      expect(statSync(path).size).toBeGreaterThan(100000)
      const data=readFileSync(path)
      expect(data.subarray(0,3).toString()).toBe('ID3')
    }
  })
  it('plays the two specific watchman cues and no sleepwalker cue', () => {
    expect(getCityLucasNarrationSequence('watchman-turn')).toContain('/assets/cidade-dorme/narracao-lucas/16_vigia.mp3')
    expect(getCityLucasNarrationSequence('watchman-result')).toContain('/assets/cidade-dorme/narracao-lucas/17_resultado_vigia.mp3')
    expect(getCityNarrationSubtitle('watchman-turn')).toContain('Vigia')
    expect(getCityNarrationSubtitle('watchman-result')).toContain('Vigia')
  })
  it('automatically opens living and eliminated watchman phases on their same dwell time', () => {
    const game = {step:'watchman-turn',phaseStartedAt:100,phaseReady:false,paused:false} as CidadeDormeLanPublic
    const input={game,now:8200,host:true,connected:true,playing:true,busy:false,audioDone:true}
    expect(decideCityAutopilot(input)).toBe('OPEN_PHASE')
    expect(decideCityAutopilot({...input, game:{...game,phaseReady:true},now:14200})).toBe('SIMULATE_NIGHT_ROLE')
  })
})
