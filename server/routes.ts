import { Express, Request, Response } from 'express';
import { storage } from './storage.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'podsekai2024';
const tokens = new Set<string>();

function requireAuth(req: Request, res: Response): boolean {
  const token = req.headers['x-admin-token'] as string || req.headers.authorization?.replace('Bearer ', '');
  if (!token || !tokens.has(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function registerRoutes(app: Express): void {
  // Auth
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      tokens.add(token);
      res.json({ ok: true, token });
    } else {
      res.status(401).json({ error: 'Неверный пароль' });
    }
  });

  app.post('/api/admin/logout', (req, res) => {
    const token = req.headers['x-admin-token'] as string || req.headers.authorization?.replace('Bearer ', '');
    if (token) tokens.delete(token);
    res.json({ ok: true });
  });

  // Rating
  app.get('/api/rating', (_req, res) => {
    try { res.json(storage.getRating()); }
    catch(e) { res.status(500).json({ error: String(e) }); }
  });

  // Participants
  app.get('/api/participants', (_req, res) => {
    res.json(storage.getParticipants());
  });

  app.post('/api/participants', (req, res) => {
    
    const { name } = req.body;
    if (!name) return void res.status(400).json({ error: 'name required' });
    res.json(storage.addParticipant(name));
  });

  app.delete('/api/participants/:id', (req, res) => {
    
    storage.deleteParticipant(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Trips
  app.get('/api/trips', (_req, res) => {
    res.json(storage.getTrips());
  });

  app.post('/api/trips', (req, res) => {
    
    const { name, date, location, discipline } = req.body;
    if (!date) return void res.status(400).json({ error: 'date required' });
    res.json(storage.addTrip(name || `Выезд ${date}`, date, location || '', discipline || 'fishing'));
  });

  app.delete('/api/trips/:id', (req, res) => {
    
    storage.deleteTrip(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Results
  app.get('/api/results', (req, res) => {
    const tripId = req.query.trip_id ? parseInt(req.query.trip_id as string) : undefined;
    if (tripId) res.json(storage.getResultsByTrip(tripId));
    else res.json(storage.getResults());
  });

  app.post('/api/results', (req, res) => {
    
    const { participant_id, trip_id, weight, attended, is_biggest, tackle } = req.body;
    if (!participant_id || !trip_id) return void res.status(400).json({ error: 'participant_id and trip_id required' });
    storage.setResult(participant_id, trip_id, weight || 0, attended ?? 1, is_biggest || 0, tackle || '');
    res.json({ ok: true });
  });

  app.delete('/api/results/:id', (req, res) => {
    
    storage.deleteResult(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Achievements
  app.get('/api/achievements', (_req, res) => {
    res.json(storage.getAchievements());
  });

  app.post('/api/achievements', (req, res) => {
    
    const { participant_id, category, year, name } = req.body;
    if (!participant_id || !category || !year || !name) return void res.status(400).json({ error: 'fields required' });
    res.json(storage.addAchievement(participant_id, category, parseInt(year), name));
  });

  app.delete('/api/achievements/:id', (req, res) => {
    
    storage.deleteAchievement(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // BigFish
  app.get('/api/bigfish', (_req, res) => {
    res.json(storage.getBigfish());
  });

  app.post('/api/bigfish', (req, res) => {
    
    const { participant_id, fish, weight, season, date, location, tackle } = req.body;
    if (!participant_id || !fish || !weight || !season || !date) return void res.status(400).json({ error: 'fields required' });
    res.json(storage.addBigfish(participant_id, fish, weight, parseInt(season), date, location || '', tackle || ''));
  });

  app.delete('/api/bigfish/:id', (req, res) => {
    
    storage.deleteBigfish(parseInt(req.params.id));
    res.json({ ok: true });
  });
}


  // SEED endpoint - one-time data import
  app.get('/api/seed', async (req, res) => {
    
    const db = (storage as any).db;
    const participants = [
      'Малеев Арсений Сергеевич',
      'Харитонкин Радомир Александрович',
      'Никифоров Леонид Ильич',
      'Александров Тимофей Вячеславович',
      'Петров Павел Витальевич',
      'Перекотий Данила Сергеевич',
      'Ембулаев Глеб Сергеевич',
      'Краснов Павел Кириллович',
      'Артищев Тимофей Андреевич',
      'Черевик Ярослав Валентинович',
      'Васильев Ярослав Юрьевич',
      'Колотилов Демьян Никитич',
      'Шиманский Артём Олегович',
      'Землянкин Степан Александрович',
      'Кундаев Платон Александрович',
      'Мещеряков Александр Олегович',
      'Семененко Семён Денисович',
      'Авер Доминик Константинович',
      'Амбразевич Андрей Дмитриевич',
      'Андрианов Алексей Александрович',
      'Балицкий Даниил Александрович',
      'Вайсс Михаэль',
      'Ветров Александр Михайлович',
      'Губарев Ратмир Максимович',
      'Деев Даниил Артёмович',
      'Закашанский Яков Константинович',
      'Карымов Владимир Олегович',
      'Кутмириди Никос Янович',
      'Лишманов Пётр Герардович',
      'Немировский Теодор Ильич',
      'Ратинский Евгений Михайлович',
      'Тарасов Максим Олегович',
    ];
    const pIds: number[] = [];
    for (const name of participants) {
      const p = storage.addParticipant(name);
      pIds.push(p.id);
    }
    const trips = [
      { name: 'Выезд 10.01.2026', date: '2026-01-10', location: 'Нагатинский затон - канал', discipline: 'fishing' },
      { name: 'Выезд 17.01.2026', date: '2026-01-17', location: 'Лебедянский пруд', discipline: 'fishing' },
      { name: 'Выезд 24.01.2026', date: '2026-01-24', location: 'Химкинское водохранилище', discipline: 'fishing' },
      { name: 'Выезд 31.01-01.02.2026', date: '2026-01-31', location: 'Бобровый пруд РБ "Львово"', discipline: 'fishing' },
      { name: 'Выезд 07.02.2026', date: '2026-02-07', location: 'м.о. Шаховская', discipline: 'fishing' },
    ];
    const tIds: number[] = [];
    for (const t of trips) {
      const tr = storage.addTrip(t.name, t.date, t.location, t.discipline);
      tIds.push(tr.id);
    }
    // Results: [participant_index, trip_index, weight_g, attended, is_biggest, tackle]
    const results: [number,number,number,number,number,string][] = [
      // Малеев (0)
      [0,0,0,0,0,''], // неявка
      [0,1,7,1,0,'мормышка'],
      [0,2,88,1,0,'мормышка'],
      [0,3,12,1,0,'мормышка'],
      [0,4,1184,1,1,'мормышка'], // Лещ 179г - крупненькая
      // Харитонкин (1)
      [1,0,0,0,0,''], // неявка
      [1,1,13,1,0,'мормышка'],
      [1,2,24,1,0,'мормышка'],
      [1,3,7,1,0,'мормышка'],
      [1,4,0,0,0,''], // неявка
      // Никифоров (2)
      [2,0,0,0,0,''], // неявка
      [2,1,0,0,0,''], // неявка
      [2,2,46,1,0,'мормышка'],
      [2,3,46,1,1,'мормышка'], // Плотва 150г
      [2,4,2197,1,0,'мормышка'],
      // Александров (3)
      [3,0,0,0,0,''], // неявка
      [3,1,1,1,0,'мормышка'],
      [3,2,239,1,0,'мормышка'],
      [3,3,0,0,0,''], // неявка
      [3,4,1260,1,0,'мормышка'],
      // Петров (4)
      [4,0,250,1,1,'мормышка'], // Плотва 250г
      [4,1,0,0,0,''], // неявка
      [4,2,23,1,0,'мормышка'],
      [4,3,0,0,0,''], // неявка
      [4,4,0,0,0,''], // неявка
      // Перекотий (5)
      [5,0,0,0,0,''], // неявка
      [5,1,0,0,0,''], // неявка
      [5,2,170,1,1,'мормышка'], // окунь 170г
      [5,3,0,0,0,''], // неявка
      [5,4,0,0,0,''], // неявка
      // Ембулаев (6)
      [6,0,0,1,0,'мормышка'],
      [6,1,1,1,0,'мормышка'],
      [6,2,0,1,0,'мормышка'],
      [6,3,0,1,0,'мормышка'],
      [6,4,0,0,0,''], // неявка
      // Краснов (7)
      [7,0,0,1,0,'мормышка'],
      [7,1,1,1,0,'мормышка'],
      [7,2,0,0,0,''], // неявка
      [7,3,0,1,0,'мормышка'],
      [7,4,0,0,0,''], // неявка
      // Артищев (8)
      [8,0,0,0,0,''], // неявка
      [8,1,0,1,0,'мормышка'],
      [8,2,0,0,0,''], // неявка
      [8,3,0,0,0,''], // неявка
      [8,4,0,0,0,''], // неявка
      // Черевик (9)
      [9,0,0,1,0,'мормышка'],
      [9,1,0,1,0,'мормышка'],
      [9,2,0,0,0,''], // неявка
      [9,3,0,1,0,'мормышка'],
      [9,4,157,1,0,'мормышка'],
      // Васильев (10)
      [10,0,0,0,0,''], // неявка
      [10,1,0,1,0,'мормышка'],
      [10,2,0,0,0,''], // неявка
      [10,3,0,0,0,''], // неявка
      [10,4,0,0,0,''], // неявка
      // Колотилов (11)
      [11,0,0,1,0,'мормышка'],
      [11,1,0,1,0,'мормышка'],
      [11,2,0,0,0,''], // неявка
      [11,3,0,0,0,''], // неявка
      [11,4,0,0,0,''], // неявка
      // Шиманский (12)
      [12,0,0,0,0,''], // неявка
      [12,1,0,0,0,''], // неявка
      [12,2,0,0,0,''], // неявка
      [12,3,0,0,0,''], // неявка
      [12,4,0,1,0,'мормышка'],
      // Землянкин (13)
      [13,0,0,0,0,''], // неявка
      [13,1,0,0,0,''], // неявка
      [13,2,0,0,0,''], // неявка
      [13,3,0,0,0,''], // неявка
      [13,4,0,1,0,'мормышка'],
      // Кундаев (14)
      [14,0,0,0,0,''], // неявка
      [14,1,0,1,0,'мормышка'],
      // Мещеряков (15)
      [15,0,0,0,0,''], // неявка
      [15,1,0,1,0,'мормышка'],
      // Семененко (16)
      [16,0,0,0,0,''], // неявка
      [16,1,0,1,0,'мормышка'],
    ];
    for (const [pi,ti,w,att,big,tack] of results) {
      if (att) storage.setResult(pIds[pi], tIds[ti], w, att, big, tack);
    }
    // Achievements
    storage.addAchievement(pIds[1], 'Крупненькая', 2026, 'Крупненькая: Карп 2026');
    storage.addAchievement(pIds[4], 'Крупненькая', 2026, 'Крупненькая: Плотва 2026');
    storage.addAchievement(pIds[5], 'Крупненькая', 2026, 'Крупненькая: Окунь 2026');
    storage.addAchievement(pIds[8], 'Крупненькая', 2026, 'Крупненькая: Форель 2026');
    // BigFish
    storage.addBigfish(pIds[1], 'Карп', 12300, 2026, '2025-06-01', 'Пруд в Мордовии', 'Матч');
    storage.addBigfish(pIds[22], 'Окунь', 500, 2025, '2025-06-01', 'Москва река - Братеево', 'Поплавок');
    storage.addBigfish(pIds[5], 'Окунь', 170, 2026, '2026-01-24', 'Химкинское водохранилище', 'Мормышка');
    storage.addBigfish(pIds[4], 'Плотва', 250, 2026, '2026-01-10', 'Нагатинский затон - канал', 'Мормышка');
    storage.addBigfish(pIds[8], 'Форель', 2850, 2025, '2025-10-19', 'ВНИИПРХ', 'Форелирование');
    res.json({ ok: true, participants: pIds.length, trips: tIds.length });
  });
}
