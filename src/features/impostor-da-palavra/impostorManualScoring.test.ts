import { describe, expect, it } from 'vitest'
import { createImpostorDaPalavraSession, advanceRolePass, beginConversation, advanceClueTurn,
  beginAccusation, selectAccusedParticipant, confirmAccusation, recordFinalGuess, isSessionCompatible,
  recordManualVoteWinners, nextSharedQuestion, drawFirstSpeaker } from './impostorDaPalavra.session'
import type { GameParticipant } from '../players/players.types'
import type { ImpostorDaPalavraDeck } from './content/impostorDaPalavraContent.types'
const players: GameParticipant[] = [
  {id:'ana',name:'Ana',isGuest:true},
  {id:'bia',name:'Bia',isGuest:true},
  {id:'caio',name:'Caio',isGuest:true},
]
const deck:ImpostorDaPalavraDeck={
  schemaVersion:1,gameId:'impostor-da-palavra',deckId:'core',locale:'pt-BR',version:1,
  title:'Impostor',questions:Array.from({length:3},(_,n)=>({id:'q'+n,text:'Questão '+n})),
  cards:Array.from({length:3},(_,n)=>({id:'c'+n,category:'objects',word:'Objeto '+n,
    alternateWord:'Outra '+n,impostorHint:'Dica '+n,questionIds:['q0','q1','q2']})),
}
const rnd=()=>0.999999
describe('approved local one-phone changes',()=>{
  it('uses one shared question and lets the organizer change it or choose the first speaker',()=>{
    const config={impostorMode:'no-word' as const,conversationMode:'guided-questions' as const}
    let s=createImpostorDaPalavraSession(players,config,deck,rnd)
    expect(new Set(Object.values(s.questionAssignments)).size).toBe(1)
    for(let i=0;i<3;i++)s=advanceRolePass(s)
    const previous=Object.values(s.questionAssignments)[0]
    s=nextSharedQuestion(s,deck)
    expect(new Set(Object.values(s.questionAssignments)).size).toBe(1)
    expect(Object.values(s.questionAssignments)[0]).not.toBe(previous)
    const first=s.speakingOrder[0]
    s=drawFirstSpeaker(s)
    expect(s.speakingOrder[0]).not.toBe(first)
  })
  it('keeps verbal voting and gives manual individual bonuses without losing prior saved sessions',()=>{
    const config={impostorMode:'no-word' as const,conversationMode:'one-word' as const,scoringMode:'individual' as const}
    let s=createImpostorDaPalavraSession(players,config,deck,rnd)
    for(let i=0;i<3;i++)s=advanceRolePass(s)
    s=beginConversation(s)
    for(let i=0;i<3;i++)s=advanceClueTurn(s)
    s=beginAccusation(s)
    const wrong=players.find(p=>p.id!==s.currentImpostorId)!
    s=selectAccusedParticipant(s,wrong.id)
    s=confirmAccusation(s)
    expect(s.phase).toBe('final-guess')
    s=recordFinalGuess(s,true)
    expect(s.phase).toBe('manual-score')
    const voters=players.filter(p=>p.id!==s.currentImpostorId)
    s=recordManualVoteWinners(s,voters.map(p=>p.id))
    expect(s.phase).toBe('round-summary')
    expect(s.scores[s.currentImpostorId]).toBe(2)
    expect(voters.map(p=>s.scores[p.id])).toEqual([2,2])
    expect(isSessionCompatible(s,deck)).toBe(true)
    const legacy=createImpostorDaPalavraSession(players,
      {impostorMode:'no-word',conversationMode:'one-word'},deck,rnd)
    expect(isSessionCompatible({...legacy,timerStartedAt:undefined},deck)).toBe(true)
  })
})
