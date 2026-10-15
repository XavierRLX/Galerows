import type { LobbyGameId } from './lobbyView'

/** Only public, explicitly supported rule fields. Never dump a game snapshot. */
export function LobbyRulesSummary({ gameId, config }: { gameId: LobbyGameId | null; config: unknown }) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null
  const rules = config as Record<string, unknown>
  const labels: Record<string, string> = {
    words: 'Palavras', movies: 'Filmes', series: 'Séries',
    'no-word': 'Sem palavra', hint: 'Com dica', 'alternate-word': 'Palavra alternativa',
    'one-word': 'Uma palavra por pessoa', 'guided-questions': 'Perguntas guiadas',
  }
  const lines: string[] = []
  if (gameId === 'pista-unica' && Array.isArray(rules.categories)) {
    lines.push(rules.categories.filter((item): item is string => typeof item === 'string' && item in labels).map(item => labels[item]).join(', '))
  } else if (gameId === 'impostor-da-palavra') {
    for (const key of ['impostorMode', 'conversationMode']) {
      const value = rules[key]
      if (typeof value === 'string' && labels[value]) lines.push(labels[value])
    }
    if (rules.flow === 'individual-vote') lines.push('Votação individual em cada celular')
    if (typeof rules.timerSeconds === 'number') lines.push(rules.timerSeconds === 0
      ? 'Sem cronômetro' : `${Math.round(rules.timerSeconds / 60)} min para conversar`)
  } else if (gameId === 'cidade-dorme') {
    lines.push(rules.conductionMode === 'mayor' ? 'Prefeito humano (não joga)' : 'Todos jogam — narrador automático')
    if (typeof rules.killersCount === 'number') lines.push(rules.killersCount===1?'1 Assassino':
      '1 Assassino + '+(Number(rules.killersCount)-1)+' Traidor'+(rules.killersCount===3?'es':''))
    lines.push('Médico pode se proteger: '+(rules.doctorCanSelfProtect?'sim':'não'))
    if (rules.doctorCanSelfProtect) lines.push('Autoproteções: '+(rules.doctorSelfProtectLimit==='unlimited'?'sem limite':rules.doctorSelfProtectLimit??1))
    lines.push('Proteção consecutiva: '+(rules.doctorCanRepeatProtection?'permitida':'não permitida'))
    lines.push(`Médico: ${rules.enableDoctor ? 'sim' : 'não'} · Detetive: ${rules.enableDetective ? 'sim' : 'não'}`)
    lines.push(`Coringa: ${rules.enableJester ? 'sim' : 'não'} · Revelar ao morrer: ${rules.revealRoleOnDeath ? 'sim' : 'não'}`)
  }
  return lines.length ? <ul className="pl03-rules-summary" aria-label="Regras da rodada">{lines.map(line => <li key={line}>{line}</li>)}</ul> : null
}
