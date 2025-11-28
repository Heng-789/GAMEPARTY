/**
 * Upstash Redis Client
 * 
 * Provides Upstash Redis connection for caching.
 * Uses REST API (no persistent connection needed).
 */

import { Redis } from "@upstash/redis";
import dotenv from 'dotenv';

dotenv.config();

let redis = null;
let redisEnabled = false;

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Initialize Upstash Redis client
 */
export function initUpstashRedis() {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.log('⚠️  Upstash Redis not configured (missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN)');
    console.log('⚠️  Falling back to in-memory cache');
    redisEnabled = false;
    return null;
  }

  try {
    redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });

    redisEnabled = true;
    console.log('✅ Upstash Redis initialized');
    return redis;
  } catch (error) {
    console.error('❌ Failed to initialize Upstash Redis:', error.message);
    console.log('⚠️  Falling back to in-memory cache');
    redisEnabled = false;
    return null;
  }
}

/**
 * Get Redis client (returns null if not available)
 */
export function getRedis() {
  return redisEnabled ? redis : null;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable() {
  return redisEnabled && redis !== null;
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth() {
  if (!isRedisAvailable()) {
    return { status: 'unavailable', connected: false };
  }

  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    return {
      status: 'ok',
      connected: true,
      latency: `${latency}ms`
    };
  } catch (error) {
    return {
      status: 'error',
      connected: false,
      error: error.message
    };
  }
}

// Initialize on module load
initUpstashRedis();

export default redis;

