from pathlib import Path
p=Path('src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.tsx')
s=p.read_text()
def x(old,new):
 global s
 if old not in s: raise RuntimeError('MISSING '+old[:100])
 s=s.replace(old,new,1)
x("import type { RoleKey } from '../../../cidade-dorme/cidadeDorme.types'",
  "import type { RoleKey } from '../../../cidade-dorme/cidadeDorme.types'\nimport { CIDADE_DORME_ROLES } from '../../../cidade-dorme/cidadeDorme.roles'")
x("  citizen: 'Cidadão', killer: 'Assassino', traitor: 'Traidor', doctor: 'Médico', detective: 'Detetive', jester: 'Coringa',",
  "  citizen: 'Cidadão', killer: 'Assassino', traitor: 'Traidor', doctor: 'Médico', detective: 'Detetive', jester: 'Coringa',\n  watchman: 'Vigia', sleepwalker: 'Sonâmbulo',")
x("  jester: 'Você vence se a cidade eliminar você pela votação.',",
  "  jester: 'Você vence se a cidade eliminar você pela votação.',\n  watchman: 'Observe uma pessoa durante a noite. Só você descobrirá se ela passou pela rua.',\n  sleepwalker: 'Você anda pela cidade durante a noite sem precisar agir.',")
x("const chapter: Record<CidadeDormeLanStep",
  "const roleArtwork: Record<RoleKey, string> = {\n  killer:'assassino',traitor:'traidor',detective:'detetive',doctor:'medico',\n  watchman:'vigia-v2',sleepwalker:'sonambulo-v2',jester:'coringa',citizen:'cidadao',\n}\nconst chapter: Record<CidadeDormeLanStep")
x("  reveal: { eyebrow: 'PRÓLOGO · O SEGREDO', title: 'Descubra seu papel.', prompt: 'Veja sua identidade longe dos olhares da galera.' },",
  "  reveal: { eyebrow: 'PRÓLOGO · O SEGREDO', title: 'Pegue sua carta no monte.', prompt: 'Veja sua identidade longe dos olhares da galera.' },")
x("  'detective-turn': { eyebrow: 'NOITE · A INVESTIGAÇÃO', title: 'Uma pista na escuridão.', prompt: 'O detetive investiga uma pessoa em segredo.' },",
  "  'detective-turn': { eyebrow: 'NOITE · A INVESTIGAÇÃO', title: 'Uma pista na escuridão.', prompt: 'O detetive investiga uma pessoa em segredo.' },\n  'watchman-turn': { eyebrow: 'NOITE · VIGIA', title: 'Observe em silêncio.', prompt: 'O Vigia pode observar uma pessoa.' },\n  'watchman-result': { eyebrow: 'NOITE · O QUE VIU', title: 'Uma sombra passou?', prompt: 'O Vigia consulta a pista secreta.' },")
x("  const night = ['reveal', 'killer-turn', 'doctor-turn', 'detective-turn'].includes(data.step)",
  "  const night = ['reveal', 'killer-turn', 'doctor-turn', 'detective-turn', 'detective-result', 'watchman-turn', 'watchman-result'].includes(data.step)")
x("  const activeTurn = ['killer-turn', 'doctor-turn', 'detective-turn', 'voting'].includes(data.step)",
  "  const activeTurn = ['killer-turn', 'doctor-turn', 'detective-turn', 'watchman-turn', 'voting'].includes(data.step)")
x("      : data.step === 'detective-turn' ? mine?.role === 'detective' : data.step === 'voting'",
  "      : data.step === 'detective-turn' ? mine?.role === 'detective'\n        : data.step === 'watchman-turn' ? mine?.role === 'watchman' : data.step === 'voting'")
x("      : data.step === 'detective-turn' ? { type: 'INVESTIGATE', text: 'Investigar pessoa' }\n        : { type: 'CAST_VOTE', text: 'Confirmar meu voto' }",
  "      : data.step === 'detective-turn' ? { type: 'INVESTIGATE', text: 'Investigar pessoa' }\n        : data.step === 'watchman-turn' ? { type: 'WATCH', text: 'Observar pessoa' }\n          : { type: 'CAST_VOTE', text: 'Confirmar meu voto' }")
x("          {!mine && <p role=\"status\">Aguardando sua informação privada.</p>}",
  "          {!mine && <p role=\"status\">Aguardando sua informação privada.</p>}")
x("            : <p>Abra a carta, descubra quem você é e confirme.</p>}",
  "            : <p>Toque numa carta do monte, veja seu papel e confirme.</p>}")
x("              : data.step === 'doctor-turn' ? 'Escolha quem proteger nesta noite.' : 'Investigue uma pessoa em segredo.'}",
  "              : data.step === 'doctor-turn' ? 'Escolha quem proteger nesta noite.'\n                : data.step === 'watchman-turn' ? 'Escolha uma pessoa para observar esta noite.' : 'Investigue uma pessoa em segredo.'}")
x("        {data.step === 'morning' && <section",
  "        {data.step === 'watchman-result' && <section className=\"cdg-center\" aria-label=\"Resultado confidencial do Vigia\">\n          <Eye className=\"cdg-scene-icon\" size={58} strokeWidth={1.1}/>\n          {mine?.role === 'watchman' && mine.watchmanObservation && connected\n            ? <><h2>O que o Vigia viu</h2>\n              {clueVisible ? <><p role=\"status\">{name(mine.watchmanObservation.targetId)}: <strong>{mine.watchmanObservation.result === 'passed' ? 'Passou pela rua.' : 'Não passou pela rua.'}</strong></p>\n                <p>A observação não revela papel, destino ou ação.</p>\n                <ActionButton disabled={blocked || (autoGame && !data.phaseReady)} onClick={() => send('ACK_WATCHMAN_RESULT', null, true)}>Entendi, vou dormir <Check size={17}/></ActionButton>\n              </> : <><p>A pista é apenas sua. Guarde segredo.</p>\n                <ActionButton onClick={() => setClueVisible(true)}>Conferir observação <Eye size={17}/></ActionButton></>}\n              </> : <><h2>A cidade ainda dorme.</h2><p>O Vigia observa em silêncio.</p></>}\n        </section>}\n        {data.step === 'morning' && <section")
start=s.index("        <div className=\"cdg-role-face\" key={revealed ? 'open' : 'closed'}>")
end=s.index("        {data.step === 'reveal' && !mine.acknowledged",start)
s=s[:start]+"""        <div className="cdg-role-face" key={revealed ? 'open' : 'closed'}>
          {revealed ? <div className="cdg-illustrated-card" data-testid="cidade-illustrated-card">
            <img className="cdg-card-art"
              src={'/assets/games/cidade-dorme/cards/'+roleArtwork[mine.role]+'.webp'}
              alt={'Carta ilustrada: '+roleNames[mine.role]}/>
            <p className="cdg-card-name">SEU PAPEL</p><h2 data-testid="cidade-private-role">{roleNames[mine.role]}</h2>
            <span>{roleDescriptions[mine.role]}</span>
            <small>Objetivo: {CIDADE_DORME_ROLES[mine.role].objective}</small>
            {mine.successionOrder && <small>A equipe assassina:
              {mine.successionOrder.map((id,index)=>
                <span key={id}> {index?' → ':''}{name(id)} ({index===0?'Assassino':'Traidor'})
                  {id===mine.activeKillerId?' · ativo':''}</span>)}</small>}
            {mine.investigation && <small>Investigação: {name(mine.investigation.targetId)} é
              {mine.investigation.result === 'suspect' ? ' suspeito' : ' inocente'}.</small>}
          </div>
          : <button type="button" className="cdg-card-deck" disabled={blocked}
              onClick={() => setRevealed(true)} aria-label="Pegue sua carta no monte">
              <span className="cdg-card-back cdg-card-back-left" aria-hidden="true"/>
              <span className="cdg-card-back cdg-card-back-right" aria-hidden="true"/>
              <span className="cdg-card-back cdg-card-back-center" aria-hidden="true"><Moon size={48} strokeWidth={1.1}/></span>
              <strong>Pegue sua carta no monte</strong>
              <small>A escolha não altera seu papel, já distribuído em segredo.</small>
            </button>}
        </div>
        {revealed && <ActionButton secondary disabled={blocked} onClick={() => setRevealed(false)}>
          <EyeOff size={17}/> Ocultar carta</ActionButton>}
"""+s[end:]
# No old reveal text should remain
p.write_text(s)
print('UI patched',len(s.splitlines()))
