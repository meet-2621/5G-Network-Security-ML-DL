// ─────────────────────────────────────────────────────────────
// Firewall service: blocks attacker IPs.
//
//  - Real blocking uses Linux iptables (needs root / sudo).
//  - DRY_RUN mode only records the block (safe for demos/Windows).
//  - Blocks are saved in backend/data/blocklist.json so they
//    survive a server restart.
// ─────────────────────────────────────────────────────────────
const { execFile } = require('child_process');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const BLOCKLIST_FILE = path.join(__dirname, '../data/blocklist.json');

class Firewall {
  constructor() {
    this.blocked = new Map();   // ip -> entry
    this.hits = new Map();      // ip -> [timestamps of attack flows]
    this.io = null;
    this._load();
  }

  // ── setup ──────────────────────────────────────────────────
  init(io) {
    this.io = io;
    this.restoreRules();                       // re-apply after restart
    setInterval(() => this._expireOld(), 30000); // auto-unblock check
    console.log(
      `[Firewall] Ready. Mode: ${config.FIREWALL.DRY_RUN ? 'DRY-RUN (no real blocking)' : 'REAL (iptables)'}, ` +
      `auto-block: ${config.FIREWALL.AUTO_BLOCK ? 'ON' : 'OFF'}`
    );
  }

  // ── safety: IPs we must never block ────────────────────────
  _protectedIps() {
    const own = new Set(['127.0.0.1', '::1', '0.0.0.0']);
    const ifaces = os.networkInterfaces();
    Object.values(ifaces).forEach(list =>
      (list || []).forEach(i => own.add(i.address))
    );
    config.FIREWALL.WHITELIST.forEach(ip => own.add(ip));
    return own;
  }

  isProtected(ip) {
    return this._protectedIps().has(ip);
  }

  // ── public: manual block / unblock ─────────────────────────
  async block(ip, { reason = 'manual', attackType = null, source = 'manual',
                    durationMin = 0, simulated = false } = {}) {
    if (net.isIP(ip) !== 4) {
      throw new Error(`"${ip}" is not a valid IPv4 address`);
    }
    if (this.isProtected(ip)) {
      throw new Error(`${ip} is protected (this machine / whitelist) and cannot be blocked`);
    }
    if (this.blocked.has(ip)) {
      return { alreadyBlocked: true, entry: this.blocked.get(ip) };
    }

    let enforced = false;
    let error = null;
    if (!simulated && !config.FIREWALL.DRY_RUN) {
      try {
        await this._iptablesAdd(ip);
        enforced = true;
      } catch (e) {
        error = e.message;
      }
    }

    const entry = {
      ip,
      reason,
      attackType,
      source,                                   // 'auto' or 'manual'
      blockedAt: new Date().toISOString(),
      expiresAt: durationMin > 0
        ? new Date(Date.now() + durationMin * 60000).toISOString()
        : null,
      enforced,                                 // true = real iptables rule exists
      simulated,
      error
    };

    // If real mode failed, do NOT pretend it worked.
    if (error) {
      console.error(`[Firewall] FAILED to block ${ip}: ${error}`);
      this._emit('block-failed', entry);
      throw new Error(error);
    }

    this.blocked.set(ip, entry);
    this._save();
    console.log(`[Firewall] BLOCKED ${ip} (${attackType || reason}) enforced=${enforced}`);
    this._emit('ip-blocked', entry);
    return { alreadyBlocked: false, entry };
  }

  async unblock(ip) {
    const entry = this.blocked.get(ip);
    if (!entry) return false;
    if (entry.enforced) {
      try { await this._iptablesRemove(ip); }
      catch (e) { console.error(`[Firewall] unblock error for ${ip}: ${e.message}`); }
    }
    this.blocked.delete(ip);
    this.hits.delete(ip);
    this._save();
    console.log(`[Firewall] UNBLOCKED ${ip}`);
    this._emit('ip-unblocked', { ip });
    return true;
  }

  isBlocked(ip) { return this.blocked.has(ip); }

  list() {
    return [...this.blocked.values()].sort(
      (a, b) => new Date(b.blockedAt) - new Date(a.blockedAt)
    );
  }

  status() {
    return {
      dryRun: config.FIREWALL.DRY_RUN,
      autoBlock: config.FIREWALL.AUTO_BLOCK,
      minConfidence: config.FIREWALL.MIN_CONFIDENCE,
      hitsRequired: config.FIREWALL.HITS_REQUIRED,
      windowSeconds: config.FIREWALL.WINDOW_SECONDS,
      autoBlockMinutes: config.FIREWALL.AUTO_BLOCK_MINUTES,
      whitelist: [...this._protectedIps()],
      blockedCount: this.blocked.size
    };
  }

  // ── public: called for every classified flow ───────────────
  // Auto-block rule: the same IP must be classified as an attack
  // with confidence >= MIN_CONFIDENCE, HITS_REQUIRED times inside
  // WINDOW_SECONDS. This avoids blocking on a single false alarm.
  async handleDetection(event) {
    try {
      if (!config.FIREWALL.AUTO_BLOCK) return;
      const ip = event.source_ip;
      const pred = (event.prediction || 'normal').toLowerCase();
      if (!ip || pred === 'normal') return;
      if ((event.confidence || 0) < config.FIREWALL.MIN_CONFIDENCE) return;
      if (this.isBlocked(ip) || this.isProtected(ip)) return;

      const now = Date.now();
      const windowMs = config.FIREWALL.WINDOW_SECONDS * 1000;
      const list = (this.hits.get(ip) || []).filter(t => now - t < windowMs);
      list.push(now);
      this.hits.set(ip, list);

      if (list.length >= config.FIREWALL.HITS_REQUIRED) {
        await this.block(ip, {
          reason: `Auto-blocked: ${list.length} ${pred} flows in ${config.FIREWALL.WINDOW_SECONDS}s`,
          attackType: pred,
          source: 'auto',
          durationMin: config.FIREWALL.AUTO_BLOCK_MINUTES,
          simulated: !!event.simulated
        });
      }
    } catch (e) {
      console.error(`[Firewall] handleDetection error: ${e.message}`);
    }
  }

  // ── iptables helpers (execFile = no shell, no injection) ───
  _run(args) {
    return new Promise((resolve, reject) => {
      execFile('iptables', args, (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || '').trim();
          if (/permission denied|must be root|not permitted/i.test(msg)) {
            return reject(new Error('iptables needs root. Start the backend with sudo.'));
          }
          if (err.code === 'ENOENT') {
            return reject(new Error('iptables not found. Install it: sudo apt install iptables'));
          }
          return reject(new Error(msg || 'iptables failed'));
        }
        resolve(stdout);
      });
    });
  }

  async _ruleExists(chain, ip) {
    try { await this._run(['-C', chain, '-s', ip, '-j', 'DROP']); return true; }
    catch { return false; }
  }

  async _iptablesAdd(ip) {
    for (const chain of ['INPUT', 'FORWARD']) {
      if (!(await this._ruleExists(chain, ip))) {
        await this._run(['-I', chain, '1', '-s', ip, '-j', 'DROP']);
      }
    }
  }

  async _iptablesRemove(ip) {
    for (const chain of ['INPUT', 'FORWARD']) {
      while (await this._ruleExists(chain, ip)) {
        await this._run(['-D', chain, '-s', ip, '-j', 'DROP']);
      }
    }
  }

  // ── housekeeping ───────────────────────────────────────────
  async restoreRules() {
    if (config.FIREWALL.DRY_RUN) return;
    for (const entry of this.blocked.values()) {
      if (entry.enforced) {
        try { await this._iptablesAdd(entry.ip); }
        catch (e) { console.error(`[Firewall] restore failed for ${entry.ip}: ${e.message}`); }
      }
    }
  }

  async _expireOld() {
    const now = Date.now();
    for (const entry of [...this.blocked.values()]) {
      if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= now) {
        console.log(`[Firewall] Block expired for ${entry.ip}`);
        await this.unblock(entry.ip);
      }
    }
  }

  _emit(name, payload) {
    if (this.io) this.io.emit(name, payload);
  }

  _load() {
    try {
      if (fs.existsSync(BLOCKLIST_FILE)) {
        const arr = JSON.parse(fs.readFileSync(BLOCKLIST_FILE, 'utf8'));
        arr.forEach(e => this.blocked.set(e.ip, e));
      }
    } catch (e) {
      console.error('[Firewall] Could not read blocklist.json:', e.message);
    }
  }

  _save() {
    try {
      fs.mkdirSync(path.dirname(BLOCKLIST_FILE), { recursive: true });
      fs.writeFileSync(BLOCKLIST_FILE, JSON.stringify([...this.blocked.values()], null, 2));
    } catch (e) {
      console.error('[Firewall] Could not save blocklist.json:', e.message);
    }
  }
}

module.exports = new Firewall();
