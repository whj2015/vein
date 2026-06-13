const { getDb } = require('../db/database');

function buildXrayConfig() {
  const db = getDb();
  const inbounds = db.prepare('SELECT * FROM inbounds WHERE enabled = 1').all();
  const clientStmt = db.prepare('SELECT * FROM clients WHERE inbound_id = ? AND enabled = 1');

  const inboundConfigs = inbounds.map(ib => {
    const clients = clientStmt.all(ib.id);
    const base = {
      port: ib.port,
      listen: ib.listen,
      protocol: ib.protocol,
      settings: buildProtocolSettings(ib.protocol, clients),
      sniffing: ib.sniffing
        ? { enabled: true, destOverride: ['http', 'tls'] }
        : undefined,
    };

    if (ib.stream_settings) {
      try {
        base.streamSettings = JSON.parse(ib.stream_settings);
      } catch {
        /* ignore invalid JSON — user can fix via UI */
      }
    }

    if (ib.remark) {
      base.tag = `inbound-${ib.id}`;
    }

    return base;
  });

  return {
    log: { loglevel: 'warning' },
    inbounds: inboundConfigs,
    outbounds: [
      {
        protocol: 'freedom',
        tag: 'direct',
        settings: {},
      },
    ],
    routing: {
      domainStrategy: 'AsIs',
      rules: [],
    },
  };
}

function buildProtocolSettings(protocol, clients) {
  switch (protocol) {
    case 'vmess':
      return {
        clients: clients.map(c => ({ id: c.uuid, email: c.email, level: 0 })),
      };
    case 'vless':
      return {
        clients: clients.map(c => ({ id: c.uuid, email: c.email, flow: '' })),
        decryption: 'none',
      };
    case 'trojan':
      return {
        clients: clients.map(c => ({ password: c.uuid, email: c.email })),
      };
    case 'shadowsocks':
      return {
        clients: clients.map(c => ({ password: c.uuid, email: c.email })),
        method: 'aes-256-gcm',
        network: 'tcp,udp',
      };
    default:
      return { clients: [] };
  }
}

module.exports = { buildXrayConfig };
