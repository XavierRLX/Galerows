from pathlib import Path
p=Path('src/features/multiplayer/lan/lobby/LobbyRoomView.tsx')
s=p.read_text()
def x(old,new):
 global s
 if old not in s:raise RuntimeError('MISSING '+old[:100])
 s=s.replace(old,new,1)
x("    enableJester: saved?.enableJester === true, revealRoleOnDeath: saved?.revealRoleOnDeath === true,",
 "    enableWatchman: typeof saved?.enableWatchman === 'boolean' ? saved.enableWatchman : undefined,\n    enableSleepwalker: typeof saved?.enableSleepwalker === 'boolean' ? saved.enableSleepwalker : undefined,\n    revealRoleOnDeath: saved?.revealRoleOnDeath === true,")
x("    doctorCanSelfProtect: saved?.doctorCanSelfProtect === true,",
 "    doctorCanSelfProtect: saved?.doctorCanSelfProtect !== false,")
x("    doctorCanRepeatProtection: saved?.doctorCanRepeatProtection !== false,",
 "    doctorCanRepeatProtection: saved?.doctorCanRepeatProtection === true,")
x("  const [cidadeKillersOverride,",
 "  const [cidadeJesterCount,setCidadeJesterCount]=useState<0|1|2>(()=>\n    saved?.jesterCount===1||saved?.jesterCount===2 ? saved.jesterCount : saved?.enableJester===true ? 1 : 0)\n  const [cidadeKillersOverride,")
x("  const cityKillers=cidadeKillersOverride??cityDefaultKillers\n  const citySpecialRoles=cityKillers+Number(cidadeRoles.enableDoctor)\n    +Number(cidadeRoles.enableDetective)+Number(cidadeRoles.enableJester)\n  const cityCompositionInvalid=cityParticipantCount>=4 && citySpecialRoles>cityParticipantCount",
 "  const cityKillers=cidadeKillersOverride??cityDefaultKillers\n  const cityWatchman=cityParticipantCount>=7 && (cidadeRoles.enableWatchman ?? true)\n  const citySleepwalker=cityParticipantCount>=7 && (cidadeRoles.enableSleepwalker ?? true)\n  const citySpecialRoles=cityKillers+2+Number(cityWatchman)+Number(citySleepwalker)+cidadeJesterCount\n  const cityCompositionInvalid=cityParticipantCount>=4 && (citySpecialRoles>=cityParticipantCount\n    || cityKillers>=cityParticipantCount/2)")
x("                    ['enableDoctor', 'Médico'],\n                    ['enableDetective', 'Detetive'],\n                    ['enableJester', 'Coringa'],\n                    ['revealRoleOnDeath', 'Revelar papel ao morrer'],",
 "                    ['revealRoleOnDeath', 'Revelar papel ao morrer'],")
x("                <strong>Configure os papéis da galera</strong>\n                <div className=\"pl03-cidade-settings\"",
 "                <strong>Configure os papéis da galera</strong>\n                <p>Médico e Detetive são obrigatórios. Vigia e Sonâmbulo estão disponíveis a partir de 7 jogadores.</p>\n                <div className=\"pl03-cidade-settings\"")
x("                <p>Para preservar o mistério dos papéis eliminados, deixe",
 """                <div className="pl03-cidade-settings" aria-label="Papéis opcionais da cidade">
                  <button type="button" disabled={busy || !connected || cityParticipantCount < 7}
                    aria-pressed={cityWatchman} className={cityWatchman ? 'is-selected' : ''}
                    onClick={() => setCidadeRoles(v => ({ ...v, enableWatchman: !cityWatchman }))}>
                    <Check size={15} aria-hidden="true"/> Vigia
                  </button>
                  <button type="button" disabled={busy || !connected || cityParticipantCount < 7}
                    aria-pressed={citySleepwalker} className={citySleepwalker ? 'is-selected' : ''}
                    onClick={() => setCidadeRoles(v => ({ ...v, enableSleepwalker: !citySleepwalker }))}>
                    <Check size={15} aria-hidden="true"/> Sonâmbulo
                  </button>
                </div>
                <strong>Coringas opcionais</strong>
                <p>De 0 a 2 Coringas. Cada um só vence se for eliminado por votação.</p>
                <div className="pl03-cidade-settings" role="group" aria-label="Quantidade de Coringas">
                  {([0,1,2] as const).map(count=><button type="button" key={count}
                    aria-label={count+' Coringa'+(count===1?'':'s')}
                    aria-pressed={cidadeJesterCount===count} className={cidadeJesterCount===count?'is-selected':''}
                    disabled={busy||!connected} onClick={()=>setCidadeJesterCount(count)}>
                    {count===0?'Sem Coringa':count+' Coringa'+(count===1?'':'s')}
                  </button>)}
                </div>
                <p>Para preservar o mistério dos papéis eliminados, deixe""")
x("                  Total de papéis especiais: {citySpecialRoles} de {cityParticipantCount} jogadores conectados.",
 "                  Total de papéis especiais: {citySpecialRoles} de {cityParticipantCount} jogadores conectados.\n                  Cidadãos restantes: {Math.max(0,cityParticipantCount-citySpecialRoles)}.")
x("                {cityCompositionInvalid && <p className=\"pl03-pista-alert\" role=\"alert\">Os papéis especiais excedem os jogadores. Reduza a equipe assassina ou desative um papel opcional.</p>}",
 "                {cityCompositionInvalid && <p className=\"pl03-pista-alert\" role=\"alert\">Composição inválida: preserve ao menos 1 Cidadão e não inicie com a equipe assassina em paridade.</p>}")
x("                  onClick={() => void onConfigure({ ...cidadeRoles, conductionMode: cidadeMode,\n                    killersCount:cityKillers,doctorSelfProtectLimit:cidadeSelfLimit })}>",
 "                  onClick={() => void onConfigure({ ...cidadeRoles, conductionMode: cidadeMode,\n                    enableDoctor:true,enableDetective:true,enableWatchman:cityWatchman,enableSleepwalker:citySleepwalker,\n                    enableJester:cidadeJesterCount>0,jesterCount:cidadeJesterCount,\n                    killersCount:cityKillers,doctorSelfProtectLimit:cidadeSelfLimit })}>")
p.write_text(s)
print('lobby updated',len(s.splitlines()))
