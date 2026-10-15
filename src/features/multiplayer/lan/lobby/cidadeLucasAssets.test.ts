import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {describe,it,expect} from 'vitest'

const m=JSON.parse(readFileSync(resolve('docs/voice/cidade-dorme-lucas-mvp-manifest.json'),'utf8')) as {
 voice:{voice_id:string;language:string}
 clips:Array<{id:string;file:string;status:string;sha256:string;duration_seconds:number;bytes:number}>
}

describe('CITY-NARRATION-MVP-01 — offline production assets',()=>{
 it('contains 15 distinct valid audio files, matching content hashes without invoking the network',()=>{
   expect(m.voice.language).toBe('pt-BR')
   expect(m.clips).toHaveLength(15)
   expect(new Set(m.clips.map(c=>c.id)).size).toBe(15)
   for(const clip of m.clips){
     expect(clip.status).toBe('ready')
     expect(clip.duration_seconds).toBeGreaterThan(2)
     const path=resolve('public/assets/cidade-dorme/narracao-lucas',clip.id+'.mp3')
     expect(existsSync(path),clip.id).toBe(true)
     const bytes=readFileSync(path)
     expect(bytes.length,clip.id).toBe(clip.bytes)
     expect(bytes.subarray(0,3).toString('utf8')==='ID3' || bytes[0]===255).toBe(true)
     expect(createHash('sha256').update(bytes).digest('hex'),clip.id).toBe(clip.sha256)
   }
 })
 it('does not ship old macOS speech synthesis M4A assets',()=>{
   expect(existsSync(resolve('public/assets/cidade-dorme/narracao/reveal.m4a'))).toBe(false)
 })
})
