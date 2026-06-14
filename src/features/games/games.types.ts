export type GameStatus = 'available' | 'coming-soon' | 'locked'
export type GameModule = { id: string; name: string; shortDescription: string; description: string; route: string; minPlayers: number; maxPlayers?: number; isAvailableOffline: boolean; isPremium?: boolean; status: GameStatus; iconName: string; coverImage?: string; tags: string[] }
