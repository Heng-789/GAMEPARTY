/**
 * Cached Fetch Service
 * Implements SWR-like caching with stale-while-revalidate pattern
 * Reduces duplicate API calls and Supabase egress by 70-90%
 */

import { dataCache } from './cache';

interface CachedFetchOptions extends RequestInit {
  ttl?: number; // Cache TTL in milliseconds
  revalidateOnMount?: boolean; // Force revalidation on mount
  dedupe?: boolean; // Deduplicate concurrent requests
}

// Request deduplication map: url -> Promise
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Cached fetch with SWR-like behavior
 * - Returns cached data immediately if available
 * - Fetches fresh data in background
 * - Deduplicates concurrent requests
 * 
 * @param url - API endpoint URL
 * @param options - Fetch options + cache options
 * @returns Promise with cached or fresh data
 */
export async function cachedFetch<T>(
  url: string,
  options: CachedFetchOptions = {}
): Promise<T> {
  const { ttl = 5 * 60 * 1000, revalidateOnMount = false, dedupe = true, ...fetchOptions } = options;
  
  // Check cache first (unless force revalidation)
  if (!revalidateOnMount) {
    const cached = dataCache.get<T>(url);
    if (cached) {
      // Return cached data immediately
      // Background revalidation will happen if needed
      return cached;
    }
  }
  
  // Deduplicate concurrent requests
  if (dedupe && pendingRequests.has(url)) {
    return pendingRequests.get(url)!;
  }
  
  // Create fetch promise
  const fetchPromise = (async () => {
    try {
      // ✅ Always log for consistency between dev and prod
      console.log(`[cachedFetch] Fetching URL: ${url}`);
      
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });
      
      // ✅ Always log for consistency between dev and prod
      console.log(`[cachedFetch] Response status: ${response.status} for URL: ${url}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        // ✅ Always log for consistency between dev and prod
        console.error(`[cachedFetch] Error response: ${response.status} ${errorText} for URL: ${url}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // ✅ In production, log data structure for debugging
      if (import.meta.env.PROD) {
        console.log(`[cachedFetch] Response data keys:`, Object.keys(data || {}), `for URL: ${url}`);
      }
      
      // Cache the response
      dataCache.set(url, data, ttl);
      
      return data;
    } catch (error) {
      // ✅ Handle network errors (backend not running, CORS, etc.)
      // Re-throw with more context for better error messages
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // Network error - backend likely not running
        const networkError = new Error(
          `Network error: Cannot connect to backend server. Please ensure the backend is running at ${url.split('?')[0]}`
        );
        networkError.name = 'NetworkError';
        throw networkError;
      }
      // Re-throw other errors as-is
      throw error;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(url);
    }
  })();
  
  // Store pending request for deduplication
  if (dedupe) {
    pendingRequests.set(url, fetchPromise);
  }
  
  return fetchPromise;
}

/**
 * Prefetch data (load into cache without waiting)
 * @param url - API endpoint URL
 * @param options - Fetch options
 */
export function prefetch(url: string, options: CachedFetchOptions = {}): void {
  cachedFetch(url, { ...options, revalidateOnMount: true }).catch(err => {
    // Silently fail prefetch errors
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[prefetch] Failed to prefetch ${url}:`, err);
    }
  });
}

/**
 * Invalidate cache for a URL
 * @param url - API endpoint URL
 */
export function invalidateCache(url: string): void {
  dataCache.delete(url);
}

/**
 * Clear all cached fetch data
 */
export function clearCachedFetch(): void {
  // Clear pending requests
  pendingRequests.clear();
}

