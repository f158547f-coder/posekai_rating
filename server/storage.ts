import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT DEFAULT '',
    discipline TEXT DEFAULT 'fishing'
  );
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    trip_id INTEGER NOT NULL,
    weight INTEGER DEFAULT 0,
    attended INTEGER DEFAULT 1,
    is_biggest INTEGER DEFAULT 0,
    tackle TEXT DEFAULT '',
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    UNIQUE(participant_id, trip_id)
  );
  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    year INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS bigfish (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    fish TEXT NOT NULL,
    weight INTEGER NOT NULL,
    season INTEGER NOT NULL,
    date TEXT NOT NULL,
    location TEXT DEFAULT '',
    tackle TEXT DEFAULT '',
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
  );
`);

export interface Participant {
  id: number;
  name: string;
}

export interface Trip {
  id: number;
  name: string;
  date: string;
  location: string;
  discipline: string;
}

export interface Result {
  id: number;
  participant_id: number;
  trip_id: number;
  weight: number;
  attended: number;
  is_biggest: number;
  tackle: string;
}

export interface Achievement {
  id: number;
  participant_id: number;
  category: string;
  year: number;
  name: string;
}

export interface BigFish {
  id: number;
  participant_id: number;
  fish: string;
  weight: number;
  season: number;
  date: string;
  location: string;
  tackle: string;
}

// Формула: балл за выезд = (N - место + 1) / N * 100
// где N = число участников на выезде (присутствовавших)
// Нормировка итогового рейтинга: рейтинг = промбалл / макс * 100
// Личное достижение (Крупненькая сезона) = 100 баллов

export const storage = {
  // --- Participants ---
  getParticipants(): Participant[] {
    return db.prepare('SELECT * FROM participants ORDER BY name').all() as Participant[];
  },
  addParticipant(name: string): Participant {
    const r = db.prepare('INSERT INTO participants (name) VALUES (?)').run(name);
    return { id: r.lastInsertRowid as number, name };
  },
  deleteParticipant(id: number): void {
    db.prepare('DELETE FROM participants WHERE id = ?').run(id);
  },

  // --- Trips ---
  getTrips(): Trip[] {
    return db.prepare('SELECT * FROM trips ORDER BY date DESC').all() as Trip[];
  },
  addTrip(name: string, date: string, location: string, discipline: string): Trip {
    const r = db.prepare('INSERT INTO trips (name, date, location, discipline) VALUES (?, ?, ?, ?)').run(name, date, location, discipline);
    return { id: r.lastInsertRowid as number, name, date, location, discipline };
  },
  deleteTrip(id: number): void {
    db.prepare('DELETE FROM trips WHERE id = ?').run(id);
  },

  // --- Results ---
  getResults(): (Result & { participant_name: string; trip_name: string; trip_date: string; trip_location: string })[] {
    return db.prepare(`
      SELECT r.*, p.name as participant_name, t.name as trip_name, t.date as trip_date, t.location as trip_location
      FROM results r
      JOIN participants p ON p.id = r.participant_id
      JOIN trips t ON t.id = r.trip_id
      ORDER BY t.date DESC
    `).all() as any[];
  },
  getResultsByTrip(tripId: number): (Result & { participant_name: string })[] {
    return db.prepare(`
      SELECT r.*, p.name as participant_name
      FROM results r
      JOIN participants p ON p.id = r.participant_id
      WHERE r.trip_id = ?
    `).all(tripId) as any[];
  },
  setResult(participantId: number, tripId: number, weight: number, attended: number, isBiggest: number, tackle: string): void {
    const existing = db.prepare('SELECT id FROM results WHERE participant_id = ? AND trip_id = ?').get(participantId, tripId);
    if (existing) {
      db.prepare('UPDATE results SET weight=?, attended=?, is_biggest=?, tackle=? WHERE participant_id=? AND trip_id=?')
        .run(weight, attended, isBiggest, tackle, participantId, tripId);
    } else {
      db.prepare('INSERT INTO results (participant_id, trip_id, weight, attended, is_biggest, tackle) VALUES (?,?,?,?,?,?)')
        .run(participantId, tripId, weight, attended, isBiggest, tackle);
    }
  },
  deleteResult(id: number): void {
    db.prepare('DELETE FROM results WHERE id = ?').run(id);
  },

  // --- Achievements ---
  getAchievements(): (Achievement & { participant_name: string })[] {
    return db.prepare(`
      SELECT a.*, p.name as participant_name
      FROM achievements a
      JOIN participants p ON p.id = a.participant_id
      ORDER BY a.year DESC, a.category
    `).all() as any[];
  },
  addAchievement(participantId: number, category: string, year: number, name: string): Achievement {
    const r = db.prepare('INSERT INTO achievements (participant_id, category, year, name) VALUES (?,?,?,?)').run(participantId, category, year, name);
    return { id: r.lastInsertRowid as number, participant_id: participantId, category, year, name };
  },
  deleteAchievement(id: number): void {
    db.prepare('DELETE FROM achievements WHERE id = ?').run(id);
  },

  // --- BigFish ---
  getBigfish(): (BigFish & { participant_name: string })[] {
    return db.prepare(`
      SELECT b.*, p.name as participant_name
      FROM bigfish b
      JOIN participants p ON p.id = b.participant_id
      ORDER BY b.weight DESC
    `).all() as any[];
  },
  addBigfish(participantId: number, fish: string, weight: number, season: number, date: string, location: string, tackle: string): BigFish {
    const r = db.prepare('INSERT INTO bigfish (participant_id, fish, weight, season, date, location, tackle) VALUES (?,?,?,?,?,?,?)').run(participantId, fish, weight, season, date, location, tackle);
    return { id: r.lastInsertRowid as number, participant_id: participantId, fish, weight, season, date, location, tackle };
  },
  deleteBigfish(id: number): void {
    db.prepare('DELETE FROM bigfish WHERE id = ?').run(id);
  },

  // --- Rating ---
  getRating() {
    const participants = db.prepare('SELECT * FROM participants').all() as Participant[];
    const trips = db.prepare('SELECT * FROM trips ORDER BY date DESC').all() as Trip[];
    const allResults = db.prepare('SELECT * FROM results').all() as Result[];
    const allAchievements = db.prepare('SELECT * FROM achievements').all() as Achievement[];

    // Текущий клубный год (со второго воскресенья сентября)
    const now = new Date();
    function getClubYearStart(year: number): Date {
      const sep1 = new Date(year, 8, 1);
      const dow = sep1.getDay();
      const firstSun = dow === 0 ? sep1 : new Date(year, 8, 1 + (7 - dow));
      return new Date(year, 8, firstSun.getDate() + 7);
    }
    let clubYearStart = getClubYearStart(now.getFullYear());
    if (now < clubYearStart) clubYearStart = getClubYearStart(now.getFullYear() - 1);
    const currentSeason = clubYearStart.getFullYear();

    // Выезды текущего сезона
    const seasonTrips = trips.filter(t => {
      const d = new Date(t.date);
      return d >= clubYearStart;
    });
    const seasonTripIds = new Set(seasonTrips.map(t => t.id));

    // Для каждого выезда считаем баллы: (N - место + 1) / N * 100
    const tripScoresMap: Record<number, Record<number, number>> = {};
    for (const trip of seasonTrips) {
      const rows = allResults.filter(r => r.trip_id === trip.id && r.attended);
      const N = rows.length;
      if (N === 0) continue;
      const sorted = [...rows].sort((a, b) => b.weight - a.weight);
      tripScoresMap[trip.id] = {};
      // Обработка одинаковых весов (одинаковые места)
      let i = 0;
      while (i < sorted.length) {
        let j = i;
        while (j < sorted.length && sorted[j].weight === sorted[i].weight) j++;
        // все от i до j-1 имеют одинаковый вес — усредняем баллы
        let sumScores = 0;
        for (let k = i; k < j; k++) {
          const place = k + 1;
          sumScores += (N - place + 1) / N * 100;
        }
        const avgScore = Math.round((sumScores / (j - i)) * 100) / 100;
        for (let k = i; k < j; k++) {
          tripScoresMap[trip.id][sorted[k].participant_id] = avgScore;
        }
        i = j;
      }
    }

    // Промежуточный балл каждого участника
    const entries = participants.map(p => {
      const seasonResults = allResults.filter(r => r.participant_id === p.id && seasonTripIds.has(r.trip_id));
      const seasonAchievements = allAchievements.filter(a => a.participant_id === p.id && a.year === currentSeason);

      // Сумма баллов за выезды
      let tripScore = 0;
      let tripsAttended = 0;
      for (const res of seasonResults) {
        if (res.attended) {
          tripsAttended++;
          if (tripScoresMap[res.trip_id]) {
            tripScore += tripScoresMap[res.trip_id][p.id] || 0;
          }
        }
      }

      // Личные достижения: 100 баллов за каждое (Крупненькая сезона)
      const achScore = seasonAchievements.length * 100;
      const intermediate = Math.round((tripScore + achScore) * 100) / 100;

      return {
        participant: p,
        intermediate,
        tripsAttended,
        achievementsCount: seasonAchievements.length,
        achievements: seasonAchievements,
        results: seasonResults,
        place: 0,
        rating: 0
      };
    });

    // Нормировка: рейтинг = intermediate / max * 100
    const maxIntermediate = Math.max(...entries.map(e => e.intermediate), 1);
    const sorted = entries
      .map(e => ({
        ...e,
        rating: Math.round((e.intermediate / maxIntermediate) * 100 * 10) / 10
      }))
      .sort((a, b) => b.intermediate - a.intermediate)
      .map((entry, idx) => ({ ...entry, place: idx + 1 }));

    return sorted;
  }
};

export default db;
