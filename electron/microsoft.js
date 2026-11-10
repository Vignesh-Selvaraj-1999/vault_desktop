// Microsoft Entra ID sign-in (authorization code + PKCE) in a dedicated window.
// The window never loads the redirect URI: we catch the redirect and read the code from it,
// so a custom scheme works without registering it with macOS.
const crypto = require('crypto');
const { BrowserWindow } = require('electron');

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function signInWithMicrosoft({ authority, clientId, scope, redirectUri }) {
  const base = `https://login.microsoftonline.com/${authority}/oauth2/v2.0`;
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  const scopes = `${scope} openid profile offline_access`;

  const authorizeUrl = new URL(`${base}/authorize`);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();

  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 480,
      height: 640,
      title: 'Sign in with Microsoft',
      alwaysOnTop: true,
      autoHideMenuBar: true,
      webPreferences: { partition: 'msal', contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    let done = false;

    const finish = (err, result) => {
      if (done) return;
      done = true;
      if (!win.isDestroyed()) win.close();
      err ? reject(err) : resolve(result);
    };

    const handleUrl = async (event, url) => {
      if (!url.startsWith(redirectUri)) return;
      event.preventDefault();
      const params = new URL(url).searchParams;
      if (params.get('error')) {
        return finish(new Error(params.get('error_description') || params.get('error')));
      }
      if (params.get('state') !== state || !params.get('code')) {
        return finish(new Error('Microsoft sign-in returned an unexpected response.'));
      }
      try {
        const res = await fetch(`${base}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code: params.get('code'),
            redirect_uri: redirectUri,
            code_verifier: verifier,
            scope: scopes,
          }),
        });
        const body = await res.json();
        if (!res.ok || !body.access_token) {
          throw new Error(body.error_description || body.error || 'Microsoft token request failed.');
        }
        finish(null, { accessToken: body.access_token, idToken: body.id_token || null });
      } catch (e) {
        finish(e);
      }
    };

    win.webContents.on('will-redirect', handleUrl);
    win.webContents.on('will-navigate', handleUrl);
    win.on('closed', () => finish(new Error('cancelled')));
    win.loadURL(authorizeUrl.toString());
  });
}

module.exports = { signInWithMicrosoft };
