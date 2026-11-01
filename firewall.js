const express = require('express');
const router = express.Router();
const firewall = require('../services/firewall');

// GET /api/firewall  -> list of blocked IPs + settings
router.get('/', (req, res) => {
  res.json({ success: true, status: firewall.status(), blocked: firewall.list() });
});

// POST /api/firewall/block   body: { "ip": "1.2.3.4", "reason": "optional" }
router.post('/block', async (req, res) => {
  try {
    const { ip, reason, attackType } = req.body || {};
    const result = await firewall.block(String(ip || '').trim(), {
      reason: reason || 'Blocked manually from dashboard',
      attackType: attackType || null,
      source: 'manual'
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/firewall/:ip  -> unblock
router.delete('/:ip', async (req, res) => {
  const ok = await firewall.unblock(req.params.ip);
  if (!ok) return res.status(404).json({ success: false, error: 'IP is not in the blocklist' });
  res.json({ success: true });
});

module.exports = router;
