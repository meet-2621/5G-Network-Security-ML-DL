const express = require('express');
const router = express.Router();

const firewall = require('../firewall');

// GET: Retrieve firewall status and blocked IPs
router.get('/', (req, res, next) => {
    try {
        res.json({
            success: true,
            status: firewall.status(),
            blocked: firewall.list()
        });
    } catch (err) {
        next(err);
    }
});

// POST: Block an IP address
router.post('/block', async (req, res) => {
    try {
        const { ip, attackType } = req.body;

        if (!ip) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required'
            });
        }

        const result = await firewall.block(ip, {
            reason: 'Manual block from dashboard',
            attackType: attackType || null,
            source: 'manual',
            durationMin: 0
        });

        res.json({
            success: true,
            message: 'IP recorded successfully',
            ...result
        });

    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message
        });
    }
});

// DELETE: Unblock an IP address
router.delete('/:ip', async (req, res, next) => {
    try {
        const ip = req.params.ip;

        const removed = await firewall.unblock(ip);

        if (!removed) {
            return res.status(404).json({
                success: false,
                error: 'IP is not in the blocklist'
            });
        }

        res.json({
            success: true,
            message: 'IP unblocked successfully'
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;