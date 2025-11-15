const https = require('https');
const http = require('http');
const { validateConfig } = require('./configValidator');

function fetchUrl(url) {
	return new Promise((resolve, reject) => {
		const client = url.startsWith('https://') ? https : http;
		
		const req = client.get(url, (res) => {
			if (res.statusCode !== 200) {
				reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
				return;
			}

			let data = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => resolve(data));
		});

		req.on('error', reject);
		req.setTimeout(10000, () => {
			req.destroy();
			reject(new Error('Timeout'));
		});
	});
}

function parseConfigsFromText(text) {
	if (!text || typeof text !== 'string') {
		return [];
	}

	const lines = text.split('\n');
	const configs = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Проверяем, является ли строка конфигом
		if (trimmed.startsWith('vless://') || 
		    trimmed.startsWith('vmess://') || 
		    trimmed.startsWith('trojan://') || 
		    trimmed.startsWith('ss://')) {
			configs.push(trimmed);
		}
	}

	return configs;
}

async function loadConfigsFromUrl(url) {
	try {
		const text = await fetchUrl(url);
		const configs = parseConfigsFromText(text);
		
		// Валидируем каждый конфиг
		const validConfigs = [];
		const errors = [];

		for (const config of configs) {
			const validation = validateConfig(config);
			if (validation.valid) {
				validConfigs.push(validation.configUrl);
			} else {
				errors.push({ config: config.slice(0, 50), error: validation.error });
			}
		}

		return {
			success: true,
			total: configs.length,
			valid: validConfigs.length,
			invalid: errors.length,
			configs: validConfigs,
			errors: errors
		};
	} catch (error) {
		return {
			success: false,
			error: error.message
		};
	}
}

module.exports = {
	fetchUrl,
	parseConfigsFromText,
	loadConfigsFromUrl
};




