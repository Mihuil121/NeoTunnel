const { validateConfig } = require('./configValidator');
const dns = require('dns');
const net = require('net');

// Улучшенный тест с retry и более надежной проверкой
async function testConfig(configUrl, timeout = 3000) {
	return await testConfigSimple(configUrl, timeout);
}

// Быстрый тест - проверка доступности хоста (без retry для скорости)
async function testConfigSimple(configUrl, timeout = 2500) {
	// Убрали retry для ускорения - один быстрый тест лучше чем несколько медленных
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

			// Быстрый ping через DNS lookup и TCP connect
			const result = await new Promise((resolve) => {
				const startTime = Date.now();
				const connectTimeout = Math.min(timeout, 2000); // Максимум 2 секунды на подключение для скорости
				
				dns.lookup(host, { family: 4 }, (err, address) => {
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
					let resolved = false;

					const cleanup = () => {
						if (!resolved) {
							resolved = true;
							socket.removeAllListeners();
							if (!socket.destroyed) {
								socket.destroy();
							}
						}
					};

					socket.setTimeout(connectTimeout);
					
					socket.once('connect', () => {
						const latency = Date.now() - startTime;
						cleanup();
						resolve({ success: true, latency, error: null });
					});

					socket.once('timeout', () => {
						cleanup();
						resolve({ success: false, error: 'Connection timeout', latency: null });
					});

					socket.once('error', (err) => {
						cleanup();
						resolve({ success: false, error: err.code || 'Connection failed', latency: null });
					});

					try {
						socket.connect(port, address);
					} catch (err) {
						cleanup();
						resolve({ success: false, error: err.message, latency: null });
					}
				});
			});

			return result;
		} catch (error) {
			return { success: false, error: error.message, latency: null };
		}
}

module.exports = {
	testConfig,
	testConfigSimple
};

