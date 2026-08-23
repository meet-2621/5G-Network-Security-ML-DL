const config = require('../config');

class DataStore {
  constructor() {
    this.trafficLog = [];
    this.counters = { total: 0, normal: 0, ddos: 0, port_scan: 0, dns_spoof: 0, mitm: 0 };
    this.timeline = [];
    this.currentWindow = { timestamp: Date.now(), normal_count: 0, attack_count: 0 };
  }

  addTraffic(event) {
    this.trafficLog.unshift(event);
    if (this.trafficLog.length > config.MAX_TRAFFIC_LOG) {
      this.trafficLog.pop();
    }

    this.counters.total++;
    const pred = event.prediction.toLowerCase();
    if (this.counters[pred] !== undefined) {
      this.counters[pred]++;
    } else {
      this.counters.normal++;
    }

    this._updateTimeline(pred);
  }

  _updateTimeline(prediction) {
    const now = Date.now();
    const windowSize = 10000;

    if (now - this.currentWindow.timestamp > windowSize) {
      this.timeline.push(this.currentWindow);
      if (this.timeline.length > 50) {
        this.timeline.shift();
      }
      this.currentWindow = { timestamp: now, normal_count: 0, attack_count: 0 };
    }

    if (prediction === 'normal') {
      this.currentWindow.normal_count++;
    } else {
      this.currentWindow.attack_count++;
    }
  }

  getRecentTraffic(limit = 100) {
    return this.trafficLog.slice(0, limit);
  }

  getStats() {
    return {
      counters: this.counters,
      totalTimelineWindows: this.timeline.length
    };
  }

  getTimeline() {
    return [...this.timeline, this.currentWindow];
  }

  reset() {
    this.trafficLog = [];
    this.counters = { total: 0, normal: 0, ddos: 0, port_scan: 0, dns_spoof: 0, mitm: 0 };
    this.timeline = [];
    this.currentWindow = { timestamp: Date.now(), normal_count: 0, attack_count: 0 };
  }
}

module.exports = new DataStore();
