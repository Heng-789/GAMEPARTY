/**
 * Diff Engine for Socket.io Broadcasting
 * 
 * Computes minimal patches between states to reduce bandwidth.
 * Loads last state from cache, computes diff, emits patch, saves new state.
 */

import * as jsondiffpatch from 'jsondiffpatch';
import { getCache, setCache } from '../cache/cacheService.js';

const differ = jsondiffpatch.create({
  objectHash: (obj) => obj.id || obj.game_id || JSON.stringify(obj),
  arrays: {
    detectMove: true,
    includeValueOnMove: false,
  },
  textDiff: {
    minLength: 60,
  },
});

/**
 * Compute diff between previous and new state
 * @param {any} prevState - Previous state
 * @param {any} newState - New state
 * @returns {object|null} - Diff patch or null if no changes
 */
export function computeDiff(prevState, newState) {
  if (!prevState || !newState) {
    return null; // Can't diff if either is missing
  }
  
  try {
    const patch = differ.diff(prevState, newState);
    
    if (!patch || Object.keys(patch).length === 0) {
      return null; // No changes
    }
    
    return patch;
  } catch (error) {
    console.error('[Diff] Error computing diff:', error);
    return null; // Return null on error, will send full state
  }
}

/**
 * Merge state with diff patch
 * @param {any} oldState - Old state
 * @param {object} diff - Diff patch
 * @returns {any} - Merged state
 */
export function mergeState(oldState, diff) {
  try {
    return differ.patch(oldState, diff);
  } catch (error) {
    console.error('[Diff] Error merging state:', error);
    return oldState; // Return old state on error
  }
}

/**
 * Get diff for game update
 * Loads last state from cache, computes diff, saves new state
 * @param {string} gameId - Game ID
 * @param {any} newState - New game state
 * @returns {Promise<{patch: object|null, hasChanges: boolean}>}
 */
export async function getGameDiff(gameId, newState) {
  const cacheKey = `diff:game:${gameId}`;
  
  // Load last state
  const prevState = await getCache(cacheKey);
  
  if (!prevState) {
    // First time, save state and return null (signal to send full state)
    await setCache(cacheKey, newState, 3600); // 1 hour TTL
    return { patch: null, hasChanges: false };
  }
  
  // Compute diff
  const patch = computeDiff(prevState, newState);
  
  if (!patch) {
    return { patch: null, hasChanges: false };
  }
  
  // Save new state
  await setCache(cacheKey, newState, 3600);
  
  return {
    patch,
    hasChanges: true,
  };
}

/**
 * Get diff for checkin update
 */
export async function getCheckinDiff(gameId, userId, newState) {
  const cacheKey = `diff:checkin:${gameId}:${userId}`;
  
  const prevState = await getCache(cacheKey);
  
  if (!prevState) {
    await setCache(cacheKey, newState, 3600);
    return { patch: null, hasChanges: false };
  }
  
  const patch = computeDiff(prevState, newState);
  
  if (!patch) {
    return { patch: null, hasChanges: false };
  }
  
  await setCache(cacheKey, newState, 3600);
  
  return {
    patch,
    hasChanges: true,
  };
}

/**
 * Get diff for bingo update
 */
export async function getBingoDiff(gameId, newState) {
  const cacheKey = `diff:bingo:${gameId}`;
  
  const prevState = await getCache(cacheKey);
  
  if (!prevState) {
    await setCache(cacheKey, newState, 3600);
    return { patch: null, hasChanges: false };
  }
  
  const patch = computeDiff(prevState, newState);
  
  if (!patch) {
    return { patch: null, hasChanges: false };
  }
  
  await setCache(cacheKey, newState, 3600);
  
  return {
    patch,
    hasChanges: true,
  };
}

