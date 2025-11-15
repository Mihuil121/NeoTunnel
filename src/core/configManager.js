const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE = path.join(os.homedir(), '.my-vpn-configs.json');

function loadConfigs() {
	try {
		if (fs.existsSync(CONFIG_FILE)) {
			const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
			const parsed = JSON.parse(data);
			return Array.isArray(parsed) ? parsed : [];
		}
	} catch (e) {
		console.warn('Failed to load configs:', e.message);
	}
	return [];
}

function saveConfigs(configs) {
	try {
		fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');
		return true;
	} catch (e) {
		console.error('Failed to save configs:', e.message);
		return false;
	}
}

function addConfig(configUrl) {
	const configs = loadConfigs();
	// Проверяем, нет ли уже такого конфига
	if (!configs.includes(configUrl)) {
		configs.push(configUrl);
		saveConfigs(configs);
		return true;
	}
	return false;
}

function removeConfig(configUrl) {
	const configs = loadConfigs();
	const filtered = configs.filter(c => c !== configUrl);
	if (filtered.length !== configs.length) {
		saveConfigs(filtered);
		return true;
	}
	return false;
}

function getAllConfigs() {
	return loadConfigs();
}

function clearConfigs() {
	saveConfigs([]);
}

function addConfigsBatch(configUrls) {
	const configs = loadConfigs();
	let added = 0;
	
	for (const configUrl of configUrls) {
		if (!configs.includes(configUrl)) {
			configs.push(configUrl);
			added++;
		}
	}
	
	if (added > 0) {
		saveConfigs(configs);
	}
	
	return { added, total: configs.length };
}

function removeDuplicates() {
	const configs = loadConfigs();
	const unique = [...new Set(configs)];
	const removed = configs.length - unique.length;
	
	if (removed > 0) {
		saveConfigs(unique);
	}
	
	return { removed, total: unique.length };
}

module.exports = {
	loadConfigs,
	saveConfigs,
	addConfig,
	removeConfig,
	getAllConfigs,
	clearConfigs,
	addConfigsBatch,
	removeDuplicates
};

