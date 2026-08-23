const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
module.exports = {
  PORT: process.env.PORT || 3000,
  PYTHON_PATH: process.env.PYTHON_PATH || 'python',
  ML_MODEL_DIR: path.join(__dirname, '../ml-pipeline/models'),
  ML_PREDICT_SCRIPT: path.join(__dirname, '../ml-pipeline/predict.py'),
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
