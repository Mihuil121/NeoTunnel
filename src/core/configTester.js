const { validateConfig } = require('./configValidator');
const dns = require('dns');
const net = require('net');

// Упрощенный тест - используем testConfigSimple
async function testConfig(configUrl, timeout = 5000) {
	return await testConfigSimple(configUrl);
}

// Упрощенный тест - проверка доступности хоста
async function testConfigSimple(configUrl) {
	try {
		const validation = validateConfig(configUrl);
		if (!validation.valid) {
			return { success: false, error: validation.error, latency: null };
		}

		// Извлекаем хост из конфига
		let host = '';
		if (configUrl.startsWith('vless://') || configUrl.startsWith('trojan://') || configUrl.startsWith('ss://')) {
			const url = new URL(configUrl);
			host = url.hostname;
		} else if (configUrl.startsWith('vmess://')) {
			const b64 = configUrl.replace('vmess://', '');
			const v = JSON.parse(Buffer.from(b64, 'base64').toString());
			host = v.add || v.host || '';
		}

		if (!host) {
			return { success: false, error: 'Cannot extract host', latency: null };
		}

		// Простой ping через DNS lookup и TCP connect
		return new Promise((resolve) => {
			const startTime = Date.now();
			const dns = require('dns');
			
			dns.lookup(host, (err, address) => {
				if (err) {
					resolve({ success: false, error: 'DNS lookup failed', latency: null });
					return;
				}

				// Пытаемся подключиться к порту
				let port = 443;
				if (configUrl.startsWith('vless://') || configUrl.startsWith('trojan://') || configUrl.startsWith('ss://')) {
					const url = new URL(configUrl);
					port = parseInt(url.port) || 443;
				} else if (configUrl.startsWith('vmess://')) {
					const b64 = configUrl.replace('vmess://', '');
					const v = JSON.parse(Buffer.from(b64, 'base64').toString());
					port = parseInt(v.port) || 443;
				}
				
				const socket = new net.Socket();
				const timeout = 3000;

				socket.setTimeout(timeout);
				socket.once('connect', () => {
					const latency = Date.now() - startTime;
					socket.destroy();
					resolve({ success: true, latency, error: null });
				});

				socket.once('timeout', () => {
					socket.destroy();
					resolve({ success: false, error: 'Connection timeout', latency: null });
				});

				socket.once('error', () => {
					socket.destroy();
					resolve({ success: false, error: 'Connection failed', latency: null });
				});

				socket.connect(port, address);
			});
		});
	} catch (error) {
		return { success: false, error: error.message, latency: null };
	}
}

module.exports = {
	testConfig,
	testConfigSimple
};

