from pathlib import Path
p=Path('src/features/multiplayer/lan/lobby/LobbyRoomView.cidadeLan.test.tsx')
s=p.read_text()
def x(a,b):
 global s
 if a not in s:raise RuntimeError(a[:100])
 s=s.replace(a,b,1)
x("function scene(phase:'lobby'|'configuring'|'playing'):RoomSnapshotV2 {","function scene(phase:'lobby'|'configuring'|'playing',count=4):RoomSnapshotV2 {")
x("members:['host','guest','third','fourth'].map((id,i)=>","members:Array.from({length:count},(_,i)=>i===0?'host':i===1?'guest':i===2?'third':i===3?'fourth':'guest-'+i).map((id,i)=>")
x("      enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false,conductionMode:'automatic',\n      killersCount:1,doctorCanSelfProtect:false,doctorSelfProtectLimit:1,doctorCanRepeatProtection:true})",
  "      enableDoctor:true,enableDetective:true,enableJester:false,jesterCount:0,enableWatchman:false,enableSleepwalker:false,\n      revealRoleOnDeath:false,conductionMode:'automatic',\n      killersCount:1,doctorCanSelfProtect:true,doctorSelfProtectLimit:1,doctorCanRepeatProtection:false})")
x("it('saves custom killer count, self-protection count and consecutive protection policy',()=>{\n    const cb=actions()\n    render(<LobbyRoomView snapshot={scene('configuring')}",
  "it('saves custom killer count, self-protection count and consecutive protection policy',()=>{\n    const cb=actions()\n    render(<LobbyRoomView snapshot={scene('configuring',7)}")
x("    fireEvent.click(screen.getByRole('button',{name:'Médico pode se proteger'}))\n    fireEvent.click(screen.getByRole('button',{name:'Limite de autoproteção: 2'}))",
  "    fireEvent.click(screen.getByRole('button',{name:'Limite de autoproteção: 2'}))")
x("      enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false,\n      conductionMode:'automatic',killersCount:2,doctorCanSelfProtect:true,\n      doctorSelfProtectLimit:2,doctorCanRepeatProtection:false,",
  "      enableDoctor:true,enableDetective:true,enableJester:false,jesterCount:0,\n      enableWatchman:true,enableSleepwalker:true,revealRoleOnDeath:false,\n      conductionMode:'automatic',killersCount:2,doctorCanSelfProtect:true,\n      doctorSelfProtectLimit:2,doctorCanRepeatProtection:true,")
x("    expect(screen.getByText(/papéis especiais excedem os jogadores/i)).toBeInTheDocument()",
  "    expect(screen.getByText(/composição inválida/i)).toBeInTheDocument()")
x("    fireEvent.click(screen.getByRole('button',{name:/^Médico$/}))",
  "    fireEvent.click(screen.getByRole('button',{name:'1 integrante assassino'}))")
x("      enableDoctor:true,enableDetective:true,enableJester:false,revealRoleOnDeath:false,\n      conductionMode:'mayor',killersCount:1,doctorCanSelfProtect:false,\n      doctorSelfProtectLimit:1,doctorCanRepeatProtection:true,",
  "      enableDoctor:true,enableDetective:true,enableJester:false,jesterCount:0,\n      enableWatchman:false,enableSleepwalker:false,revealRoleOnDeath:false,\n      conductionMode:'mayor',killersCount:1,doctorCanSelfProtect:true,\n      doctorSelfProtectLimit:1,doctorCanRepeatProtection:false,")
p.write_text(s)
print('config tests updated')
