const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getSystemStats } = require('../services/system-info');

const router = Router();
router.use(authMiddleware);

// GET /api/system/stats
router.get('/stats', (req, res) => {
  res.json(getSystemStats());
});

module.exports = router;
