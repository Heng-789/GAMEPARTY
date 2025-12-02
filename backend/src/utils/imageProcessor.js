/**
 * Image Processing Utilities
 * Handles base64 to URL conversion and image storage
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
  const bucketKey = `VITE_STORAGE_BUCKET_${theme.toUpperCase()}`;
  return process.env[bucketKey] || process.env.VITE_STORAGE_BUCKET || 'game-images';
}

/**
 * Get CDN URL for a storage path
 * ✅ OPTIMIZED: Always uses CDN, never Supabase Storage directly
 * This reduces Supabase egress by 70-90% for static assets
 */
function getCDNUrl(storagePath, theme = 'heng36') {
  // Default CDN domains based on theme
  const defaultCDNs = {
    heng36: 'https://img.heng36.party',
    max56: 'https://img.max56.party',
    jeed24: 'https://img.jeed24.party'
  };
  
  const cdnBase = process.env[`CDN_BASE_URL_${theme.toUpperCase()}`] || 
                  process.env.CDN_BASE_URL || 
                  defaultCDNs[theme] || 
                  defaultCDNs.heng36;
  const bucket = getStorageBucket(theme);
  
  // ✅ Always return CDN URL, never Supabase Storage URL
  // This ensures zero Supabase egress for static assets
  return `${cdnBase}/${bucket}/${storagePath}`;
}

/**
 * Check if a string is a base64 data URL
 */
function isBase64DataUrl(str) {
  return typeof str === 'string' && str.startsWith('data:image/');
}

/**
 * Extract base64 data from data URL
 */
function extractBase64Data(dataUrl) {
  const matches = dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
  if (!matches) return null;
  
  return {
    mimeType: matches[1],
    base64Data: matches[2]
  };
}

/**
 * Upload base64 image to Supabase Storage and return CDN URL
 * @param {string} base64DataUrl - Base64 data URL
 * @param {string} fileName - File name (optional)
 * @param {string} theme - Theme name
 * @param {string} folder - Storage folder (e.g., 'games', 'announce')
 * @returns {Promise<string>} CDN URL of uploaded image
 */
export async function uploadBase64Image(base64DataUrl, fileName, theme = 'heng36', folder = 'games') {
  try {
    if (!isBase64DataUrl(base64DataUrl)) {
      // Already a URL, return as-is
      return base64DataUrl;
    }

    const extracted = extractBase64Data(base64DataUrl);
    if (!extracted) {
      throw new Error('Invalid base64 data URL format');
    }

    // Generate file name if not provided
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const extension = extracted.mimeType === 'jpeg' ? 'jpg' : extracted.mimeType;
    const finalFileName = fileName || `${timestamp}-${randomStr}.${extension}`;
    
    // Storage path: theme/folder/filename
    const storagePath = `${theme}/${folder}/${finalFileName}`;

    // Convert base64 to buffer
    const buffer = Buffer.from(extracted.base64Data, 'base64');

    // Upload to Supabase Storage
    const supabase = getSupabaseClient(theme);
    const bucket = getStorageBucket(theme);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: `image/${extracted.mimeType}`,
        upsert: true
      });

    if (error) {
      console.error(`[${theme}] Error uploading image:`, error);
      throw error;
    }

    // ✅ Always return CDN URL (never Supabase Storage URL)
    // This ensures zero Supabase egress for static assets
    const cdnUrl = getCDNUrl(storagePath, theme);
    
    // ✅ Log in development only to reduce noise
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${theme}] Successfully uploaded image:`, {
        storagePath,
        cdnUrl,
        size: buffer.length
      });
    }

    return cdnUrl;
  } catch (error) {
    console.error(`[${theme}] Error in uploadBase64Image:`, error);
    throw error;
  }
}

/**
 * Process image fields in an object, converting base64 to URLs
 * @param {object} obj - Object to process
 * @param {string} theme - Theme name
 * @param {string} folder - Storage folder
 * @returns {Promise<object>} Object with base64 images converted to URLs
 */
export async function processImageFields(obj, theme = 'heng36', folder = 'games') {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const processed = { ...obj };

  // Process announce.imageDataUrl
  if (processed.announce?.imageDataUrl && isBase64DataUrl(processed.announce.imageDataUrl)) {
    try {
      processed.announce.imageDataUrl = await uploadBase64Image(
        processed.announce.imageDataUrl,
        processed.announce.fileName,
        theme,
        'announce'
      );
    } catch (error) {
      console.error('Error processing announce image:', error);
      // Keep original if upload fails
    }
  }

  // Process puzzle.imageDataUrl
  if (processed.puzzle?.imageDataUrl && isBase64DataUrl(processed.puzzle.imageDataUrl)) {
    try {
      processed.puzzle.imageDataUrl = await uploadBase64Image(
        processed.puzzle.imageDataUrl,
        null,
        theme,
        folder
      );
    } catch (error) {
      console.error('Error processing puzzle image:', error);
    }
  }

  // Process numberPick.imageDataUrl
  if (processed.numberPick?.imageDataUrl && isBase64DataUrl(processed.numberPick.imageDataUrl)) {
    try {
      processed.numberPick.imageDataUrl = await uploadBase64Image(
        processed.numberPick.imageDataUrl,
        null,
        theme,
        folder
      );
    } catch (error) {
      console.error('Error processing numberPick image:', error);
    }
  }

  // Process football.imageDataUrl
  if (processed.football?.imageDataUrl && isBase64DataUrl(processed.football.imageDataUrl)) {
    try {
      processed.football.imageDataUrl = await uploadBase64Image(
        processed.football.imageDataUrl,
        null,
        theme,
        folder
      );
    } catch (error) {
      console.error('Error processing football image:', error);
    }
  }

  // Process checkin images
  if (processed.checkin?.image && isBase64DataUrl(processed.checkin.image)) {
    try {
      processed.checkin.image = await uploadBase64Image(
        processed.checkin.image,
        null,
        theme,
        folder
      );
    } catch (error) {
      console.error('Error processing checkin image:', error);
    }
  }

  if (processed.checkin?.announceImage && isBase64DataUrl(processed.checkin.announceImage)) {
    try {
      processed.checkin.announceImage = await uploadBase64Image(
        processed.checkin.announceImage,
        null,
        theme,
        folder
      );
    } catch (error) {
      console.error('Error processing checkin announceImage:', error);
    }
  }

  // Process loyKrathong.image
  if (processed.loyKrathong?.image && isBase64DataUrl(processed.loyKrathong.image)) {
    try {
      processed.loyKrathong.image = await uploadBase64Image(
        processed.loyKrathong.image,
        null,
        theme,
        folder
      );
    } catch (error) {
      console.error('Error processing loyKrathong image:', error);
    }
  }

  // Process bingo.image
  if (processed.bingo?.image && isBase64DataUrl(processed.bingo.image)) {
    try {
      processed.bingo.image = await uploadBase64Image(
        processed.bingo.image,
        null,
        theme,
        folder
      );
    } catch (error) {
      console.error('Error processing bingo image:', error);
    }
  }

  // Process trickOrTreat.ghostImage
  if (processed.trickOrTreat?.ghostImage && isBase64DataUrl(processed.trickOrTreat.ghostImage)) {
    try {
      processed.trickOrTreat.ghostImage = await uploadBase64Image(
        processed.trickOrTreat.ghostImage,
        null,
        theme,
        folder
      );
    } catch (error) {
      console.error('Error processing trickOrTreat ghostImage:', error);
    }
  }

  return processed;
}

