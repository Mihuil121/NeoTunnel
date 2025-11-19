const { app, BrowserWindow, ipcMain, shell, session, clipboard } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { startSpeedMonitor, stopSpeedMonitor } = require('./src/main/speedMonitor');
const configManager = require('./src/core/configManager');
const { validateConfig, extractServerName, extractFlag } = require('./src/core/configValidator');
const { loadConfigsFromUrl, parseConfigsFromText } = require('./src/core/configLoader');
const subscriptionManager = require('./src/core/subscriptionManager');
const { testConfigSimple } = require('./src/core/configTester');

const VPN_DIR = __dirname;
let mainWindow;
let vpnProcess = null;
const PID_FILE = path.join(VPN_DIR, '.vpn_pid');
const Pinned_FILE = path.join(VPN_DIR, '.pinned_server');

// Параллельное тестирование с ограничением одновременных запросов
async function testConfigsParallel(configs, maxConcurrent = 15) {
	const results = [];
	const queue = [...configs];
	const inProgress = new Set();
	
	async function testNext() {
		if (queue.length === 0) return;
		
		const configUrl = queue.shift();
		inProgress.add(configUrl);
		
		try {
			const testResult = await testConfigSimple(configUrl);
			results.push({ configUrl, ...testResult });
		} catch (error) {
			results.push({ configUrl, success: false, error: error.message, latency: null });
		} finally {
			inProgress.delete(configUrl);
			
			// Запускаем следующий тест
			if (queue.length > 0) {
				await testNext();
			}
		}
	}
	
	// Запускаем параллельные тесты
	const promises = [];
	const concurrent = Math.min(maxConcurrent, configs.length);
	for (let i = 0; i < concurrent; i++) {
		promises.push(testNext());
	}
	
	await Promise.all(promises);
	
	return results;
}

async function setElectronProxy(enabled) {
  try {
    if (enabled) {
      await session.defaultSession.setProxy({
        proxyRules: 'socks5://127.0.0.1:1080',
        proxyBypassRules: 'localhost, 127.0.0.1'
      });
    } else {
      await session.defaultSession.setProxy({ mode: 'direct' });
    }
  } catch (error) {
    console.warn('Failed to set Electron proxy', error);
  }
}

function runHelper(cmd, args) {
  try {
    const options = { shell: process.platform === 'win32' };
    spawn(cmd, args, options);
  } catch (error) {
    console.warn(`Failed to execute helper command ${cmd}`, error);
  }
}

function setNativeProxy(enabled) {
  if (process.platform === 'linux') {
    const mode = enabled ? 'manual' : 'none';
    runHelper('gsettings', ['set', 'org.gnome.system.proxy', 'mode', mode]);
    if (enabled) {
      runHelper('gsettings', ['set', 'org.gnome.system.proxy.socks', 'host', '127.0.0.1']);
      runHelper('gsettings', ['set', 'org.gnome.system.proxy.socks', 'port', '1080']);
    }
  } else if (process.platform === 'win32') {
    const regPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
    if (enabled) {
      runHelper('reg', ['add', regPath, '/v', 'ProxyEnable', '/t', 'REG_DWORD', '/d', '1', '/f']);
      runHelper('reg', ['add', regPath, '/v', 'ProxyServer', '/t', 'REG_SZ', '/d', 'socks=127.0.0.1:1080', '/f']);
      runHelper('reg', ['add', regPath, '/v', 'ProxyOverride', '/t', 'REG_SZ', '/d', '<local>', '/f']);
    } else {
      runHelper('reg', ['add', regPath, '/v', 'ProxyEnable', '/t', 'REG_DWORD', '/d', '0', '/f']);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 680,
    resizable: false,
    title: "Шкатулка Запретов",
    icon: path.join(VPN_DIR, 'icon.png'),
    webPreferences: {
      preload: path.join(VPN_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(VPN_DIR, 'index.html'));
  mainWindow.setMenu(null);
}

app.whenReady().then(createWindow);

// Функция для преобразования конфигов в формат серверов
function buildServersFromConfigs(testResults = null) {
	const configs = configManager.getAllConfigs();
	const servers = {};
	
	// Создаем мапу результатов тестов
	const testMap = new Map();
	if (testResults) {
		testResults.forEach(result => {
			testMap.set(result.configUrl, result);
		});
	}

	// Сортируем конфиги если есть результаты тестов
	let sortedConfigs = [...configs];
	if (testResults && testResults.length > 0) {
		sortedConfigs.sort((a, b) => {
			const testA = testMap.get(a);
			const testB = testMap.get(b);
			if (testA && testB) {
				if (testA.success && !testB.success) return -1;
				if (!testA.success && testB.success) return 1;
				if (testA.success && testB.success) {
					return (testA.latency || Infinity) - (testB.latency || Infinity);
				}
			}
			return 0;
		});
	}
	
	sortedConfigs.forEach((configUrl, index) => {
		const name = extractServerName(configUrl);
		const flag = extractFlag(configUrl);
		const testResult = testMap.get(configUrl);
		
		let speed = 'пользовательский';
		if (testResult) {
			if (testResult.success) {
				speed = testResult.latency ? `${testResult.latency}ms` : 'доступен';
			} else {
				speed = 'недоступен';
			}
		}

		servers[index] = {
			name: name,
			flag: flag,
			speed: speed,
			configUrl: configUrl,
			testResult: testResult
		};
	});
	
	return servers;
}

ipcMain.handle('get-servers', async (event, testConfigs = false) => {
	if (testConfigs) {
		const configs = configManager.getAllConfigs();
		const testResults = await testConfigsParallel(configs, 15);
		return buildServersFromConfigs(testResults);
	}
	return buildServersFromConfigs();
});
ipcMain.handle('get-pinned', () => {
  if (fs.existsSync(Pinned_FILE)) return fs.readFileSync(Pinned_FILE, 'utf-8').trim();
  return null;
});
ipcMain.handle('pin-server', (event, id) => {
  fs.writeFileSync(Pinned_FILE, id);
  return true;
});

// отправка обновлений скорости в рендер
function sendSpeedUpdate(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('speed', data);
  }
}

ipcMain.handle('disconnect', async () => {
  if (vpnProcess) vpnProcess.kill();
  if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  setNativeProxy(false);
  await setElectronProxy(false);
  stopSpeedMonitor();
  return true;
});

ipcMain.handle('open-whoer', () => shell.openExternal('https://whoer.ip'));

// Управление конфигами
ipcMain.handle('get-configs', () => configManager.getAllConfigs());

ipcMain.handle('add-config', (event, configUrl) => {
	const validation = validateConfig(configUrl);
	if (!validation.valid) {
		return { success: false, error: validation.error };
	}
	
	const added = configManager.addConfig(validation.configUrl);
	if (added) {
		return { success: true, message: 'Конфиг добавлен' };
	} else {
		return { success: false, error: 'Такой конфиг уже существует' };
	}
});

ipcMain.handle('add-configs-from-text', async (event, text, testConfigs = false) => {
	const configs = parseConfigsFromText(text);
	
	if (configs.length === 0) {
		return { success: false, error: 'Не найдено ни одного конфига в тексте' };
	}
	
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
	
	if (validConfigs.length === 0) {
		return { 
			success: false, 
			error: 'Не найдено валидных конфигов',
			invalid: errors.length,
			total: configs.length
		};
	}
	
	let configsToAdd = validConfigs;
	const testResults = [];
	
	// Тестируем конфиги если нужно (параллельно)
	if (testConfigs) {
		testResults.push(...await testConfigsParallel(validConfigs, 15));
		// Сортируем по успешности и задержке
		testResults.sort((a, b) => {
			if (a.success && !b.success) return -1;
			if (!a.success && b.success) return 1;
			if (a.success && b.success) {
				return (a.latency || Infinity) - (b.latency || Infinity);
			}
			return 0;
		});
		configsToAdd = testResults.filter(r => r.success).map(r => r.configUrl);
	}
	
	const batchResult = configManager.addConfigsBatch(configsToAdd);
	return {
		success: true,
		total: configs.length,
		valid: validConfigs.length,
		added: batchResult.added,
		skipped: validConfigs.length - batchResult.added,
		invalid: errors.length,
		testResults: testConfigs ? testResults : null,
		message: `Найдено: ${configs.length}, валидных: ${validConfigs.length}, добавлено: ${batchResult.added}, пропущено: ${validConfigs.length - batchResult.added}, невалидных: ${errors.length}`
	};
});

ipcMain.handle('remove-config', (event, configUrl) => {
	const removed = configManager.removeConfig(configUrl);
	return { success: removed };
});

ipcMain.handle('get-clipboard', () => {
	return clipboard.readText();
});

ipcMain.handle('validate-config', (event, configUrl) => {
	return validateConfig(configUrl);
});

ipcMain.handle('load-configs-from-url', async (event, url, testConfigs = false) => {
	const result = await loadConfigsFromUrl(url);
	
	if (result.success && result.configs.length > 0) {
		let configsToAdd = result.configs;
		const testResults = [];

		// Тестируем конфиги если нужно (параллельно)
		if (testConfigs) {
			testResults.push(...await testConfigsParallel(result.configs, 15));
			// Сортируем по успешности и задержке
			testResults.sort((a, b) => {
				if (a.success && !b.success) return -1;
				if (!a.success && b.success) return 1;
				if (a.success && b.success) {
					return (a.latency || Infinity) - (b.latency || Infinity);
				}
				return 0;
			});
			configsToAdd = testResults.filter(r => r.success).map(r => r.configUrl);
		}

		const batchResult = configManager.addConfigsBatch(configsToAdd);
		return {
			success: true,
			loaded: result.valid,
			added: batchResult.added,
			skipped: result.valid - batchResult.added,
			invalid: result.invalid,
			total: result.total,
			testResults: testConfigs ? testResults : null,
			message: `Загружено: ${result.valid}, добавлено: ${batchResult.added}, пропущено: ${result.valid - batchResult.added}, невалидных: ${result.invalid}`
		};
	} else {
		return {
			success: false,
			error: result.error || 'Не удалось загрузить конфиги'
		};
	}
});

// Управление подписками
ipcMain.handle('get-subscriptions', () => subscriptionManager.getAllSubscriptions());
ipcMain.handle('add-subscription', (event, url) => {
	const added = subscriptionManager.addSubscription(url);
	return { success: added };
});
ipcMain.handle('remove-subscription', (event, url) => {
	const removed = subscriptionManager.removeSubscription(url);
	return { success: removed };
});
ipcMain.handle('update-all-subscriptions', async (event, testConfigs = false) => {
	const subscriptions = subscriptionManager.getAllSubscriptions();
	let totalLoaded = 0;
	let totalAdded = 0;
	const allTestResults = [];

	for (const url of subscriptions) {
		const result = await loadConfigsFromUrl(url);
		if (result.success && result.configs.length > 0) {
			let configsToAdd = result.configs;

			if (testConfigs) {
				const subscriptionTestResults = await testConfigsParallel(result.configs, 15);
				allTestResults.push(...subscriptionTestResults);
				// Сортируем по успешности и задержке
				allTestResults.sort((a, b) => {
					if (a.success && !b.success) return -1;
					if (!a.success && b.success) return 1;
					if (a.success && b.success) {
						return (a.latency || Infinity) - (b.latency || Infinity);
					}
					return 0;
				});
				configsToAdd = allTestResults.filter(r => r.success).map(r => r.configUrl);
			}

			const batchResult = configManager.addConfigsBatch(configsToAdd);
			totalLoaded += result.valid;
			totalAdded += batchResult.added;
		}
	}

	return {
		success: true,
		loaded: totalLoaded,
		added: totalAdded,
		testResults: testConfigs ? allTestResults : null,
		message: `Обновлено подписок: ${subscriptions.length}, загружено: ${totalLoaded}, добавлено: ${totalAdded}`
	};
});

// Тестирование конфигов
ipcMain.handle('test-config', async (event, configUrl) => {
	return await testConfigSimple(configUrl);
});

ipcMain.handle('test-all-configs', async (event) => {
	const configs = configManager.getAllConfigs();
	
	if (configs.length === 0) {
		return [];
	}

	// Параллельное тестирование с ограничением 15 одновременных запросов
	const results = await testConfigsParallel(configs, 15);

	// Сортируем по успешности и задержке
	results.sort((a, b) => {
		if (a.success && !b.success) return -1;
		if (!a.success && b.success) return 1;
		if (a.success && b.success) {
			return (a.latency || Infinity) - (b.latency || Infinity);
		}
		return 0;
	});

	return results;
});

// Удаление дубликатов и очистка
ipcMain.handle('remove-duplicates', () => {
	const result = configManager.removeDuplicates();
	return { success: true, removed: result.removed, total: result.total };
});

ipcMain.handle('clear-all-configs', () => {
	configManager.clearConfigs();
	return { success: true };
});

// Запуск монитора после подключения
ipcMain.handle('connect', async (event, idOrConfigUrl) => {
  if (vpnProcess) vpnProcess.kill();
  if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);

  let configUrl = idOrConfigUrl;
  let server = null;

  // Если передан configUrl напрямую (начинается с протокола), используем его
  if (idOrConfigUrl.startsWith('vless://') || idOrConfigUrl.startsWith('vmess://') || 
      idOrConfigUrl.startsWith('trojan://') || idOrConfigUrl.startsWith('ss://')) {
    configUrl = idOrConfigUrl;
    // Строим сервер из configUrl
    const name = extractServerName(configUrl);
    const flag = extractFlag(configUrl);
    server = { name, flag, configUrl, speed: 'пользовательский' };
  } else {
    // Иначе ищем по id в списке серверов
    const servers = buildServersFromConfigs();
    server = servers[idOrConfigUrl];
    if (server && server.configUrl) {
      configUrl = server.configUrl;
    }
  }
  
  if (!server || !configUrl) {
    return { success: false, error: 'Сервер не найден' };
  }

  // Передаем конфиг напрямую в vpn.js
  const vpnJsPath = path.join(VPN_DIR, 'vpn.js');
  vpnProcess = spawn('node', [vpnJsPath, 'connect', configUrl], { cwd: VPN_DIR, detached: true, stdio: 'ignore' });
  vpnProcess.unref();
  fs.writeFileSync(PID_FILE, vpnProcess.pid.toString());

  setNativeProxy(true);
  await setElectronProxy(true);

  startSpeedMonitor(sendSpeedUpdate);
  return { success: true, server: server };
});
