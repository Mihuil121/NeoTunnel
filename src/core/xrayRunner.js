const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function resolveXrayPath(baseDir) {
	const winPath = path.join(baseDir, 'xray.exe');
	const unixPath = path.join(baseDir, 'xray');
	if (process.platform === 'win32') {
		if (fs.existsSync(winPath)) return winPath;
		return 'xray.exe';
	} else {
		if (fs.existsSync(unixPath)) {
			try { fs.chmodSync(unixPath, 0o755); } catch(e) {}
			return unixPath;
		}
		return 'xray';
	}
}

function runXray(outbound, baseDir) {
	const config = require('./parsers').generateConfig(outbound);
	const configPath = path.join(os.tmpdir(), `xray-config-${Date.now()}.json`);
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

	const xrayBin = resolveXrayPath(baseDir);
	const child = spawn(xrayBin, ['run', '-c', configPath], {
		cwd: baseDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false
	});
	return { child, configPath };
}

module.exports = { resolveXrayPath, runXray };


