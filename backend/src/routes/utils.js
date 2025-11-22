import express from 'express';

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

export default router;

