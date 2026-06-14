// 解析 stream_settings JSON，提取传输参数
function parseStream(ss) {
  let o = {};
  try { o = typeof ss === 'string' ? JSON.parse(ss) : (ss || {}); } catch {}
  return {
    net: o.network || 'tcp',
    security: o.security || 'none',
    sni: o.tlsSettings?.serverName || o.realitySettings?.serverNames?.[0] || '',
    fp: o.tlsSettings?.fingerprint || o.realitySettings?.fingerprint || 'chrome',
    host: o.wsSettings?.headers?.Host || o.h2Settings?.host || o.httpSettings?.host?.[0] || o.tlsSettings?.serverName || '',
    path: o.wsSettings?.path || o.h2Settings?.path || o.httpSettings?.path || o.grpcSettings?.serviceName || '',
    // reality
    pbk: o.realitySettings?.publicKey || '',
    sid: o.realitySettings?.shortIds?.[0] || '',
    spx: o.realitySettings?.spiderX || '/',
    // kcp
    kcp: o.kcpSettings || null,
    // grpc
    serviceName: o.grpcSettings?.serviceName || '',
    multiMode: o.grpcSettings?.multiMode || false,
  };
}

// 构建 vless:// 链接（完整参数）
function buildVlessLink(uuid, address, port, stream) {
  const params = [];
  params.push('encryption=none');
  if (stream.security !== 'none') {
    params.push('security=' + stream.security);
    if (stream.security === 'reality') {
      if (stream.pbk) params.push('pbk=' + stream.pbk);
      if (stream.sid) params.push('sid=' + stream.sid);
      if (stream.spx && stream.spx !== '/') params.push('spx=' + encodeURIComponent(stream.spx));
    } else {
      if (stream.sni) params.push('sni=' + stream.sni);
    }
    if (stream.fp && stream.fp !== 'chrome') params.push('fp=' + stream.fp);
  }
  if (stream.net !== 'tcp') {
    params.push('type=' + stream.net);
    if (stream.host) params.push('host=' + stream.host);
    if (stream.path) params.push('path=' + encodeURIComponent(stream.path));
    if (stream.net === 'grpc' && stream.serviceName) {
      params.push('serviceName=' + stream.serviceName);
      if (stream.multiMode) params.push('mode=multi');
    }
  }
  return 'vless://' + uuid + '@' + address + ':' + port + '?' + params.join('&') + '#Vein';
}

// 构建 vmess:// 链接（完整字段）
function buildVmessLink(uuid, address, port, stream, name) {
  const cfg = {
    v: '2',
    ps: name || 'Vein',
    add: address,
    port: String(port),
    id: uuid,
    aid: '0',
    scy: 'auto',
    net: stream.net,
    type: stream.net === 'kcp' ? (stream.kcp?.header?.type || 'none') : 'none',
    host: stream.host || stream.sni || '',
    path: stream.path || '',
    tls: stream.security === 'tls' ? 'tls' : (stream.security === 'reality' ? 'reality' : ''),
    sni: stream.sni || '',
    alpn: '',
    fp: stream.fp || '',
  };
  return 'vmess://' + btoa(JSON.stringify(cfg));
}

// 构建 trojan:// 链接
function buildTrojanLink(password, address, port, stream) {
  const params = [];
  if (stream.security === 'tls') {
    params.push('security=tls');
    if (stream.sni) params.push('sni=' + stream.sni);
  }
  if (stream.net !== 'tcp') {
    params.push('type=' + stream.net);
    if (stream.host) params.push('host=' + stream.host);
    if (stream.path) params.push('path=' + encodeURIComponent(stream.path));
  }
  const qs = params.length ? '?' + params.join('&') : '';
  return 'trojan://' + password + '@' + address + ':' + port + qs + '#Vein';
}

// 构建 ss:// 链接
function buildSsLink(password, method, address, port) {
  const b64 = btoa((method || 'aes-256-gcm') + ':' + password);
  return 'ss://' + b64 + '@' + address + ':' + port + '#Vein';
}

// 主入口：根据协议类型生成链接
export function buildLink(protocol, uuid, port, streamSettings, serverIp) {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const address = host && host !== 'localhost' && host !== '127.0.0.1' ? host : (serverIp || 'YOUR_SERVER_IP');
  const stream = parseStream(streamSettings);

  switch (protocol) {
    case 'vmess':
      return buildVmessLink(uuid, address, port, stream);
    case 'vless':
      return buildVlessLink(uuid, address, port, stream);
    case 'trojan':
      return buildTrojanLink(uuid, address, port, stream);
    case 'shadowsocks':
      return buildSsLink(uuid, 'aes-256-gcm', address, port);
    default:
      return '';
  }
}
