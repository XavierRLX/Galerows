from pathlib import Path
p=Path('src/features/multiplayer/cidadeDormeLanGame.ts')
s=p.read_text()
def x(a,b):
 global s
 if a not in s: raise RuntimeError('MISSING '+a[:90])
 s=s.replace(a,b,1)
x('assignRolesToPlayers, canDoctorProtect, checkWinCondition, getActiveKiller, getMurderOrder, resolveNight, resolveVotingOutcome,',
 'assignRolesToPlayers, canDoctorProtect, checkWinCondition, getActiveKiller, getMurderOrder, getWatchmanObservation, createRoleDeck, resolveNight, resolveVotingOutcome,')
x('  enableJester: boolean\n  revealRoleOnDeath:', '  enableJester: boolean\n  jesterCount?: number\n  enableWatchman?: boolean\n  enableSleepwalker?: boolean\n  revealRoleOnDeath:')
x("  | 'detective-result' | 'morning'", "  | 'detective-result' | 'watchman-turn' | 'watchman-result' | 'morning'")
x("  investigation?: { targetId: string; result: 'suspect' | 'innocent' }",
  "  investigation?: { targetId: string; result: 'suspect' | 'innocent' }\n  watchmanObservation?: { targetId: string; result: 'passed' | 'stayed' }")
x("  night: { killerTarget?: string; protectedTarget?: string; detectiveTarget?: string }",
  "  night: { killerTarget?: string; protectedTarget?: string; detectiveTarget?: string; watchmanTarget?: string }")
x("  investigation: { targetId: string; result: 'suspect' | 'innocent' } | null",
  "  investigation: { targetId: string; result: 'suspect' | 'innocent' } | null\n  watchmanObservation: { targetId: string; result: 'passed' | 'stayed' } | null")
x("const optionalFields = ['conductionMode','killersCount','doctorCanSelfProtect',",
  "const optionalFields = ['conductionMode','killersCount','enableWatchman','enableSleepwalker','jesterCount','doctorCanSelfProtect',")
x("    && (raw.killersCount === undefined ||", "    && (raw.enableWatchman === undefined || typeof raw.enableWatchman === 'boolean')\n    && (raw.enableSleepwalker === undefined || typeof raw.enableSleepwalker === 'boolean')\n    && (raw.jesterCount === undefined || (Number.isInteger(raw.jesterCount) && (raw.jesterCount as number) >= 0 && (raw.jesterCount as number) <= 2))\n    && (raw.killersCount === undefined ||")
x("  return killers + Number(config.enableDoctor) + Number(config.enableDetective)\n    + Number(config.enableJester) <= playerCount",
  "  const settings = { ...defaults, ...config, killersCount: killers,\n    enableWatchman: config.enableWatchman ?? false, enableSleepwalker: config.enableSleepwalker ?? false }\n  try { return createRoleDeck(settings).length === playerCount } catch { return false }")
x("function configuredNightRole(state:LanState,role:'doctor'|'detective'):boolean{",
  "function configuredNightRole(state:LanState,role:'doctor'|'detective'|'watchman'):boolean{")
x("  return state.config.conductionMode==='automatic' || state.config.conductionMode==='mayor'\n    ? (role==='doctor'?state.config.enableDoctor:state.config.enableDetective)",
  "  return state.config.conductionMode==='automatic' || state.config.conductionMode==='mayor'\n    ? (role==='doctor'?state.config.enableDoctor:role==='detective'?state.config.enableDetective:Boolean(state.config.enableWatchman))")
x("  const night: CidadeDormeRoundHistory['night'] = {", "  const night: CidadeDormeRoundHistory['night'] = {")
x("    detectiveResult: resolution.action.detectiveResult ?? null,",
  "    detectiveResult: resolution.action.detectiveResult ?? null,")
x("    investigation: state.night.detectiveTarget && resolution.action.detectiveResult",
  "    investigation: state.night.detectiveTarget && resolution.action.detectiveResult")
x("  return step === 'morning' ? resolveCurrentNight(state) : { ...state, step }",
  "  return step === 'morning' ? resolveCurrentNight(state) : { ...state, step }")
x("    night: {}, nightResult: null, votes: {}, voteResult: null, investigation: null }",
  "    night: {}, nightResult: null, votes: {}, voteResult: null, investigation: null, watchmanObservation: null }")
x("    ...(raw.killersCount !== undefined ? { killersCount: raw.killersCount } : {}),",
  "    ...(raw.killersCount !== undefined ? { killersCount: raw.killersCount } : {}),\n    ...(raw.enableWatchman !== undefined ? { enableWatchman: raw.enableWatchman } : {}),\n    ...(raw.enableSleepwalker !== undefined ? { enableSleepwalker: raw.enableSleepwalker } : {}),\n    ...(raw.jesterCount !== undefined ? { jesterCount: raw.jesterCount } : {}),")
x("    const settings: GameSettings = { ...recommended, ...config,",
  "    const settings: GameSettings = { ...recommended, enableWatchman: false, enableSleepwalker: false, jesterCount: undefined, ...config,")
x("      investigation: null, previousProtectedTarget: null, doctorSelfProtectCount: 0,",
  "      investigation: null, watchmanObservation: null, previousProtectedTarget: null, doctorSelfProtectCount: 0,")
x("        'detective-result':7000, voting:6700,",
  "        'detective-result':7000, 'watchman-turn':7000, 'watchman-result':7000, voting:6700,")
x("      const role = state.step === 'doctor-turn' ? 'doctor'\n        : state.step === 'detective-turn' || state.step === 'detective-result'\n          ? 'detective' : null",
  "      const role = state.step === 'doctor-turn' ? 'doctor'\n        : state.step === 'detective-turn' || state.step === 'detective-result' ? 'detective'\n          : state.step === 'watchman-turn' || state.step === 'watchman-result' ? 'watchman' : null")
x("          : resolveCurrentNight(state)}",
  "          : configuredNightRole(state,'watchman') ? {...state,step:'watchman-turn' as const} : resolveCurrentNight(state)}")
x("      return {accepted:true,changed:true,state:resolveCurrentNight(state)}\n    }\n    if (action.type === 'ACK_ROLE')",
  "      if (state.step === 'watchman-turn') return {accepted:true,changed:true,state:{...state,step:'watchman-result' as const}}\n      return {accepted:true,changed:true,state:resolveCurrentNight(state)}\n    }\n    if (action.type === 'ACK_ROLE')")
x("      return { accepted:true,changed:true,state:resolveCurrentNight(next) }\n    }\n    if (action.type === 'ACK_INVESTIGATION')",
  "      return { accepted:true, changed:true, state:configuredNightRole(state,'watchman')\n        ? {...next, step:'watchman-turn' as const} : resolveCurrentNight(next) }\n    }\n    if (action.type === 'ACK_INVESTIGATION')")
x("      return {accepted:true,changed:true,state:resolveCurrentNight(state)}\n    }\n    if (action.type === 'START_DISCUSSION')",
  "      return {accepted:true,changed:true,state:configuredNightRole(state,'watchman')\n        ? {...state,step:'watchman-turn' as const} : resolveCurrentNight(state)}\n    }\n    if (action.type === 'WATCH') {\n      if (state.step !== 'watchman-turn') return error('invalid_phase')\n      if (actionWait) return error('not_ready')\n      if (player.status !== 'alive' || player.roleKey !== 'watchman') return error('unauthorized')\n      if (!validTarget(state,p)) return error('invalid_payload')\n      return {accepted:true,changed:true,state:{...state,step:'watchman-result' as const,\n        night:{...state.night,watchmanTarget:p},\n        watchmanObservation:{targetId:p,result:getWatchmanObservation(state.players,p,killerActor(state)?.id)}}}\n    }\n    if (action.type === 'ACK_WATCHMAN_RESULT') {\n      if (state.step !== 'watchman-result' || payload !== null) return error('invalid_phase')\n      if (player.status !== 'alive' || player.roleKey !== 'watchman') return error('unauthorized')\n      if (automatic && (!state.phaseReady || elapsed < 6500)) return error('not_ready')\n      return {accepted:true,changed:true,state:resolveCurrentNight(state)}\n    }\n    if (action.type === 'START_DISCUSSION')")
x("      ...(own.roleKey === 'detective' && state.investigation && state.step !== 'summary'",
  "      ...(own.roleKey === 'watchman' && state.watchmanObservation && state.step === 'watchman-result'\n        ? { watchmanObservation: { ...state.watchmanObservation } } : {}),\n      ...(own.roleKey === 'detective' && state.investigation && state.step !== 'summary'")
x("        || (state.step === 'detective-turn' && own.roleKey === 'detective')",
  "        || (state.step === 'detective-turn' && own.roleKey === 'detective')\n        || (state.step === 'watchman-turn' && own.roleKey === 'watchman')")
p.write_text(s)
print('LAN adapter updated:',len(s.splitlines()),'lines')
