import type { CidadeDormeLanPublic } from '../../cidadeDormeLanGame'

export type CityAutoGameCommand =
  'START_NIGHT' | 'OPEN_PHASE' | 'SIMULATE_NIGHT_ROLE' | 'START_DISCUSSION' | 'START_VOTE' |
  'RESOLVE_VOTE' | 'NEXT_NIGHT' | 'END_GAME'

export interface CityAutopilotInput {
  game:CidadeDormeLanPublic
  now:number
  host:boolean
  connected:boolean
  playing:boolean
  busy:boolean
  /** Host narrator signalled that the audible instruction ended. */
  audioDone?:boolean
}

/** A pure phase planner. The host sends commands; the server still checks time,
 * phase, membership and privilege. No client timer changes game state directly. */
export function decideCityAutopilot(input:CityAutopilotInput):CityAutoGameCommand|null {
  const {game,now,host,connected,playing,busy}=input
  if(!host||!connected||!playing||busy||game.paused)return null
  if(input.audioDone===false)return null
  const elapsed=Math.max(0,now-game.phaseStartedAt)
  switch(game.step){
    case 'reveal':return game.seenCount===game.totalPlayers && elapsed>=5500?'START_NIGHT':null
    case 'killer-turn':return !game.phaseReady && elapsed>=8000?'OPEN_PHASE':null
    case 'doctor-turn':return !game.phaseReady ? elapsed>=7500?'OPEN_PHASE':null
      : elapsed>=14000?'SIMULATE_NIGHT_ROLE':null
    case 'detective-turn':return !game.phaseReady ? elapsed>=6700?'OPEN_PHASE':null
      : elapsed>=14000?'SIMULATE_NIGHT_ROLE':null
    case 'detective-result':return !game.phaseReady ? elapsed>=8500?'OPEN_PHASE':null
      : elapsed>=14000?'SIMULATE_NIGHT_ROLE':null
    case 'morning':return elapsed>=8500?'START_DISCUSSION':null
    case 'discussion':return elapsed>=36000?'START_VOTE':null
    case 'voting':
      if(!game.phaseReady)return elapsed>=8000?'OPEN_PHASE':null
      return game.votedCount===game.eligibleVoters && elapsed>=8000?'RESOLVE_VOTE':null
    case 'vote-result':return elapsed>=9500?'NEXT_NIGHT':null
    case 'summary':return elapsed>=8500?'END_GAME':null
    default:return null
  }
}
