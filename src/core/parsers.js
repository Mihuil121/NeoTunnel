const decodeB64Json = (s) => JSON.parse(Buffer.from(s, 'base64').toString());

function parseVless(u) {
	const p = new URL(u);
	const params = new URLSearchParams(p.search);
	const security = params.get('security') || 'none';

	const realitySettings = security === 'reality' ? {
		show: false,
		fingerprint: params.get('fp') || 'chrome',
		serverName: params.get('sni') || '',
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
			tlsSettings: (security === 'tls' && !realitySettings) ? {
				serverName: params.get('sni') || params.get('host') || '',
				allowInsecure: false,
				alpn: params.get('alpn') ? params.get('alpn').split(',') : undefined,
				fingerprint: params.get('fp') || undefined
			} : undefined,
			wsSettings: params.get('type') === 'ws' ? {
				path: decodeURIComponent(params.get('path') || '/'),
				headers: { Host: decodeURIComponent(params.get('host') || '') }
			} : undefined,
			httpSettings: (params.get('type') === 'http' || params.get('headerType') === 'http') ? {
				path: decodeURIComponent(params.get('path') || '/'),
				host: [decodeURIComponent(params.get('host') || '')]
			} : undefined,
			grpcSettings: params.get('type') === 'grpc' ? {
				serviceName: decodeURIComponent(params.get('serviceName') || params.get('host') || ''),
				multiMode: params.get('mode') === 'multi'
			} : undefined
		}
	};
}

function parseVmess(u) {
	const b64 = u.replace('vmess://', '');
	const v = decodeB64Json(b64);
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
	const raw = u.replace('ss://', '');
	let credsPart = '';
	let rest = '';
	if (raw.includes('@')) {
		const atIdx = raw.indexOf('@');
		credsPart = raw.slice(0, atIdx);
		rest = raw.slice(atIdx + 1);
	} else {
		const cut = raw.split('#')[0].split('/')[0].split('?')[0];
		try {
			credsPart = Buffer.from(cut, 'base64').toString();
			rest = raw.slice(cut.length);
			if (rest.startsWith('@')) rest = rest.slice(1);
		} catch(e) {
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

module.exports = {
	parseVless,
	parseVmess,
	parseTrojan,
	parseShadowsocks,
	generateConfig
};


