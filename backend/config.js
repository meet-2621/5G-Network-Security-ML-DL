const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
module.exports = {
  PORT: process.env.PORT || 3000,
  PYTHON_PATH: process.env.PYTHON_PATH || 'python',
  ML_MODEL_DIR: path.join(__dirname, '../ml-pipeline/models'),
  ML_PREDICT_SCRIPT: path.join(__dirname, '../ml-pipeline/predict.py'),
  FIREWALL: {
    // true = only record blocks (safe demo). false = really run iptables (needs sudo)
    DRY_RUN: (process.env.FIREWALL_DRY_RUN || 'true') !== 'false',
    AUTO_BLOCK: (process.env.AUTO_BLOCK || 'true') !== 'false',
    MIN_CONFIDENCE: parseFloat(process.env.BLOCK_MIN_CONFIDENCE || '0.90'),
    HITS_REQUIRED: parseInt(process.env.BLOCK_HITS_REQUIRED || '3', 10),
    WINDOW_SECONDS: parseInt(process.env.BLOCK_WINDOW_SECONDS || '60', 10),
    AUTO_BLOCK_MINUTES: parseInt(process.env.AUTO_BLOCK_MINUTES || '60', 10), // 0 = forever
    WHITELIST: (process.env.WHITELIST_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
  },
  TRAFFIC_INTERVAL: 2000,
  MAX_TRAFFIC_LOG: 500,
  FEATURE_COLUMNS: [
    'packet_size',
    'flow_duration',
    'packet_rate',
    'byte_rate',
    'protocol_type',
    'src_port',
    'dst_port',
    'flag_count',
    'iat_mean',
    'payload_entropy'
  ]
};
