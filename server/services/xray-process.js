const { spawn } = require('child_process');
const config = require('../config');
const { buildXrayConfig } = require('./xray-config');
const { writeConfig, validateConfig } = require('./xray-config-io');

let xrayProcess = null;

function startXray() {
  if (xrayProcess) return { status: 'already_running', pid: xrayProcess.pid };

  try {
    const cfg = buildXrayConfig();
    validateConfig(cfg);
    writeConfig(cfg);

    xrayProcess = spawn(config.xrayPath, ['run', '-config', config.xrayConfigPath], {
      stdio: 'ignore',
      detached: false,
    });

    xrayProcess.on('exit', (code) => {
      console.log(`Xray exited with code ${code}`);
      xrayProcess = null;
    });

    xrayProcess.on('error', (err) => {
      console.error(`Xray process error: ${err.message}`);
      xrayProcess = null;
    });

    return { status: 'started', pid: xrayProcess.pid };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

function stopXray() {
  if (!xrayProcess) return { status: 'not_running' };
  try {
    xrayProcess.kill('SIGTERM');
    xrayProcess = null;
    return { status: 'stopped' };
  } catch (e) {
    xrayProcess = null;
    return { status: 'error', error: e.message };
  }
}

function restartXray() {
  stopXray();
  return startXray();
}

function getXrayStatus() {
  return {
    running: xrayProcess !== null,
    pid: xrayProcess ? xrayProcess.pid : null,
  };
}

// 配置变更后重新生成配置并重载 Xray
function regenerateConfig() {
  try {
    const cfg = buildXrayConfig();
    validateConfig(cfg);
    writeConfig(cfg);

    if (xrayProcess) {
      // Xray 不支持 SIGHUP 热重载，用 restart
      console.log('Config changed, restarting Xray...');
      restartXray();
    }
  } catch (e) {
    console.error('Config regeneration failed:', e.message);
  }
}

module.exports = { startXray, stopXray, restartXray, getXrayStatus, regenerateConfig };
