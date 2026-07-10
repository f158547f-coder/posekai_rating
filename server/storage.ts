import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    photo TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS catches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    trip_id INTEGER NOT NULL,
    weight REAL DEFAULT 0,
    count INTEGER DEFAULT 0,
    biggest REAL DEFAULT 0,
    personal_achievement INTEGER DEFAULT 0,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (trip_id) REFERENCES trips(id)
  );
`);

export interface Member {
  id: number;
  name: string;
  photo: string;
}

export interface Trip {
  id: number;
  date: string;
  description: string;
}

export interface Catch {
  id: number;
  member_id: number;
  trip_id: number;
  weight: number;
  count: number;
  biggest: number;
  personal_achievement: number;
}

export interface RatingEntry {
  member_id: number;
  name: string;
  photo: string;
  total_score: number;
  trips_count: number;
  total_weight: number;
  total_count: number;
  biggest_fish: number;
}

export const storage = {
  getMembers(): Member[] {
    return db.prepare('SELECT * FROM members ORDER BY name').all() as Member[];
  },
  getMember(id: number): Member | undefined {
    return db.prepare('SELECT * FROM members WHERE id = ?').get(id) as Member | undefined;
  },
  addMember(name: string, photo: string): Member {
    const result = db.prepare('INSERT INTO members (name, photo) VALUES (?, ?)').run(name, photo);
    return { id: result.lastInsertRowid as number, name, photo };
  },
  updateMember(id: number, name: string, photo: string): void {
    db.prepare('UPDATE members SET name = ?, photo = ? WHERE id = ?').run(name, photo, id);
  },
  deleteMember(id: number): void {
    db.prepare('DELETE FROM catches WHERE member_id = ?').run(id);
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
  },
  getTrips(): Trip[] {
    return db.prepare('SELECT * FROM trips ORDER BY date DESC').all() as Trip[];
  },
  getTrip(id: number): Trip | undefined {
    return db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as Trip | undefined;
  },
  addTrip(date: string, description: string): Trip {
    const result = db.prepare('INSERT INTO trips (date, description) VALUES (?, ?)').run(date, description);
    return { id: result.lastInsertRowid as number, date, description };
  },
  updateTrip(id: number, date: string, description: string): void {
    db.prepare('UPDATE trips SET date = ?, description = ? WHERE id = ?').run(date, description, id);
  },
  deleteTrip(id: number): void {
    db.prepare('DELETE FROM catches WHERE trip_id = ?').run(id);
    db.prepare('DELETE FROM trips WHERE id = ?').run(id);
  },
  getCatches(tripId?: number): Catch[] {
    if (tripId) {
      return db.prepare('SELECT * FROM catches WHERE trip_id = ?').all(tripId) as Catch[];
    }
    return db.prepare('SELECT * FROM catches').all() as Catch[];
  },
  setCatch(memberId: number, tripId: number, weight: number, count: number, biggest: number, personalAchievement: number): void {
    const existing = db.prepare('SELECT id FROM catches WHERE member_id = ? AND trip_id = ?').get(memberId, tripId);
    if (existing) {
      db.prepare('UPDATE catches SET weight = ?, count = ?, biggest = ?, personal_achievement = ? WHERE member_id = ? AND trip_id = ?')
        .run(weight, count, biggest, personalAchievement, memberId, tripId);
    } else {
      db.prepare('INSERT INTO catches (member_id, trip_id, weight, count, biggest, personal_achievement) VALUES (?, ?, ?, ?, ?, ?)')
        .run(memberId, tripId, weight, count, biggest, personalAchievement);
    }
  },
  getRating(): RatingEntry[] {
    return db.prepare(`
      SELECT
        m.id as member_id,
        m.name,
        m.photo,
        COUNT(DISTINCT c.trip_id) * 10 +
        COALESCE(SUM(c.weight), 0) * 2 +
        COALESCE(SUM(c.count), 0) * 1 +
        COALESCE(MAX(c.biggest), 0) * 3 +
        COALESCE(SUM(c.personal_achievement), 0) * 5 as total_score,
        COUNT(DISTINCT c.trip_id) as trips_count,
        COALESCE(SUM(c.weight), 0) as total_weight,
        COALESCE(SUM(c.count), 0) as total_count,
        COALESCE(MAX(c.biggest), 0) as biggest_fish
      FROM members m
      LEFT JOIN catches c ON m.id = c.member_id
      GROUP BY m.id, m.name, m.photo
      ORDER BY total_score DESC
    `).all() as RatingEntry[];
  }
};

export default db;
