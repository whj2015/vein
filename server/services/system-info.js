const os = require('os');

function getSystemStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // 计算 CPU 使用率
  const cpuUsage =
    cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / (cpus.length || 1);

  return {
    cpu: {
      percent: Math.round(cpuUsage * 100),
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
    },
    memory: {
      total: totalMem,
      used: totalMem - freeMem,
      free: freeMem,
      percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    uptime: os.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    load: loadAvg,
  };
}

module.exports = { getSystemStats };
