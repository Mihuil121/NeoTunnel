let currentPid = null;

const servers = [
  {id: 2, name: "ОАЭ Reality (самый быстрый)", flag: "UAE"},
  {id: 18, name: "Канада Reality Yahoo (стабильный)", flag: "Canada"},
  {id: 3, name: "Армения Reality (низкий пинг)", flag: "Armenia"},
  {id: 8, name: "Бельгия Reality Safari", flag: "Belgium"},
  {id: 9, name: "Бельгия Reality Chrome", flag: "Belgium"},
  {id: 5, name: "Австралия Reality", flag: "Australia"},
  {id: 19, name: "Канада Reality Apple", flag: "Canada"},
  {id: 20, name: "Канада Reality Microsoft", flag: "Canada"},
  {id: 15, name: "Канада no-ra", flag: "Canada"},
  {id: 0, name: "[xk] vl-no-ra", flag: "Unknown"},
  {id: 1, name: "VMess raw", flag: "VM"},
  {id: 4, name: "VMess raw", flag: "VM"},
  {id: 6, name: "VMess TLS WS", flag: "WS"},
  {id: 7, name: "VMess TLS WS", flag: "WS"},
  {id: 10, name: "VMess WS Бразилия", flag: "Brazil"},
  {id: 11, name: "VMess WS Бразилия", flag: "Brazil"},
  {id: 12, name: "VMess WS Google", flag: "Brazil"},
  {id: 13, name: "VMess WS Бразилия", flag: "Brazil"},
  {id: 14, name: "VMess WS Бразилия", flag: "Brazil"},
  {id: 16, name: "Канада no-ra", flag: "Canada"},
  {id: 17, name: "Канада no-ws", flag: "Canada"},
  {id: 21, name: "VMess WS Канада", flag: "Canada"}
];

async function init() {
  const select = document.getElementById('server');
  servers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.flag} ${s.name}`;
    select.appendChild(opt);
  });
}

async function connect() {
  const idx = document.getElementById('server').value;
  const status = document.getElementById('status');
  status.textContent = 'Запуск...';

  // Останавливаем старый процесс
  if (currentPid) {
    await Neutralino.os.runCommand(`kill ${currentPid}`);
    currentPid = null;
  }

  // Запускаем твой vpn.js
  const vpnPath = '/home/misha/Документы/vpn';
  const { pid } = await Neutralino.os.spawnProcess('bash', {
    args: ['-c', `cd "${vpnPath}" && node vpn.js ${idx}`]
  });

  currentPid = pid;
  status.textContent = `Подключено! ${servers.find(s => s.id == idx).flag} ${servers.find(s => s.id == idx).name}`;

  // Включаем системный прокси
  await Neutralino.os.runCommand('gsettings set org.gnome.system.proxy mode manual');
  await Neutralino.os.runCommand('gsettings set org.gnome.system.proxy.socks host 127.0.0.1');
  await Neutralino.os.runCommand('gsettings set org.gnome.system.proxy.socks port 1080');
}

async function disconnect() {
  if (currentPid) {
    await Neutralino.os.runCommand(`kill ${currentPid}`);
    currentPid = null;
  }
  await Neutralino.os.runCommand('gsettings set org.gnome.system.proxy mode none');
  document.getElementById('status').textContent = 'Отключено';
}

init();
