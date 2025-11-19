const parsers = require('./parsers');

function validateConfig(configUrl) {
	if (!configUrl || typeof configUrl !== 'string') {
		return { valid: false, error: 'Конфиг должен быть строкой' };
	}

	const trimmed = configUrl.trim();
	if (!trimmed) {
		return { valid: false, error: 'Конфиг не может быть пустым' };
	}

	// Проверяем поддерживаемые протоколы
	const protocols = ['vless://', 'vmess://', 'trojan://', 'ss://'];
	const hasProtocol = protocols.some(p => trimmed.startsWith(p));

	if (!hasProtocol) {
		return { valid: false, error: 'Неподдерживаемый протокол. Используйте: vless://, vmess://, trojan:// или ss://' };
	}

	// Пытаемся распарсить конфиг
	try {
		let outbound;
		if (trimmed.startsWith('vless://')) {
			outbound = parsers.parseVless(trimmed);
		} else if (trimmed.startsWith('vmess://')) {
			outbound = parsers.parseVmess(trimmed);
		} else if (trimmed.startsWith('trojan://')) {
			outbound = parsers.parseTrojan(trimmed);
		} else if (trimmed.startsWith('ss://')) {
			outbound = parsers.parseShadowsocks(trimmed);
		} else {
			return { valid: false, error: 'Неизвестный протокол' };
		}

		// Проверяем базовую структуру
		if (!outbound || !outbound.protocol) {
			return { valid: false, error: 'Неверный формат конфига' };
		}

		return { valid: true, outbound, configUrl: trimmed };
	} catch (e) {
		return { valid: false, error: `Ошибка парсинга: ${e.message}` };
	}
}

function extractServerName(configUrl) {
	try {
		// Пытаемся извлечь имя из фрагмента (#name)
		const hashIndex = configUrl.indexOf('#');
		if (hashIndex > -1) {
			const name = decodeURIComponent(configUrl.slice(hashIndex + 1));
			if (name) return name;
		}

		// Или из хоста
		if (configUrl.startsWith('vless://') || configUrl.startsWith('trojan://') || configUrl.startsWith('ss://')) {
			const url = new URL(configUrl);
			return url.hostname;
		} else if (configUrl.startsWith('vmess://')) {
			const b64 = configUrl.replace('vmess://', '');
			const v = JSON.parse(Buffer.from(b64, 'base64').toString());
			return v.add || v.host || 'VMess Server';
		}

		return 'Неизвестный сервер';
	} catch (e) {
		return 'Сервер';
	}
}

function extractFlag(configUrl) {
	try {
		// Пытаемся найти флаг эмодзи в имени
		const hashIndex = configUrl.indexOf('#');
		if (hashIndex > -1) {
			const name = configUrl.slice(hashIndex + 1);
			// Ищем флаг эмодзи (🇺🇸, 🇩🇪 и т.д.)
			const flagMatch = name.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
			if (flagMatch) {
				return flagMatch[0];
			}
		}
		return '🌐';
	} catch (e) {
		return '🌐';
	}
}

module.exports = {
	validateConfig,
	extractServerName,
	extractFlag
};








