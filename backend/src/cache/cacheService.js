/**
 * Cache Service
 * 
 * Clean cache layer abstraction using Upstash Redis.
 * Falls back to in-memory cache if Redis unavailable.
 * 
 * Cache keys format: "game:{id}", "user:{id}", "checkin:{g}:{u}"
 */

import { getRedis, isRedisAvailable } from './upstashClient.js';

// Fallback in-memory cache
const memoryCache = new Map();

/**
 * Get from cache
 * @param {string} key - Cache key (e.g., "game:123")
 * @returns {Promise<any|null>}
 */
export async function getCache(key) {
  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const redis = getRedis();
      const data = await redis.get(key);
      if (data !== null) {
        return data; // Upstash automatically handles JSON
      }
    } catch (error) {
      console.error(`[Cache] Redis get error for ${key}:`, error.message);
      // Fall through to memory cache
    }
  }
  
  // Fallback to memory cache
  const entry = memoryCache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl * 1000) {
    memoryCache.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Set cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<boolean>}
 */
export async function setCache(key, value, ttlSeconds = 60) {
  // Set in Redis
  if (isRedisAvailable()) {
    try {
      const redis = getRedis();
      if (ttlSeconds > 0) {
        await redis.setex(key, ttlSeconds, value); // Upstash handles JSON automatically
      } else {
        await redis.set(key, value);
      }
    } catch (error) {
      console.error(`[Cache] Redis set error for ${key}:`, error.message);
      // Fall through to memory cache
    }
  }
  
  // Also set in memory cache as backup
  memoryCache.set(key, {
    data: value,
    timestamp: Date.now(),
    ttl: ttlSeconds
  });
  
  return true;
}

/**
 * Delete from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
export async function delCache(key) {
  // Delete from Redis
  if (isRedisAvailable()) {
    try {
      const redis = getRedis();
      await redis.del(key);
    } catch (error) {
      console.error(`[Cache] Redis delete error for ${key}:`, error.message);
    }
  }
  
  // Delete from memory
  memoryCache.delete(key);
  
  return true;
}

/**
 * Wrap a function with cache
 * Fetches data if not in cache, otherwise returns cached value
 * @param {string} key - Cache key
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {Function} fetcherFunction - Async function that fetches the data
 * @returns {Promise<any>}
 */
export async function wrapCache(key, ttlSeconds, fetcherFunction) {
  // Try cache first
  const cached = await getCache(key);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch data
  const data = await fetcherFunction();
  
  // Store in cache
  if (data !== null && data !== undefined) {
    await setCache(key, data, ttlSeconds);
  }
  
  return data;
}

/**
 * Batch delete cache keys by pattern (for invalidation)
 * Note: Upstash doesn't support SCAN, so we'll use a prefix-based approach
 * @param {string} prefix - Key prefix (e.g., "game:")
 * @returns {Promise<number>} - Number of keys deleted
 */
export async function delCacheByPrefix(prefix) {
  let deletedCount = 0;
  
  // For memory cache, we can iterate
  const memoryKeys = Array.from(memoryCache.keys()).filter(k => k.startsWith(prefix));
  memoryKeys.forEach(key => {
    memoryCache.delete(key);
    deletedCount++;
  });
  
  // For Redis, we can't scan efficiently with Upstash REST API
  // So we'll track keys manually or use a different strategy
  // For now, we'll just log a warning
  if (isRedisAvailable()) {
    console.warn(`[Cache] Pattern deletion for "${prefix}" not fully supported with Upstash. Consider using specific keys.`);
  }
  
  return deletedCount;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    redis: {
      enabled: isRedisAvailable(),
    },
    memory: {
      size: memoryCache.size,
    }
  };
}

/**
 * Clear all cache (use with caution)
 */
export async function clearAllCache() {
  memoryCache.clear();
  
  if (isRedisAvailable()) {
    console.warn('[Cache] clearAllCache() called - Redis keys not cleared (Upstash limitation)');
  }
}

