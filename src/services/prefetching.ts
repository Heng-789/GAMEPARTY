// Data prefetching service for improved user experience
import React, { useState, useEffect } from 'react'
import { dataCache, cacheKeys } from './cache'
import { getGameData, getGamesList, getUserData } from './postgresql-adapter'

// Prefetch strategies
export enum PrefetchStrategy {
  IMMEDIATE = 'immediate',
  IDLE = 'idle',
  HOVER = 'hover',
  VISIBLE = 'visible'
}

// Prefetch manager
class PrefetchManager {
  private prefetchQueue: Set<string> = new Set()
  private prefetchCache: Map<string, Promise<any>> = new Map()
  private isIdle = false

  constructor() {
    // Use requestIdleCallback if available
    if ('requestIdleCallback' in window) {
      const idleCallback = () => {
        this.isIdle = true
        this.processQueue()
        requestIdleCallback(idleCallback)
      }
      requestIdleCallback(idleCallback)
    } else {
      // Fallback to setTimeout
      setInterval(() => {
        this.isIdle = true
        this.processQueue()
      }, 1000)
    }
  }

  private async processQueue() {
    if (!this.isIdle || this.prefetchQueue.size === 0) return

    const items = Array.from(this.prefetchQueue)
    this.prefetchQueue.clear()

    // Process items in batches
    const batchSize = 3
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      await Promise.allSettled(batch.map(item => this.prefetchItem(item)))
    }
  }

  private async prefetchItem(key: string) {
    if (this.prefetchCache.has(key)) {
      return this.prefetchCache.get(key)
    }

    const promise = this.executePrefetch(key)
    this.prefetchCache.set(key, promise)
    return promise
  }

  private async executePrefetch(key: string) {
    try {
      const [type, ...parts] = key.split(':')
      
      switch (type) {
        case 'game':
          return await getGameData(parts[0])
        case 'games':
          return await getGamesList()
        case 'user':
          return await getUserData(parts[0])
        case 'users':
          // Batch get users - fetch individually for now
          const users = await Promise.all(parts.map(userId => getUserData(userId)))
          return users.filter(Boolean)
        default:
          console.warn(`Unknown prefetch type: ${type}`)
      }
    } catch (error) {
      console.error(`Failed to prefetch ${key}:`, error)
    }
  }

  addToQueue(key: string, strategy: PrefetchStrategy = PrefetchStrategy.IDLE) {
    if (strategy === PrefetchStrategy.IMMEDIATE) {
      this.prefetchItem(key)
    } else {
      this.prefetchQueue.add(key)
    }
  }

  clearQueue() {
    this.prefetchQueue.clear()
    this.prefetchCache.clear()
  }
}

export const prefetchManager = new PrefetchManager()

// Prefetch hooks
export function usePrefetch() {
  const prefetchGame = (gameId: string, strategy: PrefetchStrategy = PrefetchStrategy.IDLE) => {
    prefetchManager.addToQueue(`game:${gameId}`, strategy)
  }

  const prefetchGamesList = (strategy: PrefetchStrategy = PrefetchStrategy.IDLE) => {
    prefetchManager.addToQueue('games:list', strategy)
  }

  const prefetchUser = (userId: string, strategy: PrefetchStrategy = PrefetchStrategy.IDLE) => {
    prefetchManager.addToQueue(`user:${userId}`, strategy)
  }

  const prefetchUsers = (userIds: string[], strategy: PrefetchStrategy = PrefetchStrategy.IDLE) => {
    prefetchManager.addToQueue(`users:${userIds.join(',')}`, strategy)
  }

  return {
    prefetchGame,
    prefetchGamesList,
    prefetchUser,
    prefetchUsers
  }
}

// Route-based prefetching
export function useRoutePrefetching() {
  const prefetch = usePrefetch()

  // Prefetch based on current route
  const prefetchForRoute = (route: string) => {
    switch (route) {
      case '/':
        prefetch.prefetchGamesList(PrefetchStrategy.IMMEDIATE)
        break
      case '/games':
        prefetch.prefetchGamesList(PrefetchStrategy.IMMEDIATE)
        break
      case '/create':
        // Prefetch common game templates
        break
      default:
        if (route.startsWith('/play/')) {
          const gameId = route.split('/')[2]
          if (gameId) {
            prefetch.prefetchGame(gameId, PrefetchStrategy.IMMEDIATE)
          }
        }
    }
  }

  return { prefetchForRoute }
}

// User behavior-based prefetching
export function useBehaviorPrefetching() {
  const prefetch = usePrefetch()

  // Prefetch on hover
  const handleGameHover = (gameId: string) => {
    prefetch.prefetchGame(gameId, PrefetchStrategy.HOVER)
  }

  // Prefetch on visibility
  const handleGameVisible = (gameId: string) => {
    prefetch.prefetchGame(gameId, PrefetchStrategy.VISIBLE)
  }

  // Prefetch related data
  const prefetchRelatedData = (gameId: string, gameType: string) => {
    // Prefetch based on game type
    switch (gameType) {
      case 'เกมเช็คอิน':
        // Prefetch user data for checkin games
        const currentUser = localStorage.getItem('player_name')
        if (currentUser) {
          prefetch.prefetchUser(currentUser, PrefetchStrategy.IDLE)
        }
        break
      case 'เกมทายภาพปริศนา':
        // Prefetch answers data
        break
    }
  }

  return {
    handleGameHover,
    handleGameVisible,
    prefetchRelatedData
  }
}

// Critical resource prefetching
export function prefetchCriticalResources() {
  // Prefetch essential resources immediately
  prefetchManager.addToQueue('games:list', PrefetchStrategy.IMMEDIATE)
  
  // Prefetch current user data if available
  const currentUser = localStorage.getItem('player_name')
  if (currentUser) {
    prefetchManager.addToQueue(`user:${currentUser}`, PrefetchStrategy.IMMEDIATE)
  }
}

// Prefetch on app start
export function initializePrefetching() {
  // Prefetch critical resources
  prefetchCriticalResources()

  // Set up route change prefetching
  if (typeof window !== 'undefined') {
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      const url = new URL(args[2] as string, window.location.origin)
      prefetchForRoute(url.pathname)
    }

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      const url = new URL(args[2] as string, window.location.origin)
      prefetchForRoute(url.pathname)
    }

    // Listen for popstate events
    window.addEventListener('popstate', () => {
      prefetchForRoute(window.location.pathname)
    })
  }
}

// Prefetch for specific route
function prefetchForRoute(route: string) {
  const prefetch = usePrefetch()
  
  switch (route) {
    case '/':
      prefetch.prefetchGamesList(PrefetchStrategy.IDLE)
      break
    case '/games':
      prefetch.prefetchGamesList(PrefetchStrategy.IDLE)
      break
    default:
      if (route.startsWith('/play/')) {
        const gameId = route.split('/')[2]
        if (gameId) {
          prefetch.prefetchGame(gameId, PrefetchStrategy.IDLE)
        }
      }
  }
}

// Performance monitoring for prefetching
export function usePrefetchPerformance() {
  const [stats, setStats] = useState({
    prefetched: 0,
    hitRate: 0,
    missRate: 0
  })

  useEffect(() => {
    const updateStats = () => {
      const cacheSize = dataCache['cache'].size
      setStats(prev => ({
        ...prev,
        prefetched: cacheSize,
        hitRate: 0, // This would need to be tracked
        missRate: 0 // This would need to be tracked
      }))
    }

    const interval = setInterval(updateStats, 5000)
    return () => clearInterval(interval)
  }, [])

  return stats
}

// Cleanup prefetching resources
export function cleanupPrefetching() {
  prefetchManager.clearQueue()
  dataCache.clear()
}
