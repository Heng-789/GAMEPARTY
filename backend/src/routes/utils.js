import express from 'express';
import { getMetrics, resetMetrics } from '../middleware/request-logger.js';
import { getCacheStats } from '../cache/cacheService.js';
import { checkRedisHealth } from '../cache/upstashClient.js';
import { checkDatabaseConnections } from '../config/database.js';

const router = express.Router();

// Get server time
router.get('/server-time', async (req, res) => {
  try {
    // Return server time in milliseconds (Unix timestamp)
    const serverTime = Date.now();
    res.json({ 
      serverTime,
      serverDate: new Date(serverTime).toISOString()
    });
  } catch (error) {
    console.error('Error getting server time:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = getMetrics();
    const cacheStats = await getCacheStats();
    const redisHealth = await checkRedisHealth();
    const dbHealth = await checkDatabaseConnections();
    
    res.json({
      metrics,
      cache: cacheStats,
      redis: redisHealth,
      database: dbHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset metrics (admin only - should add auth in production)
router.post('/metrics/reset', async (req, res) => {
  try {
    resetMetrics();
    res.json({ message: 'Metrics reset successfully' });
  } catch (error) {
    console.error('Error resetting metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

