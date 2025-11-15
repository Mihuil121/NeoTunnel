const https = require('https');
const { SocksProxyAgent } = require('socks-proxy-agent');

let speedTimer = null;

function startSpeedMonitor(sendFn) {
	stopSpeedMonitor();
	const agent = new SocksProxyAgent('socks5h://127.0.0.1:1080');

	async function measureDownload(bytes = 262144) {
		return new Promise((resolve) => {
			const start = Date.now();
			let received = 0;
			const req = https.get(`https://httpbin.org/bytes/${bytes}`, { agent }, (res) => {
				res.on('data', (chunk) => { received += chunk.length; });
				res.on('end', () => {
					const secs = Math.max((Date.now() - start) / 1000, 0.001);
					resolve({ bytes: received, bps: received / secs });
				});
			});
			req.on('error', () => resolve({ bytes: 0, bps: 0 }));
			req.setTimeout(8000, () => { req.destroy(); resolve({ bytes: 0, bps: 0 }); });
		});
	}

	async function measureUpload(bytes = 131072) {
		return new Promise((resolve) => {
			const payload = Buffer.alloc(bytes, 1);
			const start = Date.now();
			const req = https.request('https://httpbin.org/post', { method: 'POST', agent, headers: { 'Content-Length': String(bytes) } }, (res) => {
				res.resume();
				res.on('end', () => {
					const secs = Math.max((Date.now() - start) / 1000, 0.001);
					resolve({ bytes, bps: bytes / secs });
				});
			});
			req.on('error', () => resolve({ bytes: 0, bps: 0 }));
			req.setTimeout(8000, () => { req.destroy(); resolve({ bytes: 0, bps: 0 }); });
			req.write(payload);
			req.end();
		});
	}

	async function tick() {
		try {
			const [down, up] = await Promise.all([measureDownload(), measureUpload()]);
			sendFn({
				downBytes: down.bytes,
				downBps: down.bps,
				upBytes: up.bytes,
				upBps: up.bps,
				ts: Date.now()
			});
		} catch (_) {
			sendFn({ downBytes: 0, downBps: 0, upBytes: 0, upBps: 0, ts: Date.now() });
		}
	}

	speedTimer = setInterval(tick, 5000);
	tick();
}

function stopSpeedMonitor() {
	if (speedTimer) {
		clearInterval(speedTimer);
		speedTimer = null;
	}
}

module.exports = { startSpeedMonitor, stopSpeedMonitor };


