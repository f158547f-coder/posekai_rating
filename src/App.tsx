import { useState, useEffect } from 'react';
import './App.css';

interface Member {
  id: number;
  name: string;
  photo: string;
}

interface RatingEntry {
  member_id: number;
  name: string;
  photo: string;
  total_score: number;
  trips_count: number;
  total_weight: number;
  total_count: number;
  biggest_fish: number;
}

function App() {
  const [rating, setRating] = useState<RatingEntry[]>([]);
  const [view, setView] = useState<'rating' | 'admin'>('rating');
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRating();
  }, []);

  const loadRating = async () => {
    try {
      const res = await fetch('/api/rating');
      const data = await res.json();
      setRating(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const { token } = await res.json();
        setToken(token);
        localStorage.setItem('admin_token', token);
        setPassword('');
      } else {
        alert('Неверный пароль');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('admin_token');
    setView('rating');
  };

  if (loading) {
    return <div className="container"><p>Загрузка...</p></div>;
  }

  return (
    <div className="app">
      <header>
        <h1>🎣 Рейтинг клуба «Подсекай!»</h1>
        <nav>
          <button onClick={() => setView('rating')}>Рейтинг</button>
          {token ? (
            <>
              <button onClick={() => setView('admin')}>Админ</button>
              <button onClick={handleLogout}>Выход</button>
            </>
          ) : (
            <button onClick={() => setView('admin')}>Войти</button>
          )}
        </nav>
      </header>

      <main className="container">
        {view === 'rating' ? (
          <div className="rating">
            <h2>Таблица рейтинга</h2>
            {rating.length === 0 ? (
              <p>Пока нет данных рейтинга</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Место</th>
                    <th>Участник</th>
                    <th>Баллы</th>
                    <th>Выездов</th>
                    <th>Вес (кг)</th>
                    <th>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {rating.map((entry, idx) => (
                    <tr key={entry.member_id} className={idx === 0 ? 'first' : idx === 1 ? 'second' : idx === 2 ? 'third' : ''}>
                      <td>{idx + 1}</td>
                      <td>{entry.name}</td>
                      <td><strong>{Math.round(entry.total_score)}</strong></td>
                      <td>{entry.trips_count}</td>
                      <td>{entry.total_weight.toFixed(1)}</td>
                      <td>{entry.total_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="admin">
            {!token ? (
              <form onSubmit={handleLogin}>
                <h2>Вход в админ-панель</h2>
                <input
                  type="password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit">Войти</button>
              </form>
            ) : (
              <div>
                <h2>Админ-панель</h2>
                <p>Управление участниками и выездами в разработке...</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
