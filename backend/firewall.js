
const { execFile } = require('child_process');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Persistent blocklist outside the backend folder.
const BLOCKLIST_FILE = path.join(__dirname, '../data/blocklist.json');

class Firewall {
  constructor() {
    this.blocked = new Map();
    this.hits = new Map();
    this.io = null;
    this.expiryTimer = null;

    this._load();
  }

  // --------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------

  init(io) {
    this.io = io;

    this.restoreRules();

    if (!this.expiryTimer) {
      this.expiryTimer = setInterval(() => {
        this._expireOld();
      }, 30000);

      if (this.expiryTimer.unref) {
        this.expiryTimer.unref();
      }
    }

    console.log(
      `[Firewall] Initialized | ` +
      `Mode: ${config.FIREWALL.DRY_RUN ? 'DRY-RUN' : 'REAL'} | ` +
      `Auto-block: ${config.FIREWALL.AUTO_BLOCK ? 'ON' : 'OFF'} | ` +
      `Confidence: ${config.FIREWALL.MIN_CONFIDENCE} | ` +
      `Required detections: ${config.FIREWALL.HITS_REQUIRED}`
    );
  }

  // --------------------------------------------------
  // IP VALIDATION AND PROTECTION
  // --------------------------------------------------

  _protectedIps() {
    const protectedIps = new Set([
      '127.0.0.1',
      '::1',
      '0.0.0.0'
    ]);

    const interfaces = os.networkInterfaces();

    Object.values(interfaces).forEach(list => {
      (list || []).forEach(item => {
        if (item.address) {
          protectedIps.add(item.address);
        }
      });
    });

    (config.FIREWALL.WHITELIST || []).forEach(ip => {
      protectedIps.add(ip);
    });

    return protectedIps;
  }

  isProtected(ip) {
    return this._protectedIps().has(ip);
  }

  _validateIP(ip) {
    if (typeof ip !== 'string' || net.isIP(ip) !== 4) {
      throw new Error(`Invalid IPv4 address: ${ip}`);
    }

    return ip;
  }

  // --------------------------------------------------
  // BLOCK IP ADDRESS
  // --------------------------------------------------

  async block(ip, options = {}) {
    this._validateIP(ip);

    const {
      reason = 'Manual block',
      attackType = null,
      source = 'manual',
      durationMin = 0,
      simulated = false
    } = options;

    if (this.isProtected(ip)) {
      throw new Error(
        `${ip} is protected and cannot be blocked`
      );
    }

    if (this.blocked.has(ip)) {
      return {
        alreadyBlocked: true,
        entry: this.blocked.get(ip)
      };
    }

    let enforced = false;
    let error = null;

    // Actual blocking only on supported Linux systems.
    if (!simulated && !config.FIREWALL.DRY_RUN) {
      if (process.platform !== 'linux') {
        throw new Error(
          'Real iptables blocking requires Linux. ' +
          'Use DRY-RUN mode on Windows.'
        );
      }

      try {
        await this._iptablesAdd(ip);
        enforced = true;
      } catch (err) {
        error = err.message;

        console.error(
          `[Firewall] Failed to enforce block for ${ip}: ${error}`
        );

        this._emit('block-failed', {
          ip,
          reason,
          attackType,
          error
        });

        throw err;
      }
    }

    const blockedAt = new Date();

    const entry = {
      ip,
      reason,
      attackType,
      source,
      blockedAt: blockedAt.toISOString(),

      expiresAt: durationMin > 0
        ? new Date(
            blockedAt.getTime() + durationMin * 60000
          ).toISOString()
        : null,

      enforced,
      simulated: simulated || config.FIREWALL.DRY_RUN,
      error
    };

    this.blocked.set(ip, entry);
    this.hits.delete(ip);

    this._save();

    console.log(
      `[Firewall] ${enforced ? 'ENFORCED' : 'SIMULATED BLOCK'}: ${ip}`
    );

    // Notify connected dashboard clients.
    this._emit('ip-blocked', entry);

    return {
      alreadyBlocked: false,
      entry
    };
  }

  // --------------------------------------------------
  // UNBLOCK IP ADDRESS
  // --------------------------------------------------

  async unblock(ip) {
    this._validateIP(ip);

    const entry = this.blocked.get(ip);

    if (!entry) {
      return false;
    }

    if (entry.enforced) {
      await this._iptablesRemove(ip);
    }

    this.blocked.delete(ip);
    this.hits.delete(ip);

    this._save();

    console.log(`[Firewall] UNBLOCKED: ${ip}`);

    this._emit('ip-unblocked', {
      ip,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // --------------------------------------------------
  // AUTOMATIC ATTACK DETECTION AND BLOCKING
  // --------------------------------------------------

  async handleDetection(event) {
    try {
      if (!event) {
        return {
          blocked: false,
          reason: 'No detection event provided'
        };
      }

      if (!config.FIREWALL.AUTO_BLOCK) {
        return {
          blocked: false,
          reason: 'Automatic blocking is disabled'
        };
      }

      const ip = event.source_ip;
      const prediction = String(
        event.prediction || 'normal'
      ).toLowerCase();

      const confidence = Number(event.confidence || 0);

      // Ignore normal traffic.
      if (!ip || prediction === 'normal') {
        return {
          blocked: false,
          reason: 'Normal traffic or missing source IP'
        };
      }

      this._validateIP(ip);

      // Ignore protected addresses.
      if (this.isProtected(ip)) {
        return {
          blocked: false,
          reason: 'Protected IP address'
        };
      }

      // Ignore IPs already blocked.
      if (this.isBlocked(ip)) {
        return {
          blocked: true,
          alreadyBlocked: true,
          ip
        };
      }

      // Confidence must be between 0 and 1.
      if (
        !Number.isFinite(confidence) ||
        confidence < config.FIREWALL.MIN_CONFIDENCE
      ) {
        return {
          blocked: false,
          reason: 'Confidence below configured threshold',
          confidence
        };
      }

      const now = Date.now();

      const windowMs =
        config.FIREWALL.WINDOW_SECONDS * 1000;

      // Keep only recent detections for this IP.
      const previousHits = this.hits.get(ip) || [];

      const recentHits = previousHits.filter(
        timestamp => now - timestamp <= windowMs
      );

      recentHits.push(now);

      this.hits.set(ip, recentHits);

      console.log(
        `[Firewall] Attack detected | IP: ${ip} | ` +
        `Type: ${prediction} | ` +
        `Confidence: ${(confidence * 100).toFixed(2)}% | ` +
        `Hits: ${recentHits.length}/${config.FIREWALL.HITS_REQUIRED}`
      );

      // Check whether enough detections have occurred.
      if (
        recentHits.length < config.FIREWALL.HITS_REQUIRED
      ) {
        return {
          blocked: false,
          reason: 'Waiting for additional detections',
          hits: recentHits.length,
          requiredHits: config.FIREWALL.HITS_REQUIRED
        };
      }

      // Block the attacker.
      const result = await this.block(ip, {
        reason:
          `Automatically blocked after ${recentHits.length} ` +
          `${prediction} detections`,

        attackType: prediction,
        source: 'auto',

        durationMin:
          config.FIREWALL.AUTO_BLOCK_MINUTES,

        simulated: !!event.simulated
      });

      console.log(
        `[Firewall] Automatic blocking completed for ${ip}`
      );

      return {
        blocked: true,
        alreadyBlocked: result.alreadyBlocked,
        ip,
        entry: result.entry
      };

    } catch (error) {
      console.error(
        `[Firewall] Detection processing failed: ${error.message}`
      );

      this._emit('firewall-error', {
        message: error.message,
        timestamp: new Date().toISOString()
      });

      return {
        blocked: false,
        error: error.message
      };
    }
  }

  // --------------------------------------------------
  // CHECK BLOCK STATUS
  // --------------------------------------------------

  isBlocked(ip) {
    return this.blocked.has(ip);
  }

  // --------------------------------------------------
  // GET BLOCKLIST
  // --------------------------------------------------

  list() {
    return [...this.blocked.values()].sort(
      (a, b) =>
        new Date(b.blockedAt) - new Date(a.blockedAt)
    );
  }

  // --------------------------------------------------
  // FIREWALL STATUS
  // --------------------------------------------------

  status() {
    return {
      dryRun: config.FIREWALL.DRY_RUN,
      autoBlock: config.FIREWALL.AUTO_BLOCK,

      minConfidence:
        config.FIREWALL.MIN_CONFIDENCE,

      hitsRequired:
        config.FIREWALL.HITS_REQUIRED,

      windowSeconds:
        config.FIREWALL.WINDOW_SECONDS,

      autoBlockMinutes:
        config.FIREWALL.AUTO_BLOCK_MINUTES,

      whitelist: [...this._protectedIps()],

      blockedCount: this.blocked.size,

      blockedIPs: this.list()
    };
  }

  // --------------------------------------------------
  // IPTABLES COMMAND EXECUTION
  // --------------------------------------------------

  _run(args) {
    return new Promise((resolve, reject) => {
      execFile(
        'iptables',
        args,
        (err, stdout, stderr) => {
          if (err) {
            const message = (
              stderr || err.message || 'iptables failed'
            ).trim();

            if (
              /permission denied|must be root|not permitted/i.test(message)
            ) {
              return reject(
                new Error(
                  'iptables requires root privileges. ' +
                  'Run the backend with sudo.'
                )
              );
            }

            if (err.code === 'ENOENT') {
              return reject(
                new Error(
                  'iptables not found. Install iptables on Linux.'
                )
              );
            }

            return reject(new Error(message));
          }

          resolve(stdout);
        }
      );
    });
  }

  async _ruleExists(chain, ip) {
    try {
      await this._run([
        '-C',
        chain,
        '-s',
        ip,
        '-j',
        'DROP'
      ]);

      return true;
    } catch {
      return false;
    }
  }

  async _iptablesAdd(ip) {
    for (const chain of ['INPUT', 'FORWARD']) {
      if (!(await this._ruleExists(chain, ip))) {
        await this._run([
          '-I',
          chain,
          '1',
          '-s',
          ip,
          '-j',
          'DROP'
        ]);
      }
    }
  }

  async _iptablesRemove(ip) {
    for (const chain of ['INPUT', 'FORWARD']) {
      while (await this._ruleExists(chain, ip)) {
        await this._run([
          '-D',
          chain,
          '-s',
          ip,
          '-j',
          'DROP'
        ]);
      }
    }
  }

  // --------------------------------------------------
  // RESTORE SAVED FIREWALL RULES
  // --------------------------------------------------

  async restoreRules() {
    if (config.FIREWALL.DRY_RUN) {
      return;
    }

    if (process.platform !== 'linux') {
      console.warn(
        '[Firewall] Cannot restore iptables rules on this platform.'
      );
      return;
    }

    for (const entry of this.blocked.values()) {
      if (entry.enforced) {
        try {
          await this._iptablesAdd(entry.ip);
        } catch (error) {
          console.error(
            `[Firewall] Restore failed for ${entry.ip}: ${error.message}`
          );
        }
      }
    }
  }

  // --------------------------------------------------
  // AUTOMATIC EXPIRY
  // --------------------------------------------------

  async _expireOld() {
    const now = Date.now();

    for (const entry of [...this.blocked.values()]) {
      if (
        entry.expiresAt &&
        new Date(entry.expiresAt).getTime() <= now
      ) {
        console.log(
          `[Firewall] Block expired: ${entry.ip}`
        );

        try {
          await this.unblock(entry.ip);
        } catch (error) {
          console.error(
            `[Firewall] Expiry error for ${entry.ip}: ${error.message}`
          );
        }
      }
    }

    // Remove old detection history.
    const windowMs =
      config.FIREWALL.WINDOW_SECONDS * 1000;

    for (const [ip, timestamps] of this.hits.entries()) {
      const recent = timestamps.filter(
        timestamp => now - timestamp <= windowMs
      );

      if (recent.length === 0) {
        this.hits.delete(ip);
      } else {
        this.hits.set(ip, recent);
      }
    }
  }

  // --------------------------------------------------
  // SOCKET.IO EVENTS
  // --------------------------------------------------

  _emit(eventName, payload) {
    if (this.io) {
      this.io.emit(eventName, payload);
    }
  }

  // --------------------------------------------------
  // LOAD SAVED BLOCKLIST
  // --------------------------------------------------

  _load() {
    try {
      if (!fs.existsSync(BLOCKLIST_FILE)) {
        return;
      }

      const saved = JSON.parse(
        fs.readFileSync(BLOCKLIST_FILE, 'utf8')
      );

      if (!Array.isArray(saved)) {
        throw new Error('Blocklist must contain an array');
      }

      saved.forEach(entry => {
        if (entry.ip && net.isIP(entry.ip) === 4) {
          this.blocked.set(entry.ip, entry);
        }
      });

      console.log(
        `[Firewall] Loaded ${this.blocked.size} saved block(s)`
      );

    } catch (error) {
      console.error(
        `[Firewall] Could not load blocklist: ${error.message}`
      );
    }
  }

  // --------------------------------------------------
  // SAVE BLOCKLIST
  // --------------------------------------------------

  _save() {
    try {
      fs.mkdirSync(
        path.dirname(BLOCKLIST_FILE),
        { recursive: true }
      );

      fs.writeFileSync(
        BLOCKLIST_FILE,
        JSON.stringify(this.list(), null, 2),
        'utf8'
      );

    } catch (error) {
      console.error(
        `[Firewall] Could not save blocklist: ${error.message}`
      );
    }
  }
}

module.exports = new Firewall();
