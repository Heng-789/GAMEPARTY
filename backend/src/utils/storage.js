/**
 * Utility functions for Supabase Storage operations
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Get Supabase client for a specific theme
 */
function getSupabaseClient(theme = 'heng36') {
  const urlKey = `SUPABASE_URL_${theme.toUpperCase()}`;
  const keyKey = `SUPABASE_ANON_KEY_${theme.toUpperCase()}`;
  
  // Fallback to generic keys if theme-specific keys don't exist
  const supabaseUrl = process.env[urlKey] || process.env.SUPABASE_URL;
  const supabaseKey = process.env[keyKey] || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Supabase credentials not found for theme: ${theme}`);
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Get storage bucket name for a specific theme
 */
function getStorageBucket(theme = 'heng36') {
  // Try theme-specific key first
  const bucketKey = `VITE_STORAGE_BUCKET_${theme.toUpperCase()}`;
  const bucket = process.env[bucketKey] || process.env.VITE_STORAGE_BUCKET || 'game-images';
  return bucket;
}

/**
 * Extract storage path from CDN URL or Supabase URL
 * @param {string} imageUrl - CDN URL or Supabase Storage URL
 * @param {string} theme - Theme name
 * @returns {string|null} Storage path (e.g., heng36/games/123.jpg)
 */
function extractStoragePathFromCDN(imageUrl, theme = 'heng36') {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }
  
  // Skip data URLs
  if (imageUrl.startsWith('data:')) {
    return null;
  }
  
  // Skip blob URLs
  if (imageUrl.startsWith('blob:')) {
    return null;
  }
  
  try {
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const bucket = getStorageBucket(theme);
    
    // ✅ Format 1: CDN URL - https://img.heng36.party/game-images/heng36/games/123.jpg
    // Path: /game-images/heng36/games/123.jpg
    // We want: heng36/games/123.jpg
    if (pathParts.length >= 2 && pathParts[0] === bucket) {
      // Remove bucket, keep theme and rest
      return pathParts.slice(1).join('/');
    }
    
    // ✅ Format 2: Supabase Storage URL - https://xxxxx.supabase.co/storage/v1/object/public/game-images/heng36/games/123.jpg
    // Path: /storage/v1/object/public/game-images/heng36/games/123.jpg
    // We want: heng36/games/123.jpg
    if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase')) {
      // Find bucket in path
      const bucketIndex = pathParts.indexOf(bucket);
      if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
        // Remove everything before and including bucket, keep theme and rest
        return pathParts.slice(bucketIndex + 1).join('/');
      }
    }
    
    // ✅ Format 3: Direct path without bucket - /heng36/games/123.jpg
    // We want: heng36/games/123.jpg
    if (pathParts.length >= 1 && pathParts[0] === theme) {
      return pathParts.join('/');
    }
    
    // ✅ Format 4: Try to find theme in path
    const themeIndex = pathParts.indexOf(theme);
    if (themeIndex >= 0) {
      return pathParts.slice(themeIndex).join('/');
    }
    
    // ✅ Format 5: If path starts with theme-like pattern
    if (pathParts.length >= 1) {
      // Assume first part is theme or folder
      return pathParts.join('/');
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting storage path from URL:', error);
    return null;
  }
}

/**
 * Delete image from Supabase Storage
 * @param {string} imageUrl - CDN URL or Supabase Storage URL of the image
 * @param {string} theme - Theme name
 * @returns {Promise<boolean>} True if deletion was successful
 */
export async function deleteImageFromStorage(imageUrl, theme = 'heng36') {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return true; // Nothing to delete
    }
    
    // Skip data URLs and blob URLs
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      return true;
    }
    
    const storagePath = extractStoragePathFromCDN(imageUrl, theme);
    
    if (!storagePath) {
      console.warn(`[${theme}] Could not extract storage path from URL:`, imageUrl);
      return false;
    }
    
    const supabase = getSupabaseClient(theme);
    const bucket = getStorageBucket(theme);
    
    console.log(`[${theme}] Deleting image from storage:`, {
      bucket,
      storagePath,
      originalUrl: imageUrl
    });
    
    // Delete from Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove([storagePath]);
    
    if (error) {
      console.error(`[${theme}] Error deleting image from Supabase Storage:`, {
        error: error.message,
        code: error.statusCode,
        bucket,
        storagePath,
        originalUrl: imageUrl
      });
      return false;
    }
    
    console.log(`[${theme}] Successfully deleted image:`, storagePath);
    return true;
  } catch (error) {
    console.error(`[${theme}] Error in deleteImageFromStorage:`, {
      error: error.message,
      stack: error.stack,
      imageUrl
    });
    return false;
  }
}

/**
 * Extract all image URLs from game data
 * @param {object} gameData - Game data object
 * @returns {string[]} Array of image URLs
 */
export function extractImageUrlsFromGameData(gameData) {
  const imageUrls = [];
  
  if (!gameData || typeof gameData !== 'object') {
    return imageUrls;
  }
  
  // Puzzle game
  if (gameData.puzzle?.imageDataUrl) {
    imageUrls.push(gameData.puzzle.imageDataUrl);
  }
  
  // Number pick game
  if (gameData.numberPick?.imageDataUrl) {
    imageUrls.push(gameData.numberPick.imageDataUrl);
  }
  
  // Football game
  if (gameData.football?.imageDataUrl) {
    imageUrls.push(gameData.football.imageDataUrl);
  }
  
  // Checkin game
  if (gameData.checkin?.image) {
    imageUrls.push(gameData.checkin.image);
  }
  if (gameData.checkin?.announceImage) {
    imageUrls.push(gameData.checkin.announceImage);
  }
  
  // Loy Krathong game
  if (gameData.loyKrathong?.image) {
    imageUrls.push(gameData.loyKrathong.image);
  }
  
  // Bingo game
  if (gameData.bingo?.image) {
    imageUrls.push(gameData.bingo.image);
  }
  
  // Trick or Treat game
  if (gameData.trickOrTreat?.ghostImage) {
    imageUrls.push(gameData.trickOrTreat.ghostImage);
  }
  
  return imageUrls.filter(url => url && typeof url === 'string');
}

