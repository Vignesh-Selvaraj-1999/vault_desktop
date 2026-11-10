// Central app configuration.
// Override the backend with the VAULT_BASE_URL environment variable.
const BASE_URL = (process.env.VAULT_BASE_URL || 'https://api-dev-v3.vaultsynapse.com').replace(/\/+$/, '');

module.exports = {
  BASE_URL,
  API: {
    PREFIX: '/mobile/v1/',
    // Public: branding and the login providers enabled for the organization.
    SETTINGS_PATH: 'Organization/GetSetting',
    // POST LoginModel { username, password, token, provider, device... }.
    LOGIN_PATH: 'Account/Login',
  },
  // Login provider ids, as used by the Vault API and the mobile app.
  PROVIDERS: {
    EMAIL: 6, // email + password
    MICROSOFT: 7, // Microsoft Entra ID; settings come from GetSetting
  },
  // Redirect URI for the Microsoft sign-in window. It must be registered on the Azure app
  // (Mobile and desktop applications platform). If unset, the one from GetSetting is used.
  MICROSOFT_REDIRECT_URI: process.env.VAULT_MS_REDIRECT_URI || null,
  // The API requires an FCM token. The desktop app has no push notifications, so it sends a placeholder.
  FCM_TOKEN_PLACEHOLDER: 'desktop-no-fcm',
  WINDOW: { width: 360, height: 480 },
};
