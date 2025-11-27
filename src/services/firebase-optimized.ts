// Optimized PostgreSQL service with caching
import { dataCache, cacheKeys } from './cache'
import { deduplicateRequest } from './request-deduplication'

// Optimized game data fetching with caching - using PostgreSQL
export async function getGameData(gameId: string): Promise<any | null> {
  // Check cache first using the same key as useGameData
  const cacheKey = cacheKeys.game(gameId)
  const cached = dataCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // ✅ ใช้ request deduplication เพื่อป้องกันการเรียก API ซ้ำซ้อน
  return deduplicateRequest(`game:${gameId}`, async () => {
    try {
      // ✅ ใช้ PostgreSQL เท่านั้น
      const { getGameData } = await import('./postgresql-adapter')
      const gameData = await getGameData(gameId)
      
      if (gameData) {
        // Cache the result using the same key
        dataCache.set(cacheKey, gameData, 2 * 60 * 1000) // 2 minutes cache
      }
      
      return gameData
    } catch (error) {
      console.error('Error fetching game data:', error)
      return null
    }
  })
}

// Optimized games list fetching with caching - using PostgreSQL
export async function getGamesList(): Promise<any[]> {
  // Check cache first using the same key as useGamesList
  const cacheKey = cacheKeys.gamesList()
  const cached = dataCache.get<any[]>(cacheKey)
  if (cached && Array.isArray(cached)) {
    return cached
  }

  try {
    // ✅ ใช้ PostgreSQL เท่านั้น
    const { getGamesList } = await import('./postgresql-adapter')
    const games = await getGamesList()
    
    if (games && Array.isArray(games)) {
      // Cache the result using the same key
      dataCache.set(cacheKey, games, 2 * 60 * 1000) // 2 minutes cache
      return games
    }
    
    return []
  } catch (error) {
    console.error('Error fetching games list:', error)
    return []
  }
}

// Optimized user data fetching - using PostgreSQL
export async function getUserData(userId: string): Promise<any | null> {
  // Check cache first using the same key as useUserData
  const cacheKey = cacheKeys.user(userId)
  const cached = dataCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // ✅ ใช้ request deduplication เพื่อป้องกันการเรียก API ซ้ำซ้อน
  return deduplicateRequest(`user:${userId}`, async () => {
    try {
      // ✅ ใช้ PostgreSQL เท่านั้น
      const { getUserData } = await import('./postgresql-adapter')
      const userData = await getUserData(userId)
      
      if (userData) {
        dataCache.set(cacheKey, userData, 10 * 60 * 1000) // 10 minutes cache
      }
      
      return userData
    } catch (error) {
      console.error('Error fetching user data:', error)
      return null
    }
  })
}

// Optimized checkin data fetching - using PostgreSQL
export async function getCheckinData(gameId: string, userId: string): Promise<any | null> {
  const cacheKey = cacheKeys.checkinData(gameId, userId)
  const cached = dataCache.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    // ✅ ใช้ PostgreSQL เท่านั้น
    const { getCheckins } = await import('./postgresql-adapter')
    const checkins = await getCheckins(gameId, userId, 30)
    
    const checkinData = checkins || {}
    dataCache.set(cacheKey, checkinData, 2 * 60 * 1000) // 2 minutes cache
    
    return checkinData
  } catch (error) {
    console.error('Error fetching checkin data:', error)
    return null
  }
}

// Optimized answers fetching with pagination - using PostgreSQL
export async function getAnswers(gameId: string, limit: number = 50): Promise<any[]> {
  const cacheKey = cacheKeys.answers(gameId)
  const cached = dataCache.get<any[]>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    // ✅ ใช้ PostgreSQL เท่านั้น
    const { getAnswers } = await import('./postgresql-adapter')
    const answers = await getAnswers(gameId, limit)
    
    if (answers && Array.isArray(answers)) {
      dataCache.set(cacheKey, answers, 1 * 60 * 1000) // 1 minute cache
      return answers
    }
    
    return []
  } catch (error) {
    console.error('Error fetching answers:', error)
    return []
  }
}

// Batch operations for better performance
export async function batchGetUserData(userIds: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {}
  const uncachedIds: string[] = []

  // Check cache for all users first
  for (const userId of userIds) {
    const cached = dataCache.getUserData(userId)
    if (cached) {
      results[userId] = cached
    } else {
      uncachedIds.push(userId)
    }
  }

  // ✅ Fetch uncached users in parallel from PostgreSQL
  if (uncachedIds.length > 0) {
    const { getUserData } = await import('./postgresql-adapter')
    const promises = uncachedIds.map(async (userId) => {
      try {
        const userData = await getUserData(userId)
        
        if (userData) {
          dataCache.setUserData(userId, userData)
          results[userId] = userData
        }
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error)
      }
    })

    await Promise.all(promises)
  }

  return results
}

// Real-time listeners with optimized callbacks - using WebSocket instead of Firebase
// Note: This function is deprecated. Use WebSocket hooks instead.
export function createOptimizedListener<T>(
  path: string,
  callback: (data: T | null) => void,
  options: {
    cacheKey?: string
    cacheTTL?: number
    throttleMs?: number
  } = {}
): () => void {
  console.warn('createOptimizedListener is deprecated. Use WebSocket hooks instead.')
  // Return a no-op cleanup function
  return () => {
    // No-op
  }
}

// Prefetch commonly used data
export async function prefetchCommonData(): Promise<void> {
  try {
    // Prefetch games list
    await getGamesList()
    
    // Prefetch user data for current user if available
    const currentUser = localStorage.getItem('player_name')
    if (currentUser) {
      const normalizedUser = currentUser.trim().replace(/\s+/g, '')
      await getUserData(normalizedUser)
    }
  } catch (error) {
    console.error('Error prefetching common data:', error)
  }
}

// Clear cache when needed
export function clearCache(): void {
  dataCache.clear()
}

// Invalidate specific cache entries
export function invalidateGameCache(gameId: string): void {
  dataCache.invalidateGame(gameId)
}

export function invalidateUserCache(userId: string): void {
  dataCache.invalidateUser(userId)
}
