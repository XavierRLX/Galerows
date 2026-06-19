import { Home, RotateCcw, Skull, Trophy, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { getRoleDefinition } from './cidadeDorme.roles'
import { getClassicRoleTheme } from './cidadeDorme.theme'
import { useCidadeDormeStore } from './cidadeDorme.store'
import type { CidadeDormePlayerInput, GameState, Player } from './cidadeDorme.types'
import { MediatorHistoryPanel } from './components/MediatorHistoryPanel'
import { useCidadeDormeInitialization } from './useCidadeDormeInitialization'

export function CidadeDormeResultScreen() {
  const navigate = useNavigate()
  const { session, initialized, discard, start } = useCidadeDormeStore()
  useCidadeDormeInitialization()

  useEffect(() => {
    if (!initialized) return
    if (!session) navigate('/games/cidade-dorme', { replace: true })
    else if (session.phase !== 'gameOver') navigate('/games/cidade-dorme/play', { replace: true })
  }, [initialized, navigate, session])

  if (!session) return <div className="p-6 text-slate-400">Carregando resultado...</div>

  const alivePlayers = session.players.filter((player) => player.status === 'alive')
  const eliminatedPlayers = session.players.filter((player) => player.status === 'eliminated')
  const winnerPlayer = session.players.find((player) => player.id === session.winnerPlayerId)

  return <div className="min-h-dvh pb-10">
    <Header title="Fim de jogo" />
    <section className="px-5 py-8 text-center">
      <Trophy className="mx-auto text-lime-300" size={64} />
      <h1 className="mt-4 text-3xl font-black">{getWinnerTitle(session, winnerPlayer?.name)}</h1>
      <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-400">{getWinnerDescription(session)}</p>

      {session.parallelWinners?.length ? <Card className="mx-auto mt-6 max-w-lg p-5 text-left">
        <p className="text-sm font-black uppercase tracking-wider text-fuchsia-300">Vitórias paralelas</p>
        <div className="mt-3 grid gap-2">
          {session.parallelWinners.map((winner) => <p className="text-sm leading-6 text-slate-300" key={`${winner.winner}-${winner.playerId}`}>
            {session.players.find((player) => player.id === winner.playerId)?.name ?? 'Coringa'} venceu como Coringa.
          </p>)}
        </div>
      </Card> : null}

      <div className="mx-auto mt-7 grid max-w-lg grid-cols-2 gap-3">
        <SummaryCard icon={<Users size={20} />} label="Sobreviventes" value={String(alivePlayers.length)} />
        <SummaryCard icon={<Skull size={20} />} label="Eliminados" value={String(eliminatedPlayers.length)} />
      </div>

      <Card className="mx-auto mt-5 max-w-lg p-5 text-left">
        <h2 className="text-xl font-black">Papéis revelados</h2>
        <div className="mt-4 grid gap-3">
          {session.players.map((player) => <PlayerResultRow key={player.id} player={player} />)}
        </div>
      </Card>

      <MediatorHistoryPanel session={session} />

      <div className="mx-auto mt-6 grid max-w-lg gap-3">
        <Button className="bg-lime-300 text-slate-950 hover:bg-lime-200" size="lg" onClick={async () => { await start(toPlayerInputs(session.players), session.settings); navigate('/games/cidade-dorme/play') }}>
          <RotateCcw size={18} />
          Jogar novamente
        </Button>
        <Button size="lg" variant="secondary" onClick={async () => { await discard(); navigate('/') }}>
          <Home size={18} />
          Voltar ao Hub
        </Button>
      </div>
    </section>
  </div>
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card className="p-4 text-left">
    <div className="flex items-center gap-2 text-lime-300">{icon}<span className="text-xs font-black uppercase tracking-wider">{label}</span></div>
    <p className="mt-2 text-3xl font-black text-white">{value}</p>
  </Card>
}

function PlayerResultRow({ player }: { player: Player }) {
  const role = player.roleKey ? getRoleDefinition(player.roleKey) : null
  const theme = player.roleKey ? getClassicRoleTheme(player.roleKey) : null
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-black text-slate-100">{player.name}</p>
        <p className={`mt-1 text-sm font-black uppercase tracking-wider ${theme?.colorClassName ?? 'text-slate-300'}`}>{role?.name ?? 'Sem papel'}</p>
      </div>
      <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-300">{player.status === 'alive' ? 'vivo' : 'eliminado'}</span>
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-400">{role?.objective}</p>
  </div>
}

function getWinnerTitle(session: GameState, winnerPlayerName?: string) {
  if (session.winner === 'city') return 'A Cidade venceu'
  if (session.winner === 'killers') return 'Os Assassinos venceram'
  if (session.winner === 'jester') return winnerPlayerName ? `${winnerPlayerName} venceu como Coringa` : 'O Coringa venceu'
  return 'Fim da partida'
}

function getWinnerDescription(session: GameState) {
  if (session.winner === 'city') return 'Todos os assassinos foram eliminados.'
  if (session.winner === 'killers') return 'Os assassinos igualaram ou superaram o número de inocentes vivos.'
  if (session.winner === 'jester') return 'O Coringa foi eliminado pela votação da cidade.'
  return 'A partida terminou.'
}

function toPlayerInputs(players: Player[]): CidadeDormePlayerInput[] {
  return players.map(({ id, name, sourcePlayerId, isGuest }) => ({ id, name, sourcePlayerId, isGuest }))
}
