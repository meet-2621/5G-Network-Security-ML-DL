const express = require('express');
const router = express.Router();
const dataStore = require('../services/dataStore');

router.get('/', (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const recentTraffic = dataStore.getRecentTraffic(limit);
    
    res.json({
      success: true,
      data: recentTraffic,
      total: dataStore.getStats().counters.total
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
