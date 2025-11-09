// Optimized data fetching hooks with caching and performance optimizations
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../services/firebase'
import { dataCache, cacheKeys } from '../services/cache'
import { 
  getGameData, 
  getGamesList, 
  getUserData, 
  getCheckinData,
  createOptimizedListener 
} from '../services/firebase-optimized'

// Generic hook for cached data fetching
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  options: {
    ttl?: number
    enabled?: boolean
    refetchOnMount?: boolean
  } = {}
): {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
} {
  const { ttl = 5 * 60 * 1000, enabled = true, refetchOnMount = false } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      // Check cache first
      const cached = dataCache.get<T>(key)
      if (cached && !refetchOnMount) {
        setData(cached)
        setLoading(false)
        return
      }

      // Fetch fresh data
      const result = await fetcher()
      
      if (mountedRef.current) {
        setData(result)
        if (result) {
          dataCache.set(key, result, ttl)
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [key, fetcher, ttl, enabled, refetchOnMount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { data, loading, error, refetch: fetchData }
}

// Optimized game data hook - simplified version
export function useGameData(gameId: string | null) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    if (!gameId) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const fetchGameData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Check cache first
        const cacheKey = cacheKeys.game(gameId)
        const cached = dataCache.get(cacheKey)
        if (cached) {
          setData(cached)
          setLoading(false)
          return
        }

        // Fetch from Firebase
        const gameRef = ref(db, `games/${gameId}`)
        const snapshot = await get(gameRef)
        
        if (!snapshot.exists()) {
          setData(null)
          setLoading(false)
          return
        }

        const gameData = { id: gameId, ...snapshot.val() }
        
        if (mountedRef.current) {
          setData(gameData)
          // Cache the result
          dataCache.set(cacheKey, gameData, 2 * 60 * 1000)
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch game data')
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    fetchGameData()
  }, [gameId])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { data, loading, error, refetch: () => {} }
}

// Optimized games list hook
export function useGamesList() {
  const fetcher = useCallback(async () => {
    return await getGamesList()
  }, [])

  return useCachedData(
    cacheKeys.gamesList(),
    fetcher,
    { ttl: 2 * 60 * 1000 } // 2 minutes cache
  )
}

// Optimized user data hook
export function useUserData(userId: string | null) {
  const fetcher = useCallback(async () => {
    if (!userId) return null
    return await getUserData(userId)
  }, [userId])

  return useCachedData(
    userId ? cacheKeys.user(userId) : '',
    fetcher,
    { ttl: 10 * 60 * 1000 } // 10 minutes cache
  )
}

// Optimized checkin data hook
export function useCheckinData(gameId: string | null, userId: string | null) {
  const fetcher = useCallback(async () => {
    if (!gameId || !userId) return null
    return await getCheckinData(gameId, userId)
  }, [gameId, userId])

  return useCachedData(
    gameId && userId ? cacheKeys.checkinData(gameId, userId) : '',
    fetcher,
    { ttl: 2 * 60 * 1000 } // 2 minutes cache
  )
}

// Real-time data hook with optimized listeners
export function useRealtimeData<T>(
  path: string,
  options: {
    cacheKey?: string
    cacheTTL?: number
    throttleMs?: number
    enabled?: boolean
  } = {}
): {
  data: T | null
  loading: boolean
  error: string | null
} {
  const { cacheKey, cacheTTL = 60000, throttleMs = 100, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    // Check cache first
    if (cacheKey) {
      const cached = dataCache.get<T>(cacheKey)
      if (cached) {
        setData(cached)
        setLoading(false)
      }
    }

    // Set up real-time listener
    const unsubscribe = createOptimizedListener<T>(
      path,
      (newData) => {
        if (mountedRef.current) {
          setData(newData)
          setLoading(false)
          setError(null)
        }
      },
      { cacheKey, cacheTTL, throttleMs }
    )

    return () => {
      unsubscribe()
    }
  }, [path, cacheKey, cacheTTL, throttleMs, enabled])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { data, loading, error }
}

// Batch data fetching hook
export function useBatchData<T>(
  keys: string[],
  fetcher: (keys: string[]) => Promise<Record<string, T>>,
  options: {
    ttl?: number
    enabled?: boolean
  } = {}
): {
  data: Record<string, T | null>
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
} {
  const { ttl = 5 * 60 * 1000, enabled = true } = options
  const [data, setData] = useState<Record<string, T | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (!enabled || keys.length === 0) return

    setLoading(true)
    setError(null)

    try {
      // Check cache for all keys first
      const cachedData: Record<string, T | null> = {}
      const uncachedKeys: string[] = []

      for (const key of keys) {
        const cached = dataCache.get<T>(key)
        if (cached) {
          cachedData[key] = cached
        } else {
          uncachedKeys.push(key)
        }
      }

      // Fetch uncached data
      let freshData: Record<string, T> = {}
      if (uncachedKeys.length > 0) {
        freshData = await fetcher(uncachedKeys)
        
        // Cache fresh data
        for (const [key, value] of Object.entries(freshData)) {
          dataCache.set(key, value, ttl)
        }
      }

      // Combine cached and fresh data
      const combinedData = { ...cachedData, ...freshData }
      
      if (mountedRef.current) {
        setData(combinedData)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [keys, fetcher, ttl, enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { data, loading, error, refetch: fetchData }
}

// Debounced search hook
export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
): {
  results: T[]
  loading: boolean
  error: string | null
  search: (query: string) => void
} {
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const search = useCallback((query: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    timeoutRef.current = setTimeout(async () => {
      try {
        const searchResults = await searchFn(query)
        setResults(searchResults)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    }, delay)
  }, [searchFn, delay])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { results, loading, error, search }
}
