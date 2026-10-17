from pathlib import Path
def change(path,repls):
 p=Path(path);s=p.read_text()
 for a,b in repls:
  if a not in s:raise ValueError(f'missing {p}: {a[:100]}')
  s=s.replace(a,b,1)
 p.write_text(s);print('edited',p)
change('src/features/cidade-dorme/cidadeDorme.session.test.ts',[
 ("const session = createCidadeDormeSession(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length), () => 0.999999)\n    const doctorTurn",
  "const session = createCidadeDormeSession(playersWithDoctor, { ...createDefaultCidadeDormeSettings(playersWithDoctor.length), doctorCanSelfProtect: false }, () => 0.999999)\n    const doctorTurn"),
 ("expect(recordDetectiveInvestigation(detectiveTurn, 'bia')).toBe(detectiveTurn)",
  "expect(recordDetectiveInvestigation(detectiveTurn, 'caio')).toBe(detectiveTurn)")
])
change('src/features/cidade-dorme/cidadeDorme.store.test.ts',[
 ("    expect(saved?.phase).toBe('detectiveTurn')\n    expect(saved?.currentNightAction).toMatchObject({ round: 1, killerActorId:",
  "    expect(saved?.phase).toBe('doctorTurn')\n    expect(saved?.currentNightAction).toMatchObject({ round: 1, killerActorId:"),
 ("  it('does not persist invalid doctor protection', async () => {\n    await useCidadeDormeStore.getState().start(playersWithDoctor, createDefaultCidadeDormeSettings(playersWithDoctor.length))",
  "  it('does not persist invalid doctor protection', async () => {\n    await useCidadeDormeStore.getState().start(playersWithDoctor, { ...createDefaultCidadeDormeSettings(playersWithDoctor.length), doctorCanSelfProtect: false })")
])
