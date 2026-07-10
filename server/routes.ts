import { Express, Request, Response } from 'express';
import { storage } from './storage.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'podsekai2024';
const tokens = new Set<string>();

function requireAuth(req: Request, res: Response): boolean {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !tokens.has(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function registerRoutes(app: Express): void {
  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      tokens.add(token);
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) tokens.delete(token);
    res.json({ ok: true });
  });

  // Rating
  app.get('/api/rating', (_req, res) => {
    res.json(storage.getRating());
  });

  // Members
  app.get('/api/members', (_req, res) => {
    res.json(storage.getMembers());
  });

  app.post('/api/members', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, photo } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' }) as any;
    res.json(storage.addMember(name, photo || ''));
  });

  app.put('/api/members/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, photo } = req.body;
    storage.updateMember(parseInt(req.params.id), name, photo || '');
    res.json({ ok: true });
  });

  app.delete('/api/members/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    storage.deleteMember(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Trips
  app.get('/api/trips', (_req, res) => {
    res.json(storage.getTrips());
  });

  app.post('/api/trips', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { date, description } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' }) as any;
    res.json(storage.addTrip(date, description || ''));
  });

  app.put('/api/trips/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { date, description } = req.body;
    storage.updateTrip(parseInt(req.params.id), date, description || '');
    res.json({ ok: true });
  });

  app.delete('/api/trips/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    storage.deleteTrip(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Catches
  app.get('/api/catches', (req, res) => {
    const tripId = req.query.trip_id ? parseInt(req.query.trip_id as string) : undefined;
    res.json(storage.getCatches(tripId));
  });

  app.post('/api/catches', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { member_id, trip_id, weight, count, biggest, personal_achievement } = req.body;
    storage.setCatch(member_id, trip_id, weight || 0, count || 0, biggest || 0, personal_achievement || 0);
    res.json({ ok: true });
  });
}
