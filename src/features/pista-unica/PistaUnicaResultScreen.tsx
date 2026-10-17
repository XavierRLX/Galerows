import { Home, RotateCcw, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getPistaUnicaWinners } from './pistaUnica.session'
import { usePistaUnicaStore } from './pistaUnica.store'
import { usePistaUnicaInitialization } from './usePistaUnicaInitialization'
import { usePistaUnicaTheme } from './usePistaUnicaTheme'
import { CardDeck, PistaWorkshop, WorkshopHeading } from './PistaWorkshop'

export function PistaUnicaResultScreen() {
  const { t } = useTranslation('pista-unica')
  const navigate = useNavigate()
  const { session, initialized, discard } = usePistaUnicaStore()
  usePistaUnicaInitialization()
  usePistaUnicaTheme()
  useEffect(() => { if (initialized && (!session || session.phase !== 'finished')) navigate('/games/pista-unica', { replace: true }) }, [initialized, navigate, session])
  if (!session) return <PistaWorkshop mode="1 celular"><p role="status">{t('loading')}</p></PistaWorkshop>
  const winners = getPistaUnicaWinners(session)
  const ranking = [...session.participants].sort((first, second) => (session.scores[second.id] ?? 0) - (session.scores[first.id] ?? 0) || first.name.localeCompare(second.name))
  const allZero = ranking.every(person => !session.scores[person.id])
  return <PistaWorkshop mode="Mesa concluída" onBack={() => navigate('/games/pista-unica')} footer={<>
    <button className="pw-button" type="button" onClick={async () => { await discard(); navigate('/games/pista-unica/setup') }}><RotateCcw size={18} />{t('ranking.newGame')}</button>
    <button className="pw-button pw-button--secondary" type="button" onClick={async () => { await discard(); navigate('/') }}><Home size={18} />{t('ranking.home')}</button>
  </>}>
    <div className="pw-trophy"><Trophy size={38} /></div>
    <WorkshopHeading eyebrow="Toda pista conta" title={t('ranking.heading')}>{allZero ? 'A mesa ficou sem pontos. Um novo baralho, uma nova chance.' : winners.length === 1 ? `${winners[0]!.name} venceu a partida.` : `${winners.length} pessoas dividiram a vitória. Confira a classificação.`}</WorkshopHeading>
    <section className="pw-receipt" aria-label="Pontos desta partida"><h2>PONTOS DESTA PARTIDA</h2><CardDeck label="Classificação" pageSize={3}>{ranking.map((person, index) => <div className="pw-ranking-row" key={person.id}><span className="pw-rank">{String(index + 1).padStart(2, '0')}</span><strong>{person.name}</strong><b>{t('ranking.points', { count: session.scores[person.id] ?? 0 })}</b></div>)}</CardDeck></section>
    <p className="pw-note">As melhores conexões foram feitas em grupo.</p>
  </PistaWorkshop>
}
