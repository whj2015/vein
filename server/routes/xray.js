const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  startXray,
  stopXray,
  restartXray,
  getXrayStatus,
} = require('../services/xray-process');

const router = Router();
router.use(authMiddleware);

// GET /api/xray/status
router.get('/status', (req, res) => {
  res.json(getXrayStatus());
});

// POST /api/xray/start
router.post('/start', (req, res) => {
  res.json(startXray());
});

// POST /api/xray/stop
router.post('/stop', (req, res) => {
  res.json(stopXray());
});

// POST /api/xray/restart
router.post('/restart', (req, res) => {
  res.json(restartXray());
});

module.exports = router;
