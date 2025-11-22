const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vpn', {
  getServers: () => ipcRenderer.invoke('get-servers'),
  getPinned: () => ipcRenderer.invoke('get-pinned'),
  pinServer: (id) => ipcRenderer.invoke('pin-server', id),
  connect: (id) => ipcRenderer.invoke('connect', id),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  openWhoer: () => ipcRenderer.invoke('open-whoer'),
  getClipboard: () => ipcRenderer.invoke('get-clipboard'),
  addConfig: (configUrl) => ipcRenderer.invoke('add-config', configUrl),
  addConfigsFromText: (text, testConfigs) => ipcRenderer.invoke('add-configs-from-text', text, testConfigs),
  removeConfig: (configUrl) => ipcRenderer.invoke('remove-config', configUrl),
  validateConfig: (configUrl) => ipcRenderer.invoke('validate-config', configUrl),
  loadConfigsFromUrl: (url, testConfigs) => ipcRenderer.invoke('load-configs-from-url', url, testConfigs),
  getSubscriptions: () => ipcRenderer.invoke('get-subscriptions'),
  addSubscription: (url) => ipcRenderer.invoke('add-subscription', url),
  removeSubscription: (url) => ipcRenderer.invoke('remove-subscription', url),
  updateAllSubscriptions: (testConfigs) => ipcRenderer.invoke('update-all-subscriptions', testConfigs),
  testConfig: (configUrl) => ipcRenderer.invoke('test-config', configUrl),
  testAllConfigs: () => ipcRenderer.invoke('test-all-configs'),
  testBlockedSites: () => ipcRenderer.invoke('test-blocked-sites'),
  removeDuplicates: () => ipcRenderer.invoke('remove-duplicates'),
  clearAllConfigs: () => ipcRenderer.invoke('clear-all-configs'),
  getServers: (testConfigs) => ipcRenderer.invoke('get-servers', testConfigs),
  onSpeedUpdate: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('speed', listener);
    return () => ipcRenderer.off('speed', listener);
  }
});

