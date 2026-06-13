const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: parseInt(process.env.PORT) || 54321,
  jwtSecret: process.env.JWT_SECRET || 'vein-change-me-in-production',
  xrayPath: process.env.XRAY_PATH || '/usr/local/bin/xray',
  xrayConfigPath: process.env.XRAY_CONFIG_PATH || '/usr/local/etc/xray/config.json',
  dbPath: path.join(__dirname, 'db', 'vein.db'),
};
