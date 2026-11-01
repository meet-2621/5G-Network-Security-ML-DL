const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mlService = require('../services/mlService');
const dataStore = require('../services/dataStore');
const firewall = require('../services/firewall');

router.post('/', async (req, res, next) => {
  try {
    let features = req.body;

    if (!Array.isArray(features)) {
      features = [features];
    }

    if (features.length === 0) {
      return res.status(400).json({ success: false, error: 'No feature data provided' });
    }

    const results = [];

    for (const feat of features) {
      const startTime = process.hrtime.bigint();
      const result = await mlService.predict(feat);
      const endTime = process.hrtime.bigint();
      const processingTime = Number(endTime - startTime) / 1e6;

      const event = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        features: feat,
        prediction: result.prediction,
        confidence: result.confidence,
        probabilities: result.probabilities,
        processingTime,
        source: 'pcap_capture',
        source_ip: feat.src_ip || null,
        dest_ip: feat.dst_ip || null
      };

      dataStore.addTraffic(event);
      await firewall.handleDetection(event);   // <-- block attacker if rules match
      event.blocked = firewall.isBlocked(event.source_ip);

      if (global.io) {
        global.io.emit('traffic-event', event);
      }

      results.push(event);
    }

    console.log(`[Capture] Classified ${results.length} flows from pcap data`);

    res.json({
      success: true,
      classified: results.length,
      results
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
