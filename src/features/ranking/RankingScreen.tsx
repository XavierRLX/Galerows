import { History, Trash2, Trophy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { usePlayersStore } from '../players/players.store'
import { getGaleraRanking, getRecentGaleraMatches } from './ranking.model'
import { clearGaleraResultsSnapshot, loadGaleraResultsSnapshot } from './ranking.service'
import type { GaleraResultsSnapshot } from './ranking.types'

export function RankingScreen() {
  const navigate = useNavigate()
  const { group, hydrated, load } = usePlayersStore()
  const [resultsSnapshot, setResultsSnapshot] = useState<GaleraResultsSnapshot | null>(null)

  useEffect(() => { if (!hydrated) void load() }, [hydrated, load])
  useEffect(() => {
    let active = true
    void loadGaleraResultsSnapshot().then((snapshot) => {
      if (active) setResultsSnapshot(snapshot)
    })
    return () => {
      active = false
    }
  }, [])

  const ranking = resultsSnapshot ? getGaleraRanking(resultsSnapshot, group?.players ?? []) : []
  const recentMatches = resultsSnapshot ? getRecentGaleraMatches(resultsSnapshot, 8) : []
  const clearResults = async () => {
    if (!window.confirm('Limpar todo o histórico de partidas e zerar o ranking?')) return
    setResultsSnapshot(await clearGaleraResultsSnapshot())
  }

  return <div className="min-h-dvh pb-10">
    <Header action={<Button aria-label="Editar galera" size="icon" variant="secondary" onClick={() => navigate('/players')}><Users size={18} /></Button>} backTo="/" title="Ranking" />
    <section className="px-5 py-7">
      <div className="flex items-center gap-3"><div className="rounded-2xl bg-yellow-300 p-3 text-slate-950"><Trophy /></div><div><h1 className="text-2xl font-black">Ranking da galera</h1><p className="text-sm text-slate-400">Pontos acumulados pelas partidas finalizadas.</p></div></div>

      <Card className="mt-7 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Classificação</h2>
          <Button aria-label="Limpar ranking" disabled={!resultsSnapshot?.matches.length} size="icon" variant="ghost" onClick={() => void clearResults()}><Trash2 className="text-rose-300" size={18} /></Button>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          {ranking.length ? ranking.map((entry, index) => <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 last:border-0" key={entry.sourcePlayerId}>
            <div className="min-w-0"><p className="truncate font-black"><span className="mr-3 text-slate-500">{index + 1}º</span>{entry.playerName}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{entry.wins} vitória{entry.wins === 1 ? '' : 's'} · {entry.matches} partida{entry.matches === 1 ? '' : 's'}</p></div>
            <span className="shrink-0 rounded-full bg-yellow-300 px-3 py-1 font-black text-slate-950">{entry.points} pts</span>
          </div>) : <p className="p-5 text-center text-sm text-slate-400">Finalize partidas com jogadores da sua galera para começar o ranking.</p>}
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <div className="flex items-center gap-3"><History className="text-lime-300" /><div><h2 className="text-xl font-black">Últimas partidas</h2><p className="text-sm text-slate-400">Resumo dos resultados salvos.</p></div></div>
        <div className="mt-5 grid gap-3">
          {recentMatches.length ? recentMatches.map((match) => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={match.matchId}>
            <div className="flex items-start justify-between gap-3"><div><p className="font-black">{match.gameName}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{formatMatchDate(match.finishedAt)} · {match.participantCount} participantes</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">{match.awards.length} pontuaram</span></div>
            <p className="mt-3 text-sm text-slate-300">{formatAwards(match.awards)}</p>
          </div>) : <p className="rounded-2xl bg-white/5 p-5 text-center text-sm text-slate-400">Nenhuma partida salva ainda.</p>}
        </div>
      </Card>
    </section>
  </div>
}

function formatMatchDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data indisponível'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatAwards(awards: GaleraResultsSnapshot['matches'][number]['awards']) {
  if (!awards.length) return 'Nenhum jogador da galera pontuou.'
  return awards.slice(0, 3).map((award) => `${award.playerName} +${award.points}`).join(' · ') + (awards.length > 3 ? ` · +${awards.length - 3}` : '')
}
