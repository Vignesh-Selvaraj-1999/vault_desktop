// Stores the signed-in session on disk, encrypted with the macOS Keychain via safeStorage.
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const sessionFile = () => path.join(app.getPath('userData'), 'session.bin');

function saveSession(session) {
  const json = JSON.stringify(session);
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8');
  fs.writeFileSync(sessionFile(), data, { mode: 0o600 });
}

function loadSession() {
  try {
    const data = fs.readFileSync(sessionFile());
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(data)
      : data.toString('utf8');
    const session = JSON.parse(json);
    return session && session.token ? session : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    fs.unlinkSync(sessionFile());
  } catch {
    // already signed out
  }
}

module.exports = { saveSession, loadSession, clearSession };
