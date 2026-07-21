export type GameFavorite = {
  gameId: string
  favoritedAt: string
}

export type GameFavoritesSnapshot = {
  schemaVersion: 1
  favorites: GameFavorite[]
}
