const fs = require('fs');
const path = require('path');
const config = require('../config');

function writeConfig(xrayConfig) {
  // 确保目录存在
  const dir = path.dirname(config.xrayConfigPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const json = JSON.stringify(xrayConfig, null, 2);
  fs.writeFileSync(config.xrayConfigPath, json, 'utf-8');
}

function validateConfig(xrayConfig) {
  if (!xrayConfig || typeof xrayConfig !== 'object') {
    throw new Error('Invalid Xray config: not an object');
  }
  if (!Array.isArray(xrayConfig.inbounds)) {
    throw new Error('Invalid Xray config: missing inbounds array');
  }
  // 端口不能重复
  const ports = new Set();
  for (const ib of xrayConfig.inbounds) {
    if (!ib.port || typeof ib.port !== 'number') {
      throw new Error(`Invalid inbound: missing or invalid port`);
    }
    if (ports.has(ib.port)) {
      throw new Error(`Duplicate port: ${ib.port}`);
    }
    ports.add(ib.port);
    if (!ib.protocol) {
      throw new Error(`Inbound on port ${ib.port}: missing protocol`);
    }
  }
  return true;
}

module.exports = { writeConfig, validateConfig };
