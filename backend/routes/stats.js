const express = require('express');
const router = express.Router();
const dataStore = require('../services/dataStore');
const mlService = require('../services/mlService');

const startTime = Date.now();

router.get('/', (req, res, next) => {
  try {
    const stats = dataStore.getStats();
    const modelMetrics = mlService.getModelMetrics();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    const timeline = dataStore.getTimeline();
    let trafficRate = 0;
    if (timeline.length > 0) {
      const lastWindow = timeline[timeline.length - 1];
      trafficRate = (lastWindow.normal_count + lastWindow.attack_count) / 10;
    }

    res.json({
      success: true,
      counters: stats.counters,
      modelMetrics,
      uptime,
      trafficRate
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
