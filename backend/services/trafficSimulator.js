const config = require('../config');
const crypto = require('crypto');

const TICK_INTERVAL = 500;
const STATS_BROADCAST_INTERVAL = 3000;

class TrafficSimulator {
  constructor() {
    this.intervalId = null;
    this.statsIntervalId = null;
    this.busy = false;
  }

  start(io, dataStore, mlService) {
    if (this.intervalId) return;

    console.log(
      `[Simulator] Starting traffic simulation every ${TICK_INTERVAL}ms`
    );

    this.intervalId = setInterval(async () => {
      if (this.busy) return;

      this.busy = true;

      try {
        const startTime = process.hrtime.bigint();

        const features = this._generateFeatures();

        const result = await mlService.predict(features);

        const endTime = process.hrtime.bigint();

        const processingTime =
          Number(endTime - startTime) / 1e6;

        const event = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          features,
          prediction: result.prediction,
          confidence: result.confidence,
          probabilities: result.probabilities,
          processingTime
        };

        dataStore.addTraffic(event);

        io.emit('traffic-event', event);

      } catch (err) {
        console.error(
          '[Simulator] Tick error:',
          err.message
        );
      } finally {
        this.busy = false;
      }

    }, TICK_INTERVAL);

    this.statsIntervalId = setInterval(() => {
      io.emit(
        'stats-update',
        dataStore.getStats()
      );
    }, STATS_BROADCAST_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);

      if (this.statsIntervalId) {
        clearInterval(this.statsIntervalId);
      }

      this.intervalId = null;
      this.statsIntervalId = null;

      console.log(
        '[Simulator] Stopped traffic simulation'
      );
    }
  }

  _generateFeatures() {

    const isAttack = Math.random() < 0.30;

    let attackType = null;

    if (isAttack) {
      const types = [
        'ddos',
        'port_scan',
        'dns_spoof',
        'mitm'
      ];

      attackType =
        types[Math.floor(Math.random() * types.length)];
    }

    const rand = (min, max) =>
      min + Math.random() * (max - min);

    const randInt = (min, max) =>
      Math.floor(
        min + Math.random() * (max - min + 1)
      );

    /*
     * These ranges are based on the actual
     * training dataset distribution.
     */

    let features = {
      packet_size: randInt(64, 1499),
      flow_duration: rand(0.1, 10),
      packet_rate: rand(10, 100),
      byte_rate: rand(1000, 148000),
      protocol_type: randInt(0, 3),
      src_port: randInt(1024, 65535),
      dst_port: randInt(1, 65535),
      flag_count: randInt(0, 9),
      iat_mean: rand(10, 100),
      payload_entropy: rand(4.0, 7.5)
    };

    // -------------------------
    // DDoS
    // -------------------------

    if (attackType === 'ddos') {

      features.packet_size =
        randInt(64, 127);

      features.flow_duration =
        rand(0.01, 2);

      features.packet_rate =
        rand(1000, 9992);

      features.byte_rate =
        rand(72667, 1260000);

      features.flag_count =
        randInt(5, 19);

      features.iat_mean =
        rand(0.1, 5);

      features.payload_entropy =
        rand(1.0, 3.0);
    }

    // -------------------------
    // Port Scan
    // -------------------------

    else if (attackType === 'port_scan') {

      features.packet_size = 64;

      features.flow_duration =
        rand(0.1, 5);

      features.packet_rate =
        rand(50, 500);

      features.byte_rate =
        rand(3213, 32000);

      features.flag_count =
        randInt(2, 4);

      features.iat_mean =
        rand(1.0, 10);

      features.payload_entropy =
        rand(0.5, 2.0);
    }

    // -------------------------
    // DNS Spoof
    // -------------------------

    else if (attackType === 'dns_spoof') {

      features.packet_size =
        randInt(100, 299);

      features.flow_duration =
        rand(0.05, 1);

      features.packet_rate =
        rand(20, 100);

      features.byte_rate =
        rand(2320, 29000);

      features.flag_count = 0;

      features.src_port = 53;

      features.iat_mean =
        rand(5, 20);

      features.payload_entropy =
        rand(5.0, 7.0);
    }

    // -------------------------
    // MITM
    // -------------------------

    else if (attackType === 'mitm') {

      features.packet_size =
        randInt(502, 1497);

      features.flow_duration =
        rand(5, 20);

      features.packet_rate =
        rand(30, 150);

      features.byte_rate =
        rand(19000, 216000);

      features.flag_count =
        randInt(5, 14);

      features.iat_mean =
        rand(10, 50);

      features.payload_entropy =
        rand(6.0, 7.99);
    }

    return features;
  }
}

module.exports = new TrafficSimulator();