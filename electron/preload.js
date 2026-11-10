// Exposes a small, explicit API to the React UI as window.vault.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vault', {
  getSession: () => ipcRenderer.invoke('auth:get-session'),
  getLoginSettings: () => ipcRenderer.invoke('auth:get-settings'),
  loginWithEmail: (email, password) => ipcRenderer.invoke('auth:login-email', { email, password }),
  loginWithMicrosoft: () => ipcRenderer.invoke('auth:login-microsoft'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  devLogin: () => ipcRenderer.invoke('auth:dev-login'),
  isDev: () => ipcRenderer.invoke('app:is-dev'),
  quit: () => ipcRenderer.invoke('app:quit'),
  setTrayTitle: (title) => ipcRenderer.send('tray:set-title', title),
  onAuthChanged: (callback) => {
    const listener = (_event, session) => callback(session);
    ipcRenderer.on('auth:changed', listener);
    return () => ipcRenderer.removeListener('auth:changed', listener);
  },
});
