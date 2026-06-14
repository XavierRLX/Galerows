import { useTranslation } from 'react-i18next'
import { Badge } from '../../components/ui/Badge'
import type { GameStatus } from './games.types'

const styles: Record<GameStatus, string> = { available: 'bg-lime-400/15 text-lime-300', 'coming-soon': 'bg-violet-400/15 text-violet-200', locked: 'bg-slate-500/20 text-slate-300' }
export function GameStatusBadge({ status }: { status: GameStatus }) {
  const { t } = useTranslation('hub')
  return <Badge className={styles[status]}>{t(`status.${status}`)}</Badge>
}
