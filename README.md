# vault_desktop

Vault Time Tracker is a macOS menu bar app built with Electron and React (Vite). Its clock icon sits in the menu bar next to Wi-Fi and battery. Clicking the icon opens a small window:

- **Signed out:** a login screen showing the organization's logo and the login methods it has enabled: email and password, and/or **Sign in with Microsoft**.
- **Signed in:** the time tracker. You can start and stop a timer for a task and see today's entries. While a timer runs, the elapsed time shows next to the menu bar icon.

Right-click the icon to quit.

## Getting started

```bash
npm install
npm run dev     # Vite dev server + Electron, with hot reload for the UI
npm start       # production build of the UI, then Electron
```

In development, the login screen also offers **Skip login (development only)**, so you can open the tracker before the backend login exists. Packaged builds hide this option.

## Configuration

Settings live in [electron/config.js](electron/config.js).

| Setting | Purpose |
| --- | --- |
| `BASE_URL` | Vault API. Defaults to `https://api-dev-v3.vaultsynapse.com`; override with `VAULT_BASE_URL`. |
| `PROVIDERS` | Login provider ids: `6` = email and password, `7` = Microsoft. |
| `MICROSOFT_REDIRECT_URI` | Redirect URI for Microsoft sign-in. Defaults to the one returned by `GetSetting`; override with `VAULT_MS_REDIRECT_URI`. |

### How login works

1. On the login screen the app calls `GET /mobile/v1/Organization/GetSetting` for the title, logo, and enabled providers.
2. **Email and password:** the app sends `POST /mobile/v1/Account/Login` with `provider: 6`, `username`, and `password`.
3. **Microsoft:** the app opens a Microsoft sign-in window (authorization code with PKCE) using the tenant, client id, and scope from `GetSetting`, then sends the Microsoft access token to `POST /mobile/v1/Account/Login` with `provider: 7`.
4. Both requests include device details (`deviceName`, `deviceToken`, `OSName`) and a placeholder `fcmToken`, which the API requires.
5. The returned Vault token is stored encrypted with the macOS Keychain (Electron `safeStorage`).

## Project structure

```
electron/
  main.js       menu bar icon, popover window, login, IPC
  api.js        Vault API calls (settings, login)
  microsoft.js  Microsoft sign-in window (PKCE)
  preload.js    the small API the UI can use (window.vault)
  session.js    encrypted session storage
  config.js     base URL and login settings
src/
  App.jsx                    shows the login screen or the tracker depending on the session
  screens/LoginScreen.jsx
  screens/TrackerScreen.jsx  timer and today's entries (stored locally for now)
scripts/
  generate-icons.js   draws the menu bar clock icon (npm run icons)
  launch-electron.js  starts Electron, including from VS Code's terminal
assets/               menu bar icon (template PNGs)
```

## Notes

- Time entries are stored locally for now. They will move to the Vault API once the base URL and data models are defined.
- Electron is pinned to v33 because newer versions need Node 22.12 or later to install.
- In development, macOS may not route `vaultdesktop://` links to the dev app reliably. The login callback is most reliable in a packaged build.
