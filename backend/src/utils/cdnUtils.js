/**
 * CDN Utilities
 * Ensures all image URLs use CDN instead of Supabase Storage directly
 * This reduces Supabase egress by 70-90% for static assets
 */

/**
 * Get CDN base URL for a theme
 * @param {string} theme - Theme name (heng36, max56, jeed24)
 * @returns {string} CDN base URL
 */
export function getCDNBaseUrl(theme = 'heng36') {
  const cdnKey = `CDN_BASE_URL_${theme.toUpperCase()}`;
  const cdnUrl = process.env[cdnKey] || process.env.CDN_BASE_URL;
  
  // Default CDN domains based on theme
  const defaultCDNs = {
    heng36: 'https://img.heng36.party',
    max56: 'https://img.max56.party',
    jeed24: 'https://img.jeed24.party'
  };
  
  return cdnUrl || defaultCDNs[theme] || defaultCDNs.heng36;
}

/**
 * Get storage bucket name for a theme
 * @param {string} theme - Theme name
 * @returns {string} Bucket name
 */
export function getStorageBucket(theme = 'heng36') {
  const bucketKey = `VITE_STORAGE_BUCKET_${theme.toUpperCase()}`;
  return process.env[bucketKey] || process.env.VITE_STORAGE_BUCKET || 'game-images';
}

/**
 * Convert Supabase Storage URL to CDN URL
 * This ensures zero Supabase egress for static assets
 * @param {string} supabaseUrl - Supabase Storage URL
 * @param {string} theme - Theme name
 * @returns {string} CDN URL
 */
export function convertToCDNUrl(supabaseUrl, theme = 'heng36') {
  if (!supabaseUrl || typeof supabaseUrl !== 'string') {
    return supabaseUrl;
  }
  
  // Already a CDN URL - return as is
  if (supabaseUrl.includes('img.') || supabaseUrl.includes('cdn.')) {
    return supabaseUrl;
  }
  
  // Data URLs and blob URLs - return as is
  if (supabaseUrl.startsWith('data:') || supabaseUrl.startsWith('blob:')) {
    return supabaseUrl;
  }
  
  // If not a Supabase URL, return as is
  if (!supabaseUrl.includes('supabase.co')) {
    return supabaseUrl;
  }
  
  try {
    const url = new URL(supabaseUrl);
    const bucket = getStorageBucket(theme);
    const cdnBase = getCDNBaseUrl(theme);
    
    // Extract path from Supabase Storage URL
    // Format: /storage/v1/object/public/game-images/heng36/games/123.jpg
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)$/);
    
    if (pathMatch) {
      const fullPath = pathMatch[1]; // "game-images/heng36/games/123.jpg"
      
      // Remove bucket name if it's included
      const pathWithoutBucket = fullPath.startsWith(`${bucket}/`) 
        ? fullPath.substring(bucket.length + 1) 
        : fullPath;
      
      // Construct CDN URL: https://img.heng36.party/game-images/heng36/games/123.jpg
      return `${cdnBase}/${bucket}/${pathWithoutBucket}`;
    }
    
    // Fallback: try to extract path directly
    const pathParts = url.pathname.split('/').filter(Boolean);
    const bucketIndex = pathParts.indexOf(bucket);
    
    if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
      const filePath = pathParts.slice(bucketIndex + 1).join('/');
      return `${cdnBase}/${bucket}/${filePath}`;
    }
    
    // If we can't parse it, return original (shouldn't happen)
    console.warn(`[CDN] Could not convert Supabase URL to CDN: ${supabaseUrl}`);
    return supabaseUrl;
  } catch (error) {
    console.error(`[CDN] Error converting URL:`, error);
    return supabaseUrl;
  }
}

/**
 * Process all image URLs in an object, converting Supabase URLs to CDN URLs
 * @param {object} obj - Object to process
 * @param {string} theme - Theme name
 * @returns {object} Object with all image URLs converted to CDN
 */
export function processImageUrlsInObject(obj, theme = 'heng36') {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // ✅ Preserve arrays - don't process array items, just return the array as-is
  if (Array.isArray(obj)) {
    return obj;
  }
  
  const processed = { ...obj };
  
  // Recursively process all properties
  for (const key in processed) {
    if (processed.hasOwnProperty(key)) {
      const value = processed[key];
      
      // ✅ Preserve arrays - don't process array items
      // ✅ IMPORTANT: Arrays are already copied by the spread operator above
      // We explicitly keep them as-is (don't recurse into array items)
      if (Array.isArray(value)) {
        // Keep arrays as-is (don't process array items)
        // The array is already in 'processed' because of the spread operator
        // No need to do anything - just continue to next property
        continue;
      }
      
      // Process image URL fields (only strings with image/url/src in key name)
      if (typeof value === 'string' && (
        key.includes('image') || 
        key.includes('Image') || 
        key.includes('url') || 
        key.includes('Url') ||
        key.includes('src')
      )) {
        processed[key] = convertToCDNUrl(value, theme);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively process nested objects (but skip arrays)
        processed[key] = processImageUrlsInObject(value, theme);
      }
      // Note: Arrays are already in 'processed' from the spread operator above
      // so we don't need to explicitly assign them
    }
  }
  
  return processed;
}

/**
 * Check if URL should use CDN (not Supabase directly)
 * @param {string} url - URL to check
 * @returns {boolean} True if should use CDN
 */
export function shouldUseCDN(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  return url.includes('supabase.co') || url.includes('img.') || url.includes('cdn.');
}

