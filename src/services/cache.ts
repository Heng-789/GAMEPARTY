// Data caching service for improved performance
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly GAME_TTL = 2 * 60 * 1000 // 2 minutes for game data
  private readonly USER_TTL = 10 * 60 * 1000 // 10 minutes for user data

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Specific cache methods for different data types
  setGameData(gameId: string, data: any): void {
    this.set(`game:${gameId}`, data, this.GAME_TTL)
  }

  getGameData(gameId: string): any | null {
    return this.get(`game:${gameId}`)
  }

  setUserData(userId: string, data: any): void {
    this.set(`user:${userId}`, data, this.USER_TTL)
  }

  getUserData(userId: string): any | null {
    return this.get(`user:${userId}`)
  }

  setGamesList(data: any[]): void {
    this.set('games:list', data, this.GAME_TTL)
  }

  getGamesList(): any[] | null {
    return this.get('games:list')
  }

  // Invalidate related cache entries
  invalidateGame(gameId: string): void {
    this.delete(`game:${gameId}`)
    this.delete('games:list')
    
    // Clear all cache entries that might contain this game
    for (const [key] of this.cache) {
      if (key.includes(gameId) || key === 'games:list') {
        this.cache.delete(key)
      }
    }
  }

  invalidateUser(userId: string): void {
    this.delete(`user:${userId}`)
  }
}

export const dataCache = new DataCache()

// Cache key generators
export const cacheKeys = {
  game: (id: string) => `game:${id}`,
  user: (id: string) => `user:${id}`,
  gamesList: () => 'games:list',
  userHcoin: (userId: string) => `user:hcoin:${userId}`,
  userStatus: (userId: string) => `user:status:${userId}`,
  checkinData: (gameId: string, userId: string) => `checkin:${gameId}:${userId}`,
  answers: (gameId: string) => `answers:${gameId}`,
}
