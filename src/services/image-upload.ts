/**
 * Image Upload Service
 * 
 * Pipeline:
 * 1. Upload image to Supabase Storage
 * 2. Get public URL from Supabase
 * 3. Convert to Cloudflare CDN URL
 * 4. Return CDN URL for saving to PostgreSQL
 */

import { getSupabaseClient } from './supabase-auth'

// Get current theme
const getCurrentTheme = (): 'heng36' | 'max56' | 'jeed24' => {
  const viteMode = import.meta.env.MODE
  if (viteMode === 'jeed24') return 'jeed24'
  if (viteMode === 'max56') return 'max56'
  if (viteMode === 'heng36') return 'heng36'
  
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  if (hostname.includes('jeed24')) return 'jeed24'
  if (hostname.includes('max56')) return 'max56'
  if (hostname.includes('heng36')) return 'heng36'
  
  return 'heng36'
}

// CDN Configuration from environment variables
const getCDNConfig = () => {
  const theme = getCurrentTheme()
  // ✅ ใช้ CDN domain จาก env ถ้ามี ถ้าไม่มีให้ return null (ใช้ Supabase URL โดยตรง)
  const domain = import.meta.env[`VITE_CDN_DOMAIN_${theme.toUpperCase()}`] || 
                 import.meta.env.VITE_CDN_DOMAIN || 
                 null // ไม่สร้าง CDN URL ถ้ายังไม่มี CDN domain
  const bucket = import.meta.env[`VITE_STORAGE_BUCKET_${theme.toUpperCase()}`] || 
                 import.meta.env.VITE_STORAGE_BUCKET || 
                 'game-images'
  
  // ✅ Debug: Log CDN config (เฉพาะใน development หรือเมื่อไม่มี domain)
  if (import.meta.env.DEV || !domain) {
    console.log('[CDN Config]', {
      theme,
      domain,
      bucket,
      envKey: `VITE_CDN_DOMAIN_${theme.toUpperCase()}`,
      envValue: import.meta.env[`VITE_CDN_DOMAIN_${theme.toUpperCase()}`],
      fallbackEnvValue: import.meta.env.VITE_CDN_DOMAIN,
      hasDomain: !!domain
    })
    
    if (!domain) {
      console.warn(`[CDN Config] ⚠️ CDN domain not configured for theme "${theme}". Using Supabase URL directly.`)
      console.warn(`[CDN Config] 💡 To enable CDN, set environment variable: VITE_CDN_DOMAIN_${theme.toUpperCase()}=img.${theme}.party`)
    }
  }
  
  return { domain, bucket }
}

/**
 * Convert Supabase Storage URL to Cloudflare CDN URL
 * 
 * @param supabaseUrl - Supabase Storage public URL
 * @returns CDN URL in format: https://img.<domain>.com/<bucket>/<path> (or cdn.<domain>.com)
 */
export const convertToCDNUrl = (supabaseUrl: string): string => {
  if (!supabaseUrl) return ''
  
  // If already a CDN URL, return as is
  if (supabaseUrl.includes('cdn.') || supabaseUrl.startsWith('https://cdn.')) {
    return supabaseUrl
  }
  
  // If it's a data URL, return as is (for backward compatibility during migration)
  if (supabaseUrl.startsWith('data:')) {
    return supabaseUrl
  }
  
  // Blob URLs (local preview) are returned as is
  if (supabaseUrl.startsWith('blob:')) {
    return supabaseUrl
  }
  
  try {
    const { domain, bucket } = getCDNConfig()
    
    // ✅ ถ้ายังไม่มี CDN domain ให้ใช้ Supabase URL โดยตรง
    if (!domain) {
      return supabaseUrl
    }
    
    // Parse Supabase Storage URL
    // Format: https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const url = new URL(supabaseUrl)
    
    // Extract path from Supabase URL
    // Example: /storage/v1/object/public/game-images/games/123/image.jpg
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)$/)
    
    if (pathMatch) {
      // pathMatch[1] = "game-images/games/123/image.jpg"
      const fullPath = pathMatch[1]
      
      // Remove bucket name from path if it's included
      // If bucket is "game-images" and path is "game-images/games/123/image.jpg"
      // We want just "games/123/image.jpg"
      const pathWithoutBucket = fullPath.startsWith(`${bucket}/`) 
        ? fullPath.substring(bucket.length + 1) 
        : fullPath
      
      // Construct CDN URL
      const cdnUrl = `https://${domain}/${bucket}/${pathWithoutBucket}`
      return cdnUrl
    }
    
    // If URL doesn't match expected format, try to extract path directly
    // Fallback: assume the URL path contains the file path
    const pathParts = url.pathname.split('/').filter(Boolean)
    const bucketIndex = pathParts.indexOf(bucket)
    
    if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
      const filePath = pathParts.slice(bucketIndex + 1).join('/')
      return `https://${domain}/${bucket}/${filePath}`
    }
    
    // If we can't parse it, return original URL
    console.warn('Could not convert Supabase URL to CDN URL:', supabaseUrl)
    return supabaseUrl
  } catch (error) {
    console.error('Error converting URL to CDN:', error)
    return supabaseUrl
  }
}

/**
 * Upload image file to Supabase Storage
 * 
 * @param file - Image file to upload
 * @param folder - Folder path in storage (e.g., 'games', 'checkin', 'announce')
 * @param fileName - Optional custom file name (default: auto-generated with timestamp)
 * @returns CDN URL of the uploaded image
 */
export const uploadImageToStorage = async (
  file: File,
  folder: string = 'games',
  fileName?: string
): Promise<string> => {
  try {
    const supabase = getSupabaseClient()
    const { bucket } = getCDNConfig()
    const theme = getCurrentTheme()
    
    // Generate file name if not provided
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 9)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const finalFileName = fileName || `${timestamp}-${randomId}.${fileExtension}`
    
    // Construct storage path: <bucket>/<theme>/<folder>/<fileName>
    const storagePath = `${theme}/${folder}/${finalFileName}`
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false // Don't overwrite existing files
      })
    
    if (error) {
      console.error('Error uploading image to Supabase Storage:', error)
      throw new Error(`Failed to upload image: ${error.message}`)
    }
    
    // Get public URL from Supabase
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath)
    
    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL from Supabase Storage')
    }
    
    // Convert to CDN URL
    const cdnUrl = convertToCDNUrl(urlData.publicUrl)
    
    return cdnUrl
  } catch (error) {
    console.error('Error in uploadImageToStorage:', error)
    throw error
  }
}

/**
 * Upload image from data URL (base64) to Supabase Storage
 * 
 * @param dataUrl - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @param folder - Folder path in storage
 * @param fileName - Optional custom file name
 * @returns CDN URL of the uploaded image
 */
export const uploadImageFromDataURL = async (
  dataUrl: string,
  folder: string = 'games',
  fileName?: string
): Promise<string> => {
  try {
    // Convert data URL to File
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    
    // Determine file extension from data URL
    const mimeMatch = dataUrl.match(/data:([^;]+);/)
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const extension = mimeType.split('/')[1] || 'jpg'
    
    // Generate file name if not provided
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 9)
    const finalFileName = fileName || `${timestamp}-${randomId}.${extension}`
    
    // Create File object
    const file = new File([blob], finalFileName, { type: mimeType })
    
    // Upload using the main upload function
    return await uploadImageToStorage(file, folder, finalFileName)
  } catch (error) {
    console.error('Error in uploadImageFromDataURL:', error)
    throw error
  }
}

/**
 * Delete image from Supabase Storage
 * 
 * @param cdnUrl - CDN URL of the image to delete
 * @returns true if deletion was successful
 */
export const deleteImageFromStorage = async (cdnUrl: string): Promise<boolean> => {
  try {
    // If it's a data URL or blob URL, nothing to delete
    if (cdnUrl.startsWith('data:') || cdnUrl.startsWith('blob:')) {
      return true
    }
    
    if (!cdnUrl || !cdnUrl.trim()) {
      return true
    }
    
    const { bucket } = getCDNConfig()
    const supabase = getSupabaseClient()
    let storagePath = ''
    
    try {
      const url = new URL(cdnUrl)
      
      // ✅ รองรับ Supabase Storage URL: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      if (url.pathname.includes('/storage/v1/object/public/')) {
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)$/)
        if (pathMatch) {
          const fullPath = pathMatch[1]
          // Remove bucket name from path if it's included
          storagePath = fullPath.startsWith(`${bucket}/`) 
            ? fullPath.substring(bucket.length + 1) 
            : fullPath
        } else {
          console.warn('Could not extract path from Supabase Storage URL:', cdnUrl)
          return false
        }
      } 
      // ✅ รองรับ CDN URL: cdn.domain.com/bucket/path/to/file.jpg
      else {
        const pathParts = url.pathname.split('/').filter(Boolean)
        
        if (pathParts.length < 2) {
          console.warn('Invalid URL format:', cdnUrl)
          return false
        }
        
        // Remove the bucket from path if it's the first part
        storagePath = pathParts[0] === bucket 
          ? pathParts.slice(1).join('/')
          : pathParts.join('/')
      }
      
      if (!storagePath) {
        console.warn('Could not determine storage path from URL:', cdnUrl)
        return false
      }
      
      // Delete from Supabase Storage
      const { error } = await supabase.storage
        .from(bucket)
        .remove([storagePath])
      
      if (error) {
        console.error('Error deleting image from Supabase Storage:', error)
        return false
      }
      
      return true
    } catch (urlError) {
      console.error('Error parsing URL:', urlError, cdnUrl)
      return false
    }
  } catch (error) {
    console.error('Error in deleteImageFromStorage:', error)
    return false
  }
}

/**
 * Check if URL is a CDN URL
 */
export const isCDNUrl = (url: string): boolean => {
  if (!url) return false
  if (url.startsWith('data:')) return false
  const { domain } = getCDNConfig()
  return url.includes(`cdn.${domain}`) || url.includes(domain)
}

/**
 * Get image URL (convert to CDN if needed, or return as is for data URLs)
 */
export const getImageUrl = (url: string): string => {
  if (!url) return ''
  
  // Data URLs are returned as is
  if (url.startsWith('data:')) {
    return url
  }
  
  // Blob URLs (local preview) are returned as is
  if (url.startsWith('blob:')) {
    return url
  }
  
  // ✅ แก้ไข: ถ้า URL เป็น cdn.heng36.party, cdn.max56.party, cdn.jeed24.party (format เก่าที่ไม่มี DNS)
  // ให้แปลงกลับเป็น Supabase URL
  if (url.includes('cdn.heng36.party') || url.includes('cdn.max56.party') || url.includes('cdn.jeed24.party')) {
    // แปลง cdn URL กลับเป็น Supabase URL
    // Format: https://cdn.heng36.party/game-images/heng36/games/xxx.jpg
    // → https://<supabase-url>/storage/v1/object/public/game-images/heng36/games/xxx.jpg
    try {
      const theme = getCurrentTheme()
      const supabaseUrl = import.meta.env[`VITE_SUPABASE_URL_${theme.toUpperCase()}`] || ''
      const bucket = import.meta.env[`VITE_STORAGE_BUCKET_${theme.toUpperCase()}`] || 'game-images'
      
      if (supabaseUrl) {
        // Extract path from cdn URL
        const urlObj = new URL(url)
        const path = urlObj.pathname // /game-images/heng36/games/xxx.jpg
        // Convert to Supabase URL
        const supabaseImageUrl = `${supabaseUrl}/storage/v1/object/public${path}`
        console.log('[getImageUrl] Converting CDN URL to Supabase:', url, '→', supabaseImageUrl)
        return supabaseImageUrl
      }
    } catch (error) {
      console.error('[getImageUrl] Error converting CDN URL:', error)
    }
  }
  
  // If already CDN URL (and not the old format), return as is
  if (isCDNUrl(url)) {
    return url
  }
  
  // Convert Supabase URL to CDN URL (if CDN domain is configured)
  return convertToCDNUrl(url)
}

