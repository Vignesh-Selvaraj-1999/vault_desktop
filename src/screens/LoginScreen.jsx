import { useEffect, useState } from 'react';

export default function LoginScreen() {
  const [settings, setSettings] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(null); // 'email' | 'microsoft' | null
  const [error, setError] = useState('');
  const [isDev, setIsDev] = useState(false);

  function loadSettings() {
    setError('');
    window.vault.getLoginSettings().then((s) => {
      if (s.ok) setSettings(s);
      else setError(s.error);
    });
  }

  useEffect(() => {
    window.vault.isDev().then(setIsDev);
    loadSettings();
  }, []);

  async function run(kind, call) {
    setBusy(kind);
    setError('');
    const result = await call();
    setBusy(null);
    if (!result.ok && !result.cancelled) setError(result.error);
  }

  function submitEmail(e) {
    e.preventDefault();
    run('email', () => window.vault.loginWithEmail(email, password));
  }

  const title = settings?.title || 'Vault';

  return (
    <div className="screen center">
      {settings?.logoUrl ? (
        <img className="org-logo" src={settings.logoUrl} alt="" />
      ) : (
        <div className="logo" aria-hidden="true">◷</div>
      )}
      <h1>{title} Time Tracker</h1>

      {!settings && !error && <p className="muted">Loading…</p>}

      {settings?.email && (
        <form className="login-form" onSubmit={submitEmail}>
          <input
            className="task-input"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!busy}
            autoFocus
          />
          <input
            className="task-input"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!!busy}
          />
          <button className="primary" type="submit" disabled={!!busy || !email || !password}>
            {busy === 'email' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}

      {settings?.email && settings?.microsoft && <div className="divider muted small">or</div>}

      {settings?.microsoft && (
        <button
          className="secondary"
          onClick={() => run('microsoft', window.vault.loginWithMicrosoft)}
          disabled={!!busy}
        >
          {busy === 'microsoft' ? 'Waiting for Microsoft…' : 'Sign in with Microsoft'}
        </button>
      )}

      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
      {error && !settings && (
        <button className="link small" onClick={loadSettings}>
          Try again
        </button>
      )}

      {isDev && (
        <button className="link small" onClick={() => window.vault.devLogin()}>
          Skip login (development only)
        </button>
      )}

      <button className="link small footer" onClick={() => window.vault.quit()}>
        Quit
      </button>
    </div>
  );
}
