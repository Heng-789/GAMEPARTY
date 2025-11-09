// Optimized Firebase service with caching and better query patterns
import { ref, onValue, get, runTransaction, set, query, orderByChild, limitToLast, startAt, endAt } from 'firebase/database'
import { db } from './firebase'
import { dataCache, cacheKeys } from './cache'

// Optimized game data fetching with caching
export async function getGameData(gameId: string): Promise<any | null> {
  // Check cache first using the same key as useGameData
  const cacheKey = cacheKeys.game(gameId)
  const cached = dataCache.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const gameRef = ref(db, `games/${gameId}`)
    const snapshot = await get(gameRef)
    
    if (!snapshot.exists()) {
      return null
    }

    const gameData = { id: gameId, ...snapshot.val() }
    
    // Cache the result using the same key
    dataCache.set(cacheKey, gameData, 2 * 60 * 1000) // 2 minutes cache
    
    return gameData
  } catch (error) {
    console.error('Error fetching game data:', error)
    return null
  }
}

// Optimized games list fetching with caching
export async function getGamesList(): Promise<any[]> {
  // Check cache first using the same key as useGamesList
  const cacheKey = cacheKeys.gamesList()
  const cached = dataCache.get<any[]>(cacheKey)
  if (cached && Array.isArray(cached)) {
    return cached
  }

  try {
    const gamesRef = ref(db, 'games')
    const snapshot = await get(gamesRef)
    
    if (!snapshot.exists()) {
      return []
    }

    const raw = snapshot.val() as Record<string, any>
    const gamesList: any[] = []
    
    // Process games more efficiently
    for (const [key, game] of Object.entries(raw)) {
      if (!game) continue
      
      const gameName = (game.name || game.title || '').trim()
      // ✅ กรองเกมที่ไม่มีชื่อหรือชื่อเป็น empty string ออก
      if (!gameName || gameName.length === 0) continue
      
      gamesList.push({
        id: game.id || key,
        name: gameName,
        type: game.type || 'เกมทายภาพปริศนา',
        createdAt: game.createdAt ?? game.updatedAt ?? 0,
        unlocked: game.unlocked !== undefined ? game.unlocked : (game.locked === false),
        locked: game.locked !== undefined ? game.locked : (game.unlocked === false),
      })
    }

    // Sort by creation date (newest first)
    gamesList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    
    // Cache the result using the same key
    dataCache.set(cacheKey, gamesList, 2 * 60 * 1000) // 2 minutes cache
    
    return gamesList
  } catch (error) {
    console.error('Error fetching games list:', error)
    return []
  }
}

// Optimized user data fetching
export async function getUserData(userId: string): Promise<any | null> {
  // Check cache first using the same key as useUserData
  const cacheKey = cacheKeys.user(userId)
  const cached = dataCache.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const userRef = ref(db, `USERS_EXTRA/${userId}`)
    const snapshot = await get(userRef)
    
    if (!snapshot.exists()) {
      return null
    }

    const userData = snapshot.val()
    dataCache.set(cacheKey, userData, 10 * 60 * 1000) // 10 minutes cache
    
    return userData
  } catch (error) {
    console.error('Error fetching user data:', error)
    return null
  }
}

// Optimized checkin data fetching
export async function getCheckinData(gameId: string, userId: string): Promise<any | null> {
  const cacheKey = cacheKeys.checkinData(gameId, userId)
  const cached = dataCache.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const checkinRef = ref(db, `checkins/${gameId}/${userId}`)
    const snapshot = await get(checkinRef)
    
    const checkinData = snapshot.exists() ? snapshot.val() : {}
    dataCache.set(cacheKey, checkinData, 2 * 60 * 1000) // 2 minutes cache
    
    return checkinData
  } catch (error) {
    console.error('Error fetching checkin data:', error)
    return null
  }
}

// Optimized answers fetching with pagination
export async function getAnswers(gameId: string, limit: number = 50): Promise<any[]> {
  const cacheKey = cacheKeys.answers(gameId)
  const cached = dataCache.get<any[]>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const answersRef = ref(db, `answers/${gameId}`)
    const answersQuery = query(answersRef, orderByChild('ts'), limitToLast(limit))
    const snapshot = await get(answersQuery)
    
    if (!snapshot.exists()) {
      return []
    }

    const raw = snapshot.val() as Record<string, any>
    const answers = Object.entries(raw)
      .map(([key, value]) => ({ id: key, ...value }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))

    dataCache.set(cacheKey, answers, 1 * 60 * 1000) // 1 minute cache
    
    return answers
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

  // Fetch uncached users in parallel
  if (uncachedIds.length > 0) {
    const promises = uncachedIds.map(async (userId) => {
      try {
        const userRef = ref(db, `USERS_EXTRA/${userId}`)
        const snapshot = await get(userRef)
        const userData = snapshot.exists() ? snapshot.val() : null
        
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

// Real-time listeners with optimized callbacks
export function createOptimizedListener<T>(
  path: string,
  callback: (data: T | null) => void,
  options: {
    cacheKey?: string
    cacheTTL?: number
    throttleMs?: number
  } = {}
): () => void {
  const { cacheKey, cacheTTL = 60000, throttleMs = 100 } = options
  let lastUpdate = 0
  let pendingUpdate: NodeJS.Timeout | null = null
  let latestData: T | null = null

  const throttledCallback = (data: T | null) => {
    latestData = data
    
    // Cache the data if cacheKey is provided
    if (cacheKey && data) {
      dataCache.set(cacheKey, data, cacheTTL)
    }
    
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdate
    
    // If enough time has passed, update immediately
    if (timeSinceLastUpdate >= throttleMs) {
      lastUpdate = now
      callback(data)
    } else {
      // Otherwise, schedule an update
      if (pendingUpdate) {
        clearTimeout(pendingUpdate)
      }
      pendingUpdate = setTimeout(() => {
        lastUpdate = Date.now()
        callback(latestData)
        pendingUpdate = null
      }, throttleMs - timeSinceLastUpdate)
    }
  }

  const refPath = ref(db, path)
  
  const unsubscribe = onValue(refPath, (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : null
    throttledCallback(data)
  })
  
  // Return cleanup function
  return () => {
    if (pendingUpdate) {
      clearTimeout(pendingUpdate)
    }
    unsubscribe()
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
