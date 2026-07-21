import { BookKey, CircleDot, Dices, Drama, Grid3X3, List, ListOrdered, MessageCircleOff, Moon, ScanFace, Spade, UserRoundSearch, type LucideIcon } from 'lucide-react'

const icons: Record<string, LucideIcon> = { cards: Spade, mask: ScanFace, 'user-round-search': UserRoundSearch, moon: Moon, 'list-letters': List, 'list-ordered': ListOrdered, drama: Drama, 'message-circle-off': MessageCircleOff, 'book-key': BookKey, 'grid-3x3': Grid3X3, 'circle-dot': CircleDot, dices: Dices }
export function GameIcon({ name, size = 28 }: { name: string; size?: number }) { const Icon = icons[name] ?? Dices; return <Icon aria-hidden="true" size={size} /> }
