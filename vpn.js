#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const parsers = require('./src/core/parsers');
const { runXray } = require('./src/core/xrayRunner');

// Конфиги теперь загружаются динамически через configManager
// Этот файл используется только для CLI режима
const configManager = require('./src/core/configManager');

function resolveXrayPath() {
  // Prefer bundled binaries: xray (unix) / xray.exe (win)
  const baseDir = __dirname;
  const winPath = path.join(baseDir, 'xray.exe');
  const unixPath = path.join(baseDir, 'xray');
  if (process.platform === 'win32') {
    if (fs.existsSync(winPath)) return winPath;
    return 'xray.exe'; // fallback to PATH
  } else {
    if (fs.existsSync(unixPath)) {
      try { fs.chmodSync(unixPath, 0o755); } catch(e) {}
      return unixPath;
    }
    return 'xray'; // fallback to PATH
  }
}

function parseVless(u) {
  const p = new URL(u);
  const params = new URLSearchParams(p.search);
  const security = params.get('security') || 'none';

  const realitySettings = security === 'reality' ? {
    show: false,
    fingerprint: params.get('fp') || 'chrome',
    serverName: params.get('sni') || '',     // ← ИСПРАВЛЕНО: serverName, а не serverNames
    publicKey: params.get('pbk') || '',
    shortId: params.get('sid') || '',
    spiderX: params.get('spx') || ''
  } : undefined;

  return {
    tag: 'proxy',
    protocol: 'vless',
    settings: {
      vnext: [{
        address: p.hostname,
        port: +p.port,
        users: [{ id: p.username, encryption: 'none', flow: params.get('flow') || '' }]
      }]
    },
    streamSettings: {
      network: params.get('type') || 'tcp',
      security: security,
      realitySettings: realitySettings,
      wsSettings: params.get('type') === 'ws' ? {
        path: decodeURIComponent(params.get('path') || '/'),
        headers: { Host: decodeURIComponent(params.get('host') || '') }
      } : undefined,
      httpSettings: (params.get('type') === 'http' || params.get('headerType') === 'http') ? {
        path: decodeURIComponent(params.get('path') || '/'),
        host: [decodeURIComponent(params.get('host') || '')]
      } : undefined
    }
  };
}

function parseVmess(u) {
  const b64 = u.replace('vmess://', '');
  const v = JSON.parse(Buffer.from(b64, 'base64').toString());
  return {
    tag: 'proxy',
    protocol: 'vmess',
    settings: {
      vnext: [{
        address: v.add,
        port: +v.port,
        users: [{ id: v.id, alterId: +(v.aid || 0), security: v.scy || 'auto' }]
      }]
    },
    streamSettings: {
      network: v.net || 'tcp',
      security: v.tls === 'tls' ? 'tls' : 'none',
      tlsSettings: v.tls === 'tls' ? {
        serverName: v.sni || v.host || v.add,
        allowInsecure: false
      } : undefined,
      wsSettings: v.net === 'ws' ? {
        path: v.path || '/',
        headers: { Host: v.host || '' }
      } : undefined
    }
  };
}

function parseTrojan(u) {
  const p = new URL(u);
  const params = new URLSearchParams(p.search);
  const hasTls = (params.get('security') || 'tls') === 'tls';
  return {
    tag: 'proxy',
    protocol: 'trojan',
    settings: {
      servers: [{
        address: p.hostname,
        port: +p.port || 443,
        password: decodeURIComponent(p.username) || ''
      }]
    },
    streamSettings: {
      network: 'tcp',
      security: hasTls ? 'tls' : 'none',
      tlsSettings: hasTls ? {
        serverName: params.get('sni') || p.hostname,
        allowInsecure: params.get('allowInsecure') === '1' || params.get('allowInsecure') === 'true'
      } : undefined
    }
  };
}

function parseShadowsocks(u) {
  // ss://[method:password@]host:port#tag  OR ss://base64(method:password)@host:port
  // Handle both. Extract method, password, host, port.
  const raw = u.replace('ss://', '');
  let credsPart = '';
  let rest = '';
  if (raw.includes('@')) {
    // format: [creds]@[host:port][?params]#[tag]
    const atIdx = raw.indexOf('@');
    credsPart = raw.slice(0, atIdx);
    rest = raw.slice(atIdx + 1);
  } else {
    // base64 creds then host:port after '@' might be missing in some clients, try decode all before first '#','/','?'
    const cut = raw.split('#')[0].split('/')[0].split('?')[0];
    try {
      credsPart = Buffer.from(cut, 'base64').toString();
      rest = raw.slice(cut.length);
      if (rest.startsWith('@')) rest = rest.slice(1);
    } catch(e) {
      // fallback
      credsPart = '';
      rest = raw;
    }
  }
  let method = '';
  let password = '';
  if (credsPart) {
    const sep = credsPart.indexOf(':');
    if (sep > -1) {
      method = credsPart.slice(0, sep);
      password = credsPart.slice(sep + 1);
    }
  }
  // host:port
  const hostPort = rest.split('#')[0].split('?')[0];
  const hpSep = hostPort.lastIndexOf(':');
  const host = hpSep > -1 ? hostPort.slice(0, hpSep) : hostPort;
  const port = hpSep > -1 ? parseInt(hostPort.slice(hpSep + 1), 10) : 8388;

  return {
    tag: 'proxy',
    protocol: 'shadowsocks',
    settings: {
      servers: [{
        address: host,
        port: port,
        method: method || 'chacha20-ietf-poly1305',
        password: password || '',
        level: 0,
        ota: false
      }]
    },
    streamSettings: {
      network: 'tcp',
      security: 'none'
    }
  };
}

function generateConfig(outbound) {
  return {
    log: { loglevel: 'warning' },
    inbounds: [{
      listen: '127.0.0.1',
      port: 1080,
      protocol: 'socks',
      settings: { auth: 'noauth', udp: true }
    }],
    outbounds: [outbound, { protocol: 'freedom', tag: 'direct' }],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [{ type: 'field', ip: ['geoip:private', 'geoip:cn'], outboundTag: 'direct' }]
    }
  };
}

const args = process.argv.slice(2);
if (!args[0]) {
  console.log('Использование: node vpn.js <номер>   или   node vpn.js connect <config-url>   или   node vpn.js list');
  process.exit(0);
}
if (args[0] === 'list') {
  const CFGS = configManager.getAllConfigs();
  CFGS.forEach((c, i) => {
    const name = c.split('#')[1] || c.slice(0, 50);
    console.log(i + ': ' + name);
  });
  process.exit(0);
}

// Если передан 'connect', берем конфиг из следующего аргумента
let configUrl;
let useTun = false;
if (args[0] === 'connect' && args[1]) {
  configUrl = args[1];
  // Проверяем наличие флага --tun
  useTun = args.includes('--tun');
} else {
  // Старый режим: по индексу
  const CFGS = configManager.getAllConfigs();
  const idx = CFGS[parseInt(args[0])];
  if (!idx) { console.log('Нет такого сервера!'); process.exit(1); }
  configUrl = idx;
  useTun = args.includes('--tun');
}

if (!configUrl) { console.log('Нет такого сервера!'); process.exit(1); }

let outbound;
if (configUrl.startsWith('vless://')) outbound = parsers.parseVless(configUrl);
else if (configUrl.startsWith('vmess://')) outbound = parsers.parseVmess(configUrl);
else if (configUrl.startsWith('trojan://')) outbound = parsers.parseTrojan(configUrl);
else if (configUrl.startsWith('ss://')) outbound = parsers.parseShadowsocks(configUrl);
else { console.log('Неизвестный протокол'); process.exit(1); }

console.log(`Подключаюсь к: ${configUrl.split('#')[1] || configUrl.slice(0, 60)}${useTun ? ' (TUN режим)' : ''}`);
const { child: xray, configPath } = runXray(outbound, __dirname, useTun);

xray.stdout.on('data', d => process.stdout.write(d));
xray.stderr.on('data', d => process.stderr.write(d));
xray.on('close', code => {
  console.log(`\nXray остановлен (код ${code})`);
  try { fs.unlinkSync(configPath); } catch(e) {}
});

process.on('SIGINT', () => {
  xray.kill();
  try { fs.unlinkSync(configPath); } catch(e) {}
  process.exit();
});

console.log('SOCKS5 готов: 127.0.0.1:1080 (Ctrl+C — стоп)');