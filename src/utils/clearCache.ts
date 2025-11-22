/**
 * Clear Cache Utility
 * ฟังก์ชันสำหรับล้าง cache ทั้งหมด
 */

import { dataCache } from '../services/cache'

/**
 * ล้าง cache ทั้งหมด
 */
export function clearAllCache() {
  dataCache.clear()
  console.log('✅ Cache cleared')
}

/**
 * ล้าง cache ของ games list
 */
export function clearGamesListCache() {
  dataCache.delete('games:list')
  console.log('✅ Games list cache cleared')
}

/**
 * ล้าง cache ของ game ใดๆ
 */
export function clearGameCache(gameId: string) {
  dataCache.invalidateGame(gameId)
  console.log(`✅ Game cache cleared: ${gameId}`)
}

