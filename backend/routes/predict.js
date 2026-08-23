const express = require('express');
const router = express.Router();
const mlService = require('../services/mlService');

router.post('/', async (req, res, next) => {
  try {
    const features = req.body;
    
    if (!features || typeof features !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid features provided' });
    }

    const result = await mlService.predict(features);
    res.json({
      success: true,
      result: {
        prediction: result.prediction,
        confidence: result.confidence,
        probabilities: result.probabilities
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
