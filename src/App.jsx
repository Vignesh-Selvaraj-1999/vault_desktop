import { useEffect, useState } from 'react';
import LoginScreen from './screens/LoginScreen.jsx';
import TrackerScreen from './screens/TrackerScreen.jsx';

export default function App() {
  const [session, setSession] = useState(null); // null while loading

  useEffect(() => {
    window.vault.getSession().then(setSession);
    return window.vault.onAuthChanged(setSession);
  }, []);

  if (!session) return <div className="screen center muted">Loading…</div>;
  return session.loggedIn ? <TrackerScreen user={session.user} /> : <LoginScreen />;
}
