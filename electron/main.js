const path = require('path');
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, screen } = require('electron');
const config = require('./config');
const { saveSession, loadSession, clearSession } = require('./session');
const api = require('./api');
const { signInWithMicrosoft } = require('./microsoft');

let tray = null;
let win = null;
let lastHiddenAt = 0;
let orgSettings = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function publicSession() {
  const s = loadSession();
  return s ? { loggedIn: true, user: s.user || null } : { loggedIn: false, user: null };
}

function notifyAuthChanged() {
  if (win && !win.isDestroyed()) win.webContents.send('auth:changed', publicSession());
}

async function loadOrgSettings() {
  if (!orgSettings) orgSettings = await api.getSettings();
  return orgSettings;
}

// Sends the credentials to Vault and stores the session. Returns { ok } or { ok: false, error }.
async function completeLogin(loginArgs) {
  const body = await api.login(loginArgs);
  const auth = api.extractAuth(body);
  if (!auth.token) {
    console.warn('Login succeeded but no token was found in the response:', body);
    throw new Error('Vault accepted the login but returned no token.');
  }
  saveSession({ ...auth, provider: loginArgs.provider });
  notifyAuthChanged();
  showWindow();
  return { ok: true };
}

const asResult = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};

function createWindow() {
  win = new BrowserWindow({
    width: config.WINDOW.width,
    height: config.WINDOW.height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // keep the running timer ticking while hidden
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Behave like a menu bar popover: hide when focus moves elsewhere.
  win.on('blur', () => {
    if (win.webContents.isDevToolsOpened()) return;
    win.hide();
    lastHiddenAt = Date.now();
  });

  // Open external links in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function positionWindowUnderTray() {
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const { workArea } = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - winBounds.width - 8));
  win.setPosition(x, y, false);
}

function showWindow() {
  if (!win) return;
  positionWindowUnderTray();
  win.show();
  win.focus();
}

function toggleWindow() {
  // Clicking the tray icon blurs (and hides) the window first; don't immediately reopen it.
  if (Date.now() - lastHiddenAt < 250) return;
  if (win.isVisible()) win.hide();
  else showWindow();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'trayIconTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Vault Time Tracker');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Time Tracker', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]);

  tray.on('click', toggleWindow);
  tray.on('right-click', () => tray.popUpContextMenu(contextMenu));
}

// ---- IPC: the only things the UI can ask the main process to do ----
ipcMain.handle('auth:get-session', () => publicSession());

// Branding and enabled login methods for the login screen.
ipcMain.handle(
  'auth:get-settings',
  asResult(async () => {
    const s = await loadOrgSettings();
    const providers = s.loginProviders || [];
    return {
      ok: true,
      title: s.applicationTitle || 'Vault',
      logoUrl: s.logoUrl || null,
      email: providers.includes(config.PROVIDERS.EMAIL),
      microsoft: providers.includes(config.PROVIDERS.MICROSOFT),
    };
  }),
);

ipcMain.handle(
  'auth:login-email',
  asResult(async (_event, { email, password } = {}) => {
    if (!email || !password) throw new Error('Enter your email and password.');
    return completeLogin({ provider: config.PROVIDERS.EMAIL, username: email.trim(), password });
  }),
);

ipcMain.handle(
  'auth:login-microsoft',
  asResult(async () => {
    const s = await loadOrgSettings();
    const ms = (s.loginProviderSettings || []).find((p) => p.provider === config.PROVIDERS.MICROSOFT);
    if (!ms || !ms.clientId || !ms.authority) throw new Error('Microsoft sign-in is not set up for this organization.');
    let result;
    try {
      result = await signInWithMicrosoft({
        authority: ms.authority,
        clientId: ms.clientId,
        scope: ms.scope,
        redirectUri: config.MICROSOFT_REDIRECT_URI || ms.redirectUrl,
      });
    } catch (e) {
      if (e.message === 'cancelled') return { ok: false, cancelled: true };
      throw e;
    }
    return completeLogin({ provider: config.PROVIDERS.MICROSOFT, token: result.accessToken });
  }),
);

ipcMain.handle('auth:logout', () => {
  clearSession();
  notifyAuthChanged();
});

// Development only: lets you see the tracker before the real login exists.
ipcMain.handle('auth:dev-login', () => {
  if (app.isPackaged) return;
  saveSession({ token: 'dev-token', user: { name: 'Dev User', email: 'dev@example.com' } });
  notifyAuthChanged();
});

ipcMain.handle('app:is-dev', () => !app.isPackaged);

// Shows elapsed time next to the menu bar icon while a timer runs (like the battery %).
ipcMain.on('tray:set-title', (_event, title) => {
  if (tray) tray.setTitle(typeof title === 'string' ? title : '');
});

ipcMain.handle('app:quit', () => app.quit());

app.whenReady().then(() => {
  if (app.dock) app.dock.hide(); // menu bar only, no Dock icon
  createWindow();
  createTray();
});

// Keep running in the menu bar when the window is closed.
app.on('window-all-closed', () => {});
