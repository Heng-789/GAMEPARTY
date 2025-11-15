/**
 * Check-in Cache Service
 * Cache migration status และ check-in data เพื่อลดการอ่าน Firestore
 */

interface MigrationCache {
  migrated: boolean
  timestamp: number
}

interface CheckinCache {
  data: any
  timestamp: number
}

// ✅ Cache สำหรับ migration status (TTL: 1 ชั่วโมง)
const migrationCache = new Map<string, MigrationCache>()
const MIGRATION_CACHE_TTL = 60 * 60 * 1000 // 1 hour

// ✅ Cache สำหรับ check-in status (TTL: 5 นาที)
const checkinCache = new Map<string, CheckinCache>()
const CHECKIN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get migration cache key
 */
function getMigrationKey(gameId: string, userId: string, dayIndex: number): string {
  return `migration:${gameId}:${userId}:${dayIndex}`
}

/**
 * Get checkin cache key
 */
function getCheckinKey(gameId: string, userId: string, dayIndex: number): string {
  return `checkin:${gameId}:${userId}:${dayIndex}`
}

/**
 * Check if migration is cached
 */
export function isMigrationCached(gameId: string, userId: string, dayIndex: number): boolean {
  const key = getMigrationKey(gameId, userId, dayIndex)
  const cached = migrationCache.get(key)
  
  if (!cached) return false
  
  const now = Date.now()
  if (now - cached.timestamp > MIGRATION_CACHE_TTL) {
    migrationCache.delete(key)
    return false
  }
  
  return true
}

/**
 * Set migration cache
 */
export function setMigrationCache(
  gameId: string,
  userId: string,
  dayIndex: number,
  migrated: boolean
): void {
  const key = getMigrationKey(gameId, userId, dayIndex)
  migrationCache.set(key, {
    migrated,
    timestamp: Date.now()
  })
}

/**
 * Get checkin cache
 */
export function getCheckinCache(
  gameId: string,
  userId: string,
  dayIndex: number
): any | null {
  const key = getCheckinKey(gameId, userId, dayIndex)
  const cached = checkinCache.get(key)
  
  if (!cached) return null
  
  const now = Date.now()
  if (now - cached.timestamp > CHECKIN_CACHE_TTL) {
    checkinCache.delete(key)
    return null
  }
  
  return cached.data
}

/**
 * Set checkin cache
 */
export function setCheckinCache(
  gameId: string,
  userId: string,
  dayIndex: number,
  data: any
): void {
  const key = getCheckinKey(gameId, userId, dayIndex)
  checkinCache.set(key, {
    data,
    timestamp: Date.now()
  })
}

/**
 * Clear checkin cache for a user
 */
export function clearCheckinCache(gameId: string, userId: string, dayIndex?: number): void {
  if (dayIndex !== undefined) {
    const key = getCheckinKey(gameId, userId, dayIndex)
    checkinCache.delete(key)
  } else {
    // Clear all checkins for this user
    const prefix = `checkin:${gameId}:${userId}:`
    for (const key of checkinCache.keys()) {
      if (key.startsWith(prefix)) {
        checkinCache.delete(key)
      }
    }
  }
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  migrationCache.clear()
  checkinCache.clear()
}

