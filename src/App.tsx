import { useState, createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---- Types ----
interface Participant { id: number; name: string; }
interface Trip { id: number; name: string; date: string; location: string; discipline: string; }
interface Result {
  id: number; participant_id: number; trip_id: number;
  weight: number; attended: number; is_biggest: number; tackle: string;
  participant_name?: string; trip_name?: string; trip_date?: string; trip_location?: string;
}
interface Achievement {
  id: number; participant_id: number; category: string; year: number; name: string;
  participant_name?: string;
}
interface BigFish {
  id: number; participant_id: number; fish: string; weight: number;
  season: number; date: string; location: string; tackle: string;
  participant_name?: string;
}
interface RatingEntry {
  participant: Participant;
  intermediate: number;
  place: number;
  tripsWithScore: number;
  achievementsCount: number;
  achievements: Achievement[];
  results: Result[];
}

// ---- API helpers ----
const BASE = '';
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(BASE + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res;
}
async function apiGet<T>(path: string): Promise<T> {
  return (await apiFetch(path)).json();
}
async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  return (await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
    body: JSON.stringify(body),
  })).json();
}
async function apiDelete(path: string, token: string) {
  return apiFetch(path, { method: 'DELETE', headers: { 'x-admin-token': token } });
}

// ---- Auth context ----
const AuthCtx = createContext<{ token: string | null; login: (p: string) => Promise<boolean>; logout: () => void; }>(
  { token: null, login: async () => false, logout: () => {} }
);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const login = async (password: string) => {
    try {
      const data = await apiPost<{ ok: boolean; token: string }>('/api/admin/login', { password });
      if (data.ok && data.token) { setToken(data.token); return true; }
    } catch { /* noop */ }
    return false;
  };
  const logout = () => setToken(null);
  return <AuthCtx.Provider value={{ token, login, logout }}>{children}</AuthCtx.Provider>;
}

// ---- Category labels & icons ----
const CATEGORIES: Record<string, { label: string; icon: string }> = {
  'Крупненькая': { label: 'Крупненькая', icon: '🐟' },
  'Вид ловли': { label: 'Вид ловли', icon: '🎣' },
  'Навык': { label: 'Зачёт по навыкам', icon: '📘' },
  'Наука': { label: 'Наука и наставничество', icon: '🔬' },
  'Джимкастинг': { label: 'Джимкастинг', icon: '🎯' },
};

function formatWeight(g: number) {
  if (g >= 1000) return `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 2)} кг`;
  return `${g} г`;
}
function formatDate(s: string) {
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ---- Views ----
type View = 'rating' | 'bigfish' | 'policy' | 'admin' | { type: 'participant'; id: number };

// ---- Main App ----
export default function App() {
  const [view, setView] = useState<View>('rating');
  return (
    <AuthProvider>
      <Header view={view} setView={setView} />
      <main>
        {view === 'rating' && <RatingPage setView={setView} />}
        {view === 'bigfish' && <BigfishPage />}
        {view === 'policy' && <PolicyPage />}
        {view === 'admin' && <AdminPage />}
        {typeof view === 'object' && view.type === 'participant' && (
          <ParticipantPage id={view.id} setView={setView} />
        )}
      </main>
    </AuthProvider>
  );
}

// ---- Header ----
function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const { token, logout } = useAuth();
  const isActive = (v: View) => JSON.stringify(view) === JSON.stringify(v);
  return (
    <header className="header">
      <div className="header-inner">
        <a className="logo" onClick={() => setView('rating')} style={{ cursor: 'pointer' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="14" fill="#2d6a2d" />
            <text x="14" y="19" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">🎣</text>
          </svg>
          Подсекай!
        </a>
        <nav className="nav">
          <button className={`nav-btn ${isActive('rating') ? 'active' : ''}`} onClick={() => setView('rating')}>Рейтинг</button>
          <button className={`nav-btn ${isActive('bigfish') ? 'active' : ''}`} onClick={() => setView('bigfish')}>Крупненькие</button>
          <button className={`nav-btn ${isActive('policy') ? 'active' : ''}`} onClick={() => setView('policy')}>Положение</button>
          {token
            ? <>
                <button className={`nav-btn ${isActive('admin') ? 'active' : ''}`} onClick={() => setView('admin')}>Админ</button>
                <button className="nav-btn" onClick={logout}>Выйти</button>
              </>
            : <button className={`nav-btn ${isActive('admin') ? 'active' : ''}`} onClick={() => setView('admin')}>Войти</button>
          }
        </nav>
      </div>
    </header>
  );
}

// ---- Rating Page ----
function RatingPage({ setView }: { setView: (v: View) => void }) {
  const { data: rating = [], isLoading } = useQuery({ queryKey: ['/api/rating'], queryFn: () => apiGet<RatingEntry[]>('/api/rating') });
  const { data: trips = [] } = useQuery({ queryKey: ['/api/trips'], queryFn: () => apiGet<Trip[]>('/api/trips') });
  if (isLoading) return <div className="loading">Загрузка...</div>;
  return (
    <div className="container page">
      <h1 className="page-title">Рейтинг клуба «Подсекай!»</h1>
      <p className="page-subtitle">Клубный год начинается со второго воскресенья сентября. Рейтинг обновляется в реальном времени.</p>
      {rating.length === 0
        ? <div className="empty"><p>Пока нет данных рейтинга. Добавьте участников и выезды в разделе <b>Админ</b>.</p></div>
        : <div className="table-wrap">
            <table className="rating-table">
              <thead><tr>
                <th>Место</th><th>Участник</th>
                <th className="hide-mobile">Выездов</th>
                <th className="hide-mobile">Личн. дост.</th>
                <th>Баллы</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rating.map(e => (
                  <tr key={e.participant.id} className={e.place <= 3 ? `rank-${e.place}` : ''}>
                    <td><span className={`place-badge place-${e.place <= 3 ? e.place : 'n'}`}>{e.place}</span></td>
                    <td><span className="participant-link" onClick={() => setView({ type: 'participant', id: e.participant.id })}>{e.participant.name}</span></td>
                    <td className="hide-mobile">{e.tripsWithScore}</td>
                    <td className="hide-mobile">{e.achievementsCount}</td>
                    <td><span className="score-big">{e.intermediate}</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setView({ type: 'participant', id: e.participant.id })}>→</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
      {trips.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontWeight: 800, marginBottom: 12, fontSize: '1rem' }}>Выезды сезона ({trips.length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {trips.map(t => (
              <span key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: '0.8rem' }}>
                {t.discipline === 'casting' ? '🎯' : '🎣'} {t.name} — {formatDate(t.date)}{t.location ? ` · ${t.location}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Participant Page ----
function ParticipantPage({ id, setView }: { id: number; setView: (v: View) => void }) {
  const { data: rating = [] } = useQuery({ queryKey: ['/api/rating'], queryFn: () => apiGet<RatingEntry[]>('/api/rating') });
  const { data: results = [] } = useQuery({ queryKey: ['/api/results'], queryFn: () => apiGet<Result[]>('/api/results') });
  const { data: trips = [] } = useQuery({ queryKey: ['/api/trips'], queryFn: () => apiGet<Trip[]>('/api/trips') });

  const entry = rating.find(e => e.participant.id === id);
  if (!entry) return <div className="container page"><div className="loading">Загрузка...</div></div>;

  const myResults = results.filter(r => r.participant_id === id && r.attended);
  const tripMap = Object.fromEntries(trips.map(t => [t.id, t]));

  const achGroups = Object.entries(CATEGORIES).map(([key, info]) => ({
    key, ...info,
    items: entry.achievements.filter(a => a.category === key)
  })).filter(g => g.items.length > 0);

  return (
    <div className="container page">
      <span className="back-link" onClick={() => setView('rating')}>← К рейтингу</span>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="participant-card-header">
          <div className="participant-avatar">{initials(entry.participant.name)}</div>
          <div className="participant-card-info">
            <h2>{entry.participant.name}</h2>
            <div className="place-text">{entry.place} место · итоговый рейтинг</div>
            <div className="score-text">{entry.intermediate}</div>
          </div>
        </div>
        <div className="card-body">
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-val">{entry.place}</div><div className="stat-label">Место в клубе</div></div>
            <div className="stat-card"><div className="stat-val">{entry.tripsWithScore}</div><div className="stat-label">Выездов с баллами</div></div>
            <div className="stat-card"><div className="stat-val">{entry.achievementsCount}</div><div className="stat-label">Личные достижения</div></div>
            <div className="stat-card"><div className="stat-val">{entry.intermediate}</div><div className="stat-label">Промежуточный балл</div></div>
          </div>
          {achGroups.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Значки и достижения</h3>
              <div className="badges">
                {achGroups.map(g => g.items.map(a => (
                  <span key={a.id} className="badge">{g.icon} {a.name}</span>
                )))}
              </div>
            </div>
          )}
          {myResults.length > 0 && (
            <div>
              <h3 style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Результаты по выездам</h3>
              <div className="table-wrap">
                <table className="trips-table">
                  <thead><tr><th>Выезд</th><th>Водоём</th><th>Вес</th><th>Снасть</th></tr></thead>
                  <tbody>
                    {myResults.map(r => {
                      const t = tripMap[r.trip_id];
                      return (
                        <tr key={r.id}>
                          <td>{r.trip_name || t?.name || ''}</td>
                          <td>{r.trip_location || t?.location || '—'}</td>
                          <td>{r.weight ? formatWeight(r.weight) : '—'}{r.is_biggest ? ' 🏆' : ''}</td>
                          <td>{r.tackle || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Bigfish Page ----
function BigfishPage() {
  const { data: bigfish = [], isLoading } = useQuery({ queryKey: ['/api/bigfish'], queryFn: () => apiGet<BigFish[]>('/api/bigfish') });
  if (isLoading) return <div className="loading">Загрузка...</div>;

  // Группировка по виду рыбы
  const grouped: Record<string, { season: BigFish | null; record: BigFish | null }> = {};
  for (const bf of bigfish) {
    if (!grouped[bf.fish]) grouped[bf.fish] = { season: null, record: null };
    // Самый крупный за последний сезон
    const latest = bigfish.filter(b => b.fish === bf.fish).reduce((a, b) => b.season > a.season ? b : a, bf);
    const latestSeason = latest.season;
    const seasonBest = bigfish.filter(b => b.fish === bf.fish && b.season === latestSeason).reduce((a, b) => b.weight > a.weight ? b : a, bigfish.filter(b => b.fish === bf.fish && b.season === latestSeason)[0]);
    const allTimeBest = bigfish.filter(b => b.fish === bf.fish).reduce((a, b) => b.weight > a.weight ? b : a, bigfish.filter(b => b.fish === bf.fish)[0]);
    grouped[bf.fish] = { season: seasonBest || null, record: allTimeBest || null };
  }

  const entries = Object.entries(grouped);
  return (
    <div className="container page">
      <h1 className="page-title">Крупненькие клуба</h1>
      <p className="page-subtitle">Самый крупный экземпляр каждого вида рыбы. Крупненькая сезона приравнивается к личному достижению (+5 баллов), а рекорд клуба хранится за всё время.</p>
      {entries.length === 0
        ? <div className="empty"><p>Пока нет записей о крупненьких. Добавьте их в разделе <b>Админ</b>.</p></div>
        : <div className="bigfish-grid">
            {entries.map(([fish, { season, record }]) => (
              <div key={fish} className="bigfish-card">
                <div className="fish-name">🐟 {fish}</div>
                {season && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Крупненькая сезона {season.season}</div>
                    <div className="fish-weight">{formatWeight(season.weight)}</div>
                    <div className="fish-meta">{season.participant_name} · {formatDate(season.date)}{season.location ? ` · ${season.location}` : ''}{season.tackle ? ` · ${season.tackle}` : ''}</div>
                  </div>
                )}
                {record && record !== season && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Рекорд клуба</div>
                    <div className="fish-weight" style={{ color: 'var(--gold)' }}>{formatWeight(record.weight)}</div>
                    <div className="fish-meta">{record.participant_name} · {formatDate(record.date)}{record.location ? ` · ${record.location}` : ''}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ---- Policy Page ----
function PolicyPage() {
  return (
    <div className="container page">
      <h1 className="page-title">Положение о рейтинговой системе</h1>
      <p className="page-subtitle">Как формируется рейтинг рыболовного клуба «Подсекай!»</p>

      <div className="policy-box">Клубный год начинается со <b>второго воскресенья сентября</b>. Все результаты и достижения учитываются в рамках текущего года. Крупненькая сезона привязана к клубному году, рекорд клуба хранится за всё время.</div>

      <div className="policy-section">
        <h2>🏆 Итоговый рейтинг</h2>
        <p>Максимум <b>итоговых баллов</b>. Лидер сезона получает звание <b>«Лучший Подсекатор года»</b>.</p>
        <p>Итоговый рейтинг = промежуточный балл участника, нормированный к максимуму по клубу: рейтинг = балл / максимум. Данные обновляются в реальном времени.</p>
      </div>

      <div className="policy-section">
        <h2>🎣 Балл за выезд</h2>
        <p>Балл за выезд рассчитывается по <b>месту в турнирной таблице</b> (вес улова):</p>
        <ul>
          <li>Балл = (N − место + 1) / N × 10, где N — число участников на выезде</li>
          <li>Самая большая рыба или наибольший суммарный вес — отлично, +10 баллов</li>
          <li>Чем больше выездов — тем выше сумма; даже нулевой улов даёт положительные баллы за участие</li>
        </ul>
      </div>

      <div className="policy-section">
        <h2>🌟 Личные достижения</h2>
        <p>Каждое личное достижение (значок) даёт <b>+5 баллов</b>. Все категории равнозначны.</p>
        <h3 style={{ fontWeight: 700, margin: '12px 0 8px', fontSize: '0.9rem' }}>Шесть категорий личных достижений</h3>
        <ul>
          {Object.entries(CATEGORIES).map(([k, v]) => <li key={k}>{v.icon} <b>{v.label}</b></li>)}
        </ul>
      </div>
    </div>
  );
}

// ---- Admin Page ----
function AdminPage() {
  const { token, login, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [section, setSection] = useState<'results' | 'participants' | 'trips' | 'achievements' | 'bigfish'>('results');

  if (!token) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const ok = await login(password);
      if (!ok) setError('Неверный пароль');
    };
    return (
      <div className="container page">
        <div style={{ maxWidth: 320, margin: '0 auto' }}>
          <h1 className="page-title">Вход администратора</h1>
          <p className="page-subtitle">Заполнение рейтинга доступно только администратору клуба.</p>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Пароль</label>
              <input className="form-input" type="password" placeholder="Введите пароль" autoFocus value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.875rem' }}>{error}</p>}
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Войти</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Панель администратора</h1>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Выйти</button>
      </div>
      <div className="admin-layout">
        <nav className="admin-sidebar">
          {(['results', 'participants', 'trips', 'achievements', 'bigfish'] as const).map(s => (
            <button key={s} className={`admin-nav-btn ${section === s ? 'active' : ''}`} onClick={() => setSection(s)}>
              {{ results: 'Результаты', participants: 'Участники', trips: 'Выезды', achievements: 'Достижения', bigfish: 'Крупненькие' }[s]}
            </button>
          ))}
        </nav>
        <div>
          {section === 'participants' && <AdminParticipants token={token} />}
          {section === 'trips' && <AdminTrips token={token} />}
          {section === 'results' && <AdminResults token={token} />}
          {section === 'achievements' && <AdminAchievements token={token} />}
          {section === 'bigfish' && <AdminBigfish token={token} />}
        </div>
      </div>
    </div>
  );
}

// ---- Admin: Participants ----
function AdminParticipants({ token }: { token: string }) {
  const qc = useQueryClient();
  const { data: participants = [] } = useQuery({ queryKey: ['/api/participants'], queryFn: () => apiGet<Participant[]>('/api/participants') });
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');

  const add = useMutation({
    mutationFn: () => apiPost('/api/participants', { name }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/participants'] }); qc.invalidateQueries({ queryKey: ['/api/rating'] }); setName(''); setSaved('Участник добавлен'); setTimeout(() => setSaved(''), 2000); }
  });
  const del = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/participants/${id}`, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/participants'] }); qc.invalidateQueries({ queryKey: ['/api/rating'] }); setSaved('Участник удалён'); setTimeout(() => setSaved(''), 2000); }
  });

  return (
    <div>
      <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Участники</h2>
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) add.mutate(); }} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input className="form-input" placeholder="Фамилия Имя Отчество" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>Добавить</button>
      </form>
      {saved && <p className="saved">✓ {saved}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {participants.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600 }}>{p.name}</span>
            <button className="btn btn-danger btn-sm" onClick={() => del.mutate(p.id)}>Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Admin: Trips ----
function AdminTrips({ token }: { token: string }) {
  const qc = useQueryClient();
  const { data: trips = [] } = useQuery({ queryKey: ['/api/trips'], queryFn: () => apiGet<Trip[]>('/api/trips') });
  const [form, setForm] = useState({ name: '', date: '', location: '', discipline: 'fishing' });
  const [saved, setSaved] = useState('');

  const add = useMutation({
    mutationFn: () => apiPost('/api/trips', form, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/trips'] }); setForm({ name: '', date: '', location: '', discipline: 'fishing' }); setSaved('Выезд добавлен'); setTimeout(() => setSaved(''), 2000); }
  });
  const del = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/trips/${id}`, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/trips'] }); qc.invalidateQueries({ queryKey: ['/api/rating'] }); setSaved('Выезд удалён'); setTimeout(() => setSaved(''), 2000); }
  });

  return (
    <div>
      <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Выезды</h2>
      <form onSubmit={e => { e.preventDefault(); if (form.date) add.mutate(); }} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <input className="form-input" placeholder={`Название (напр. Выезд ${new Date().toLocaleDateString('ru')})`} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        <input className="form-input" placeholder="Водоём" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        <select className="form-input form-select" value={form.discipline} onChange={e => setForm(f => ({ ...f, discipline: e.target.value }))}>
          <option value="fishing">Ловля</option>
          <option value="casting">Джимкастинг</option>
        </select>
        <button className="btn btn-primary" type="submit" disabled={!form.date}>Добавить</button>
      </form>
      {saved && <p className="saved">✓ {saved}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trips.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{t.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>{formatDate(t.date)}{t.location ? ` · ${t.location}` : ''} · {t.discipline === 'casting' ? 'Джимкастинг' : 'Ловля'}</span>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => del.mutate(t.id)}>Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Admin: Results ----
function AdminResults({ token }: { token: string }) {
  const qc = useQueryClient();
  const { data: participants = [] } = useQuery({ queryKey: ['/api/participants'], queryFn: () => apiGet<Participant[]>('/api/participants') });
  const { data: trips = [] } = useQuery({ queryKey: ['/api/trips'], queryFn: () => apiGet<Trip[]>('/api/trips') });
  const { data: results = [] } = useQuery({ queryKey: ['/api/results'], queryFn: () => apiGet<Result[]>('/api/results') });
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [saved, setSaved] = useState('');

  const tripResults = selectedTrip ? results.filter(r => r.trip_id === selectedTrip) : [];

  const save = useMutation({
    mutationFn: (data: Partial<Result>) => apiPost('/api/results', data, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/results'] }); qc.invalidateQueries({ queryKey: ['/api/rating'] }); setSaved('Сохранено'); setTimeout(() => setSaved(''), 2000); }
  });
  const del = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/results/${id}`, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/results'] }); qc.invalidateQueries({ queryKey: ['/api/rating'] }); }
  });

  return (
    <div>
      <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Результаты</h2>
      <div className="form-group">
        <label className="form-label">Выберите выезд для ввода результатов</label>
        <select className="form-input form-select" value={selectedTrip || ''} onChange={e => setSelectedTrip(Number(e.target.value) || null)}>
          <option value="">— выезд —</option>
          {trips.map(t => <option key={t.id} value={t.id}>{t.name} ({formatDate(t.date)})</option>)}
        </select>
      </div>
      {saved && <p className="saved">✓ {saved}</p>}
      {selectedTrip && (
        <div className="table-wrap">
          <table className="trips-table">
            <thead><tr>
              <th>Участник</th><th>Вес, г</th><th>Крупненькая</th><th>Снасть</th><th>Явка</th><th></th>
            </tr></thead>
            <tbody>
              {participants.map(p => {
                const r = tripResults.find(r => r.participant_id === p.id);
                return (
                  <ResultRow key={p.id} participant={p} result={r} tripId={selectedTrip}
                    onSave={data => save.mutate({ participant_id: p.id, trip_id: selectedTrip, ...data })}
                    onDelete={r ? () => del.mutate(r.id) : undefined}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResultRow({ participant, result, tripId, onSave, onDelete }: {
  participant: Participant; result?: Result; tripId: number;
  onSave: (data: { weight: number; attended: number; is_biggest: number; tackle: string }) => void;
  onDelete?: () => void;
}) {
  const [weight, setWeight] = useState(String(result?.weight || ''));
  const [tackle, setTackle] = useState(result?.tackle || '');
  const [attended, setAttended] = useState(result?.attended ?? 1);
  const [isBiggest, setIsBiggest] = useState(result?.is_biggest ?? 0);

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{participant.name}</td>
      <td><input style={{ width: 80 }} className="form-input" type="number" min="0" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0" /></td>
      <td><input type="checkbox" checked={!!isBiggest} onChange={e => setIsBiggest(e.target.checked ? 1 : 0)} /></td>
      <td><input style={{ width: 100 }} className="form-input" value={tackle} onChange={e => setTackle(e.target.value)} placeholder="снасть" /></td>
      <td><input type="checkbox" checked={!!attended} onChange={e => setAttended(e.target.checked ? 1 : 0)} /></td>
      <td>
        <button className="btn btn-primary btn-sm" onClick={() => onSave({ weight: Number(weight) || 0, attended, is_biggest: isBiggest, tackle })}>💾</button>
        {onDelete && <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={onDelete}>✕</button>}
      </td>
    </tr>
  );
}

// ---- Admin: Achievements ----
function AdminAchievements({ token }: { token: string }) {
  const qc = useQueryClient();
  const { data: participants = [] } = useQuery({ queryKey: ['/api/participants'], queryFn: () => apiGet<Participant[]>('/api/participants') });
  const { data: achievements = [] } = useQuery({ queryKey: ['/api/achievements'], queryFn: () => apiGet<Achievement[]>('/api/achievements') });
  const [form, setForm] = useState({ participant_id: '', category: 'Крупненькая', year: String(new Date().getFullYear()), name: '' });
  const [saved, setSaved] = useState('');

  const add = useMutation({
    mutationFn: () => apiPost('/api/achievements', { ...form, participant_id: Number(form.participant_id) }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/achievements'] }); qc.invalidateQueries({ queryKey: ['/api/rating'] }); setForm(f => ({ ...f, name: '', participant_id: '' })); setSaved('Достижение начислено'); setTimeout(() => setSaved(''), 2000); }
  });
  const del = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/achievements/${id}`, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/achievements'] }); qc.invalidateQueries({ queryKey: ['/api/rating'] }); setSaved('Достижение удалено'); setTimeout(() => setSaved(''), 2000); }
  });

  return (
    <div>
      <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Достижения (+5 баллов)</h2>
      <form onSubmit={e => { e.preventDefault(); if (form.participant_id && form.name) add.mutate(); }} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <select className="form-input form-select" value={form.participant_id} onChange={e => setForm(f => ({ ...f, participant_id: e.target.value }))} required>
          <option value="">Выберите участника</option>
          {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="form-input form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input className="form-input" type="number" placeholder="Год" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
        <input className="form-input" placeholder="напр. Крупненькая Карп" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <button className="btn btn-primary" type="submit" disabled={!form.participant_id || !form.name}>Начислить</button>
      </form>
      {saved && <p className="saved">✓ {saved}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {achievements.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Пока нет достижений.</p>}
        {achievements.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{a.participant_name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>{CATEGORIES[a.category]?.icon} {a.name} · {a.year}</span>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => del.mutate(a.id)}>Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Admin: BigFish ----
function AdminBigfish({ token }: { token: string }) {
  const qc = useQueryClient();
  const { data: participants = [] } = useQuery({ queryKey: ['/api/participants'], queryFn: () => apiGet<Participant[]>('/api/participants') });
  const { data: bigfish = [] } = useQuery({ queryKey: ['/api/bigfish'], queryFn: () => apiGet<BigFish[]>('/api/bigfish') });
  const [form, setForm] = useState({ participant_id: '', fish: '', weight: '', season: String(new Date().getFullYear()), date: '', location: '', tackle: 'Мормышка' });
  const [saved, setSaved] = useState('');

  const add = useMutation({
    mutationFn: () => apiPost('/api/bigfish', { ...form, participant_id: Number(form.participant_id), weight: Number(form.weight) }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/bigfish'] }); setForm(f => ({ ...f, fish: '', weight: '', date: '', participant_id: '' })); setSaved('Крупненькая добавлена'); setTimeout(() => setSaved(''), 2000); }
  });
  const del = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/bigfish/${id}`, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/bigfish'] }); setSaved('Запись удалена'); setTimeout(() => setSaved(''), 2000); }
  });

  return (
    <div>
      <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Крупненькие</h2>
      <form onSubmit={e => { e.preventDefault(); if (form.participant_id && form.fish && form.weight && form.date) add.mutate(); }} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <select className="form-input form-select" value={form.participant_id} onChange={e => setForm(f => ({ ...f, participant_id: e.target.value }))} required>
          <option value="">Выберите участника</option>
          {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className="form-input" placeholder="Вид рыбы (напр. Карп)" value={form.fish} onChange={e => setForm(f => ({ ...f, fish: e.target.value }))} required />
        <input className="form-input" type="number" placeholder="Вес, г" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} required />
        <input className="form-input" type="number" placeholder="Сезон (год)" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} />
        <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        <input className="form-input" placeholder="Место (водоём)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        <input className="form-input" placeholder="Снасть" value={form.tackle} onChange={e => setForm(f => ({ ...f, tackle: e.target.value }))} />
        <button className="btn btn-primary" type="submit" disabled={!form.participant_id || !form.fish || !form.weight || !form.date}>Добавить</button>
      </form>
      {saved && <p className="saved">✓ {saved}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bigfish.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Пока нет записей.</p>}
        {bigfish.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontWeight: 600 }}>🐟 {b.fish}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>{formatWeight(b.weight)} · {b.participant_name} · сезон {b.season}, {formatDate(b.date)}</span>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => del.mutate(b.id)}>Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}
