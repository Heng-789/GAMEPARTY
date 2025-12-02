/**
 * Socket.io Broadcast Debouncing
 * Reduces realtime traffic by batching and debouncing updates
 * Goal: Reduce unnecessary realtime traffic by 50-70%
 */

// Debounce timers: key -> timer
const debounceTimers = new Map();

// Batched updates: key -> array of updates
const batchedUpdates = new Map();

/**
 * Debounce a socket broadcast
 * @param {string} key - Unique key for this broadcast (e.g., "game:gameId")
 * @param {Function} broadcastFn - Function to call for broadcast
 * @param {number} delay - Debounce delay in milliseconds (default: 100ms)
 */
export function debounceBroadcast(key, broadcastFn, delay = 100) {
  // Clear existing timer
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key));
  }
  
  // Set new timer
  const timer = setTimeout(() => {
    broadcastFn();
    debounceTimers.delete(key);
  }, delay);
  
  debounceTimers.set(key, timer);
}

/**
 * Batch multiple updates into a single broadcast
 * @param {string} key - Unique key for this batch (e.g., "answers:gameId")
 * @param {any} update - Update data to batch
 * @param {Function} broadcastFn - Function to call with batched updates
 * @param {number} maxDelay - Maximum delay before broadcasting (default: 500ms)
 * @param {number} maxBatchSize - Maximum batch size before forcing broadcast (default: 10)
 */
export function batchBroadcast(key, update, broadcastFn, maxDelay = 500, maxBatchSize = 10) {
  // Initialize batch if needed
  if (!batchedUpdates.has(key)) {
    batchedUpdates.set(key, []);
  }
  
  const batch = batchedUpdates.get(key);
  batch.push(update);
  
  // Force broadcast if batch is too large
  if (batch.length >= maxBatchSize) {
    const updates = [...batch];
    batch.length = 0; // Clear batch
    batchedUpdates.delete(key);
    
    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key));
      debounceTimers.delete(key);
    }
    
    broadcastFn(updates);
    return;
  }
  
  // Clear existing timer
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key));
  }
  
  // Set new timer
  const timer = setTimeout(() => {
    const updates = [...batch];
    batch.length = 0; // Clear batch
    batchedUpdates.delete(key);
    debounceTimers.delete(key);
    
    if (updates.length > 0) {
      broadcastFn(updates);
    }
  }, maxDelay);
  
  debounceTimers.set(key, timer);
}

/**
 * Clear all debounce timers and batches
 */
export function clearAllDebounces() {
  debounceTimers.forEach(timer => clearTimeout(timer));
  debounceTimers.clear();
  batchedUpdates.clear();
}

/**
 * Clear debounce for a specific key
 */
export function clearDebounce(key) {
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key));
    debounceTimers.delete(key);
  }
  batchedUpdates.delete(key);
}

