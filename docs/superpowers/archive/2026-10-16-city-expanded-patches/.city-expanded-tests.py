from pathlib import Path
def change(path,repls):
 p=Path(path);s=p.read_text()
 for a,b in repls:
  if a not in s:raise ValueError(f'missing {p}: {a[:100]}')
  s=s.replace(a,b,1)
 p.write_text(s);print('edited',p)
change('src/features/multiplayer/cidadeDormeAutoFlow.test.ts',[
 ("it('allows doctor protecting same person in consecutive nights by default'","it('requires explicit configuration to protect the same person in consecutive nights'"),
 ("expect(defaults.doctorCanRepeatProtection).toBe(true)","expect(defaults.doctorCanRepeatProtection).toBe(false)"),
 ("it('keeps BOTH detective phases after elimination without producing a fabricated investigation',()=>{\n    const s=game();",
  "it('keeps BOTH detective phases after elimination without producing a fabricated investigation',()=>{\n    const s=game({doctorCanRepeatProtection:true});")
])
change('src/features/multiplayer/cidadeDormeLanGame.test.ts',[
 ("const defaults = { enableDoctor: true, enableDetective: true, enableJester: true, revealRoleOnDeath: false }",
  "const defaults = { enableDoctor: true, enableDetective: true, enableJester: true, revealRoleOnDeath: false, doctorCanSelfProtect: false }")
])
change('src/features/multiplayer/lan/lobby/CidadeDormeImmersiveRound.test.tsx',[
 ("fireEvent.click(screen.getByRole('button', { name: /revelar meu papel/i }))",
  "fireEvent.click(screen.getByRole('button', { name: /pegue sua carta no monte/i }))"),
 ("fireEvent.click(screen.getByRole('button', { name: /revelar meu papel/i }))",
  "fireEvent.click(screen.getByRole('button', { name: /pegue sua carta no monte/i }))")
])
change('src/features/cidade-dorme/cidadeDorme.session.test.ts',[
 ("['killer', 'detective', 'citizen', 'citizen']","['killer', 'doctor', 'detective', 'citizen']")
])
