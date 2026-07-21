import type { PistaUnicaTarget } from './pistaUnica.types'

export const pistaUnicaTargets: PistaUnicaTarget[] = [
  { id: 'word-pizza', category: 'words', title: 'Pizza' },
  { id: 'word-dinosaur', category: 'words', title: 'Dinossauro' },
  { id: 'word-robot', category: 'words', title: 'Robô' },
  { id: 'word-rainbow', category: 'words', title: 'Arco-íris' },
  { id: 'word-airplane', category: 'words', title: 'Avião' },
  { id: 'word-carnival', category: 'words', title: 'Carnaval' },
  { id: 'word-popcorn', category: 'words', title: 'Pipoca' },
  { id: 'word-volcano', category: 'words', title: 'Vulcão' },
  { id: 'movie-titanic', category: 'movies', title: 'Titanic' },
  { id: 'movie-avatar', category: 'movies', title: 'Avatar' },
  { id: 'movie-barbie', category: 'movies', title: 'Barbie' },
  { id: 'movie-matrix', category: 'movies', title: 'Matrix' },
  { id: 'movie-shrek', category: 'movies', title: 'Shrek' },
  { id: 'movie-harry-potter', category: 'movies', title: 'Harry Potter' },
  { id: 'movie-lion-king', category: 'movies', title: 'O Rei Leão' },
  { id: 'movie-jurassic-park', category: 'movies', title: 'Jurassic Park' },
  { id: 'series-friends', category: 'series', title: 'Friends' },
  { id: 'series-stranger-things', category: 'series', title: 'Stranger Things' },
  { id: 'series-wandinha', category: 'series', title: 'Wandinha' },
  { id: 'series-la-casa-de-papel', category: 'series', title: 'La Casa de Papel' },
  { id: 'series-breaking-bad', category: 'series', title: 'Breaking Bad' },
  { id: 'series-game-of-thrones', category: 'series', title: 'Game of Thrones' },
  { id: 'series-the-office', category: 'series', title: 'The Office' },
  { id: 'series-chaves', category: 'series', title: 'Chaves' },
]

export function getPistaUnicaTarget(targetId: string) {
  return pistaUnicaTargets.find((target) => target.id === targetId) ?? null
}
