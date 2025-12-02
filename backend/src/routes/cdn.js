/**
 * CDN Proxy Route
 * Proxies static assets through CDN with aggressive caching
 * Ensures all assets are served from CDN, not Supabase Storage directly
 * 
 * This route acts as a proxy that:
 * 1. Fetches assets from Supabase Storage (or CDN)
 * 2. Adds aggressive Cache-Control headers
 * 3. Returns assets with CDN caching enabled
 * 
 * Goal: Zero Supabase egress for static assets
 */

import express from 'express';
import { getPool, getSchema } from '../config/database.js';
import { convertToCDNUrl, processImageUrlsInObject } from '../utils/cdnUtils.js';

const router = express.Router();

/**
 * Proxy static assets with aggressive CDN caching
 * Route: /cdn/assets/:theme/:folder/:filename
 * 
 * Cache-Control: public, max-age=31536000, immutable
 * This ensures assets are cached by CDN for 1 year
 */
router.get('/assets/:theme/:folder/*', async (req, res) => {
  try {
    const { theme, folder } = req.params;
    const filename = req.params[0]; // Rest of the path
    
    // Construct storage path
    const storagePath = `${theme}/${folder}/${filename}`;
    
    // Get CDN URL (never use Supabase Storage directly)
    const cdnUrl = convertToCDNUrl(
      `https://${process.env[`SUPABASE_URL_${theme.toUpperCase()}`]?.replace('https://', '') || 'ipflzfxezdzbmoqglknu.supabase.co'}/storage/v1/object/public/game-images/${storagePath}`,
      theme
    );
    
    // ✅ AGGRESSIVE CACHING: Cache static assets for 1 year
    // This ensures zero Supabase egress after first request
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    
    // Redirect to CDN URL (let CDN handle the actual serving)
    res.redirect(302, cdnUrl);
  } catch (error) {
    console.error('[CDN Proxy] Error:', error);
    res.status(500).json({ error: 'Failed to proxy asset' });
  }
});

/**
 * Proxy game images with CDN caching
 * Route: /cdn/games/:gameId/image
 */
router.get('/games/:gameId/image', async (req, res) => {
  try {
    const { gameId } = req.params;
    const theme = req.theme || 'heng36';
    const schema = getSchema(theme);
    const pool = getPool(theme);
    
    // Get game data
    const result = await pool.query(
      `SELECT game_data FROM ${schema}.games WHERE game_id = $1`,
      [gameId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const gameData = result.rows[0].game_data || {};
    
    // Extract image URL (check multiple possible fields)
    const imageUrl = gameData.puzzle?.imageDataUrl || 
                    gameData.announce?.imageDataUrl ||
                    gameData.checkin?.image ||
                    gameData.loyKrathong?.image ||
                    gameData.bingo?.image;
    
    if (!imageUrl) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Convert to CDN URL
    const cdnUrl = convertToCDNUrl(imageUrl, theme);
    
    // ✅ AGGRESSIVE CACHING: Cache game images for 1 year
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    
    // Redirect to CDN URL
    res.redirect(302, cdnUrl);
  } catch (error) {
    console.error('[CDN Proxy] Error:', error);
    res.status(500).json({ error: 'Failed to proxy game image' });
  }
});

export default router;

