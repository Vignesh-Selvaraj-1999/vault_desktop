// Calls to the Vault backend, made from the main process (no CORS, token never touches the UI).
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const config = require('./config');

class ApiError extends Error {}

// Stable per-install id, sent as the device token (the mobile app sends its UDID).
function deviceId() {
  const file = path.join(app.getPath('userData'), 'device-id');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const id = crypto.randomUUID();
    fs.writeFileSync(file, id);
    return id;
  }
}

// Turns the API's { message, errors: { field: [msg] } } shape into one readable message.
function errorMessage(body, status) {
  if (body && body.errors && typeof body.errors === 'object') {
    const msgs = Object.values(body.errors).flat().filter(Boolean);
    if (msgs.length) return msgs.join('\n');
  }
  if (body && body.message) return body.message;
  return `Request failed (HTTP ${status})`;
}

async function request(pathname, options = {}) {
  let res;
  try {
    res = await fetch(config.BASE_URL + config.API.PREFIX + pathname, {
      ...options,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError('Cannot reach Vault. Check your internet connection.');
  }
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw new ApiError(errorMessage(body, res.status));
  return body;
}

function getSettings() {
  return request(config.API.SETTINGS_PATH);
}

function login({ provider, username = '', password = '', token = null }) {
  return request(config.API.LOGIN_PATH, {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      token,
      provider,
      deviceName: os.hostname(),
      deviceToken: deviceId(),
      OSName: `macOS ${os.release()}`,
      deviceLatitude: null,
      deviceLongitude: null,
      location: null,
      fcmToken: config.FCM_TOKEN_PLACEHOLDER,
    }),
  });
}

// The success response shape is not documented yet, so look for the token in the usual places.
function extractAuth(body) {
  const data = (body && (body.data || body.result)) || body || {};
  const token = data.accessToken || data.token || data.jwtToken || data.access_token || null;
  const user = data.user || data;
  const name =
    user.fullName || user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
  return {
    token,
    refreshToken: data.refreshToken || null,
    user: { name, email: user.email || user.userName || user.username || null },
  };
}

module.exports = { getSettings, login, extractAuth, ApiError };
