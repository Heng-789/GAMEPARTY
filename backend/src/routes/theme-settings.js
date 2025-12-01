import express from 'express';
import { getPool, getSchema } from '../config/database.js';

const router = express.Router();

// Helper function to get theme from request
const getTheme = (req) => {
  return req.theme || req.query.theme || 'heng36';
};

// Initialize theme_settings table if it doesn't exist
const ensureTableExists = async (pool, schema) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.theme_settings (
        id SERIAL PRIMARY KEY,
        theme_name VARCHAR(50) NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(theme_name, setting_key)
      );
      
      CREATE INDEX IF NOT EXISTS idx_theme_settings_theme_key 
      ON ${schema}.theme_settings(theme_name, setting_key);
    `);
  } catch (error) {
    console.error(`[${schema}] Error ensuring theme_settings table exists:`, error);
  }
};

// GET /api/theme-settings/:themeName
// Get all theme settings for a theme
router.get('/:themeName', async (req, res) => {
  try {
    const theme = getTheme(req);
    const themeName = req.params.themeName || theme;
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!pool) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    // Ensure table exists
    await ensureTableExists(pool, schema);

    const result = await pool.query(
      `SELECT setting_key, setting_value 
       FROM ${schema}.theme_settings 
       WHERE theme_name = $1`,
      [themeName]
    );

    // Convert rows to object
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    res.json({ theme: themeName, settings });
  } catch (error) {
    console.error(`[${getTheme(req)}] Error getting theme settings:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/theme-settings/:themeName
// Save theme settings
router.post('/:themeName', async (req, res) => {
  try {
    const theme = getTheme(req);
    const themeName = req.params.themeName || theme;
    const { settings } = req.body; // { backgroundImage: 'url', logo: 'url', ... }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings data' });
    }

    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!pool) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    // Ensure table exists
    await ensureTableExists(pool, schema);

    // Save each setting
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `INSERT INTO ${schema}.theme_settings (theme_name, setting_key, setting_value, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (theme_name, setting_key)
           DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
          [themeName, key, value]
        );
      }

      await client.query('COMMIT');
      res.json({ 
        success: true, 
        message: 'Theme settings saved successfully',
        theme: themeName,
        settings 
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[${getTheme(req)}] Error saving theme settings:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/theme-settings/:themeName/:key
// Delete a specific setting
router.delete('/:themeName/:key', async (req, res) => {
  try {
    const theme = getTheme(req);
    const themeName = req.params.themeName || theme;
    const key = req.params.key;

    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!pool) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    await pool.query(
      `DELETE FROM ${schema}.theme_settings 
       WHERE theme_name = $1 AND setting_key = $2`,
      [themeName, key]
    );

    res.json({ success: true, message: 'Setting deleted successfully' });
  } catch (error) {
    console.error(`[${getTheme(req)}] Error deleting theme setting:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

