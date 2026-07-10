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
    if (!requireAuth(req, res)) return;
    const { name } = req.body;
    if (!name) return void res.status(400).json({ error: 'name required' });
    res.json(storage.addParticipant(name));
  });

  app.delete('/api/participants/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    storage.deleteParticipant(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Trips
  app.get('/api/trips', (_req, res) => {
    res.json(storage.getTrips());
  });

  app.post('/api/trips', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, date, location, discipline } = req.body;
    if (!date) return void res.status(400).json({ error: 'date required' });
    res.json(storage.addTrip(name || `Выезд ${date}`, date, location || '', discipline || 'fishing'));
  });

  app.delete('/api/trips/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
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
    if (!requireAuth(req, res)) return;
    const { participant_id, trip_id, weight, attended, is_biggest, tackle } = req.body;
    if (!participant_id || !trip_id) return void res.status(400).json({ error: 'participant_id and trip_id required' });
    storage.setResult(participant_id, trip_id, weight || 0, attended ?? 1, is_biggest || 0, tackle || '');
    res.json({ ok: true });
  });

  app.delete('/api/results/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    storage.deleteResult(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Achievements
  app.get('/api/achievements', (_req, res) => {
    res.json(storage.getAchievements());
  });

  app.post('/api/achievements', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { participant_id, category, year, name } = req.body;
    if (!participant_id || !category || !year || !name) return void res.status(400).json({ error: 'fields required' });
    res.json(storage.addAchievement(participant_id, category, parseInt(year), name));
  });

  app.delete('/api/achievements/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    storage.deleteAchievement(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // BigFish
  app.get('/api/bigfish', (_req, res) => {
    res.json(storage.getBigfish());
  });

  app.post('/api/bigfish', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { participant_id, fish, weight, season, date, location, tackle } = req.body;
    if (!participant_id || !fish || !weight || !season || !date) return void res.status(400).json({ error: 'fields required' });
    res.json(storage.addBigfish(participant_id, fish, weight, parseInt(season), date, location || '', tackle || ''));
  });

  app.delete('/api/bigfish/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    storage.deleteBigfish(parseInt(req.params.id));
    res.json({ ok: true });
  });
}
