from pathlib import Path
base=Path('src/features')
def change(path, subs):
 p=base/path;s=p.read_text()
 for old,new in subs:
  if old not in s: raise RuntimeError(f'NOT FOUND {path}: {old[:70]}')
  s=s.replace(old,new,1)
 p.write_text(s)
 print('edited',path)
change('multiplayer/lan/lobby/cidadeLucasNarration.ts',[
 ("   case 'detective-result': return [clip('07_pista')]","   case 'detective-result': return [clip('07_pista')]\n   case 'watchman-turn': return [clip('04_volte_dormir'),clip('16_vigia')]\n   case 'watchman-result': return [clip('17_resultado_vigia')]"),
])
change('multiplayer/lan/lobby/cidadeNarration.ts',[
 ("  'detective-result':'Detetive, confira o resultado no seu celular. Confirme quando terminar.',","  'detective-result':'Detetive, confira o resultado no seu celular. Confirme quando terminar.',\n  'watchman-turn':'Vigia, acorde. A cidade está em silêncio. Observe uma pessoa em segredo.',\n  'watchman-result':'Vigia, confira o que seus olhos testemunharam no seu celular. Guarde a informação em segredo.',"),
])
change('multiplayer/lan/lobby/cidadeAutopilot.ts',[
 ("    case 'morning':return elapsed>=8500?'START_DISCUSSION':null","    case 'watchman-turn':return !game.phaseReady ? elapsed>=8000?'OPEN_PHASE':null\n      : elapsed>=14000?'SIMULATE_NIGHT_ROLE':null\n    case 'watchman-result':return !game.phaseReady ? elapsed>=8000?'OPEN_PHASE':null\n      : elapsed>=14000?'SIMULATE_NIGHT_ROLE':null\n    case 'morning':return elapsed>=8500?'START_DISCUSSION':null"),
])
change('cidade-dorme/cidadeDorme.theme.ts',[
 ("    jester: {","    watchman: {\n      roleKey: 'watchman', displayName: 'Vigia', revealTitle: 'Você é Vigia',\n      description: 'Observe uma pessoa à noite e descubra se ela passou pela rua.',\n      mediatorScript: 'Vigia, acorde e observe uma pessoa.', colorClassName: 'text-sky-300',\n    },\n    sleepwalker: {\n      roleKey: 'sleepwalker', displayName: 'Sonâmbulo', revealTitle: 'Você é Sonâmbulo',\n      description: 'Você caminha durante a noite automaticamente, mas não pode agir.',\n      mediatorScript: 'Os demais dormem.', colorClassName: 'text-violet-300',\n    },\n    jester: {"),
])
change('multiplayer/lan/lobby/CidadeDormeLanRound.tsx',[
 ("citizen: 'Cidadão', jester: 'Coringa',","citizen: 'Cidadão', jester: 'Coringa', watchman: 'Vigia', sleepwalker: 'Sonâmbulo',"),
 ("  'detective-result': 'Pista confidencial',","  'detective-result': 'Pista confidencial',\n  'watchman-turn': 'O Vigia observa', 'watchman-result': 'O Vigia recebe a pista',"),
])
change('multiplayer/lan/lobby/CidadeDormeMayorPanel.tsx',[
 ("  morning:{title:'A cidade acorda'","  'watchman-turn':{title:'O Vigia observa',script:'Vigia, acorde e escolha uma pessoa para observar.'},\n  'watchman-result':{title:'Resultado do Vigia',script:'Vigia, confira o resultado privado em seu celular.'},\n  morning:{title:'A cidade acorda'"),
 ("detective:'Detetive',citizen:'Cidadão',jester:'Coringa'","detective:'Detetive',citizen:'Cidadão',jester:'Coringa',watchman:'Vigia',sleepwalker:'Sonâmbulo'"),
])
change('multiplayer/lan/prototypes/CidadeDormePrototype.tsx',[
 ("jester: 'Coringa',\n}","jester: 'Coringa', watchman: 'Vigia', sleepwalker: 'Sonâmbulo',\n}"),
 ("  jester: 'Seu objetivo é convencer a cidade a eliminar você pela votação.',","  jester: 'Seu objetivo é convencer a cidade a eliminar você pela votação.',\n  watchman: 'Observe uma pessoa à noite e descubra se passou pela rua.',\n  sleepwalker: 'Você sai durante a noite sem precisar escolher ações.',"),
 ("  morning: { overline: 'AMANHECER","  'watchman-turn': { overline: 'NOITE · VIGIA', title: 'O Vigia observa.', intro: 'Um jogador é observado em segredo.' },\n  'watchman-result': { overline: 'NOITE · PISTA DO VIGIA', title: 'O Vigia recebe a pista.', intro: 'Guarde a pista em segredo.' },\n  morning: { overline: 'AMANHECER"),
])
change('cidade-dorme/cidadeDorme.setup.test.ts',[
 ("expect(getRecommendedKillersCount(7)).toBe(1)","expect(getRecommendedKillersCount(7)).toBe(2)"),
 ("expect(getRecommendedKillersCount(11)).toBe(2)","expect(getRecommendedKillersCount(11)).toBe(3)"),
 ("      enableDoctor: false,","      enableDoctor: true,"),
 ("      jester: 1,","      jester: 1,\n      watchman: 0, sleepwalker: 0,"),
])
