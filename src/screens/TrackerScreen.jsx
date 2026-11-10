import { useEffect, useMemo, useState } from 'react';

// Local storage for now; to be replaced by the Vault API once the base URL and models are defined.
const ENTRIES_KEY = 'vault.entries';
const RUNNING_KEY = 'vault.running';

const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

function formatDuration(ms, withSeconds = true) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${h}h ${pad(m)}m`;
}

const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();

export default function TrackerScreen({ user }) {
  const [entries, setEntries] = useState(() => load(ENTRIES_KEY, []));
  const [running, setRunning] = useState(() => load(RUNNING_KEY, null)); // { task, startedAt }
  const [task, setTask] = useState(running?.task ?? '');
  const [now, setNow] = useState(Date.now());

  useEffect(() => localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries)), [entries]);
  useEffect(() => localStorage.setItem(RUNNING_KEY, JSON.stringify(running)), [running]);

  // Tick every second while running and mirror the time next to the menu bar icon.
  useEffect(() => {
    if (!running) {
      window.vault.setTrayTitle('');
      return undefined;
    }
    const update = () => {
      const t = Date.now();
      setNow(t);
      window.vault.setTrayTitle(formatDuration(t - running.startedAt));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [running]);

  function start() {
    setRunning({ task: task.trim() || 'Untitled task', startedAt: Date.now() });
  }

  function stop() {
    const endedAt = Date.now();
    setEntries((prev) => [
      { id: crypto.randomUUID(), task: running.task, startedAt: running.startedAt, endedAt },
      ...prev,
    ]);
    setRunning(null);
    setTask('');
  }

  const todayEntries = useMemo(() => entries.filter((e) => isToday(e.startedAt)), [entries]);
  const todayTotal =
    todayEntries.reduce((sum, e) => sum + (e.endedAt - e.startedAt), 0) +
    (running ? now - running.startedAt : 0);

  return (
    <div className="screen">
      <header className="header">
        <div>
          <div className="title">{user?.name || 'Signed in'}</div>
          {user?.email && <div className="muted small">{user.email}</div>}
        </div>
        <button className="link small" onClick={() => window.vault.logout()}>
          Sign out
        </button>
      </header>

      <section className="timer">
        <input
          className="task-input"
          placeholder="What are you working on?"
          value={running ? running.task : task}
          disabled={!!running}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !running && start()}
        />
        <div className="clock">{formatDuration(running ? now - running.startedAt : 0)}</div>
        {running ? (
          <button className="danger" onClick={stop}>Stop</button>
        ) : (
          <button className="primary" onClick={start}>Start</button>
        )}
      </section>

      <section className="entries">
        <div className="entries-header">
          <span>Today</span>
          <span>{formatDuration(todayTotal, false)}</span>
        </div>
        {todayEntries.length === 0 ? (
          <p className="muted small">No time tracked today.</p>
        ) : (
          <ul>
            {todayEntries.map((e) => (
              <li key={e.id}>
                <span className="entry-task">{e.task}</span>
                <span className="muted">{formatDuration(e.endedAt - e.startedAt, false)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="footer-bar">
        <button className="link small" onClick={() => window.vault.quit()}>Quit</button>
      </footer>
    </div>
  );
}
