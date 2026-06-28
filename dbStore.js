import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

const COLLECTION_KEYS = [
  'rooms',
  'categories',
  'logs',
  'logSettings',
  'requests',
  'deviceGroups',
  'requestHistory',
  'historySettings',
];

const boolToInt = (value) => (value ? 1 : 0);
const intToBool = (value) => value === 1;

const parseJson = (value, fallback) => {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeData = (data, defaults) => {
  const source = data && typeof data === 'object' ? data : {};
  const isArrayPayload = Array.isArray(data);

  return {
    mccbList: source.mccbList || (isArrayPayload ? data : defaults.mccbList),
    rooms: source.rooms || defaults.rooms,
    categories: source.categories || defaults.categories,
    logs: source.logs || defaults.logs,
    logSettings: source.logSettings || defaults.logSettings,
    requests: source.requests || defaults.requests,
    deviceGroups: source.deviceGroups || defaults.deviceGroups,
    requestHistory: source.requestHistory || defaults.requestHistory,
    historySettings: source.historySettings || defaults.historySettings,
  };
};

const toMccbObject = (row, childCards = []) => ({
  ...parseJson(row.extra_json, {}),
  id: row.id,
  room: row.room,
  category: row.category,
  name: row.name,
  isPowerOff: intToBool(row.is_power_off),
  isFavorite: intToBool(row.is_favorite),
  ...(row.is_dummy ? { isDummy: true } : {}),
  childCards,
});

export function createMccbStore({ dbPath, jsonPath, defaults }) {
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS mccbs (
      id TEXT PRIMARY KEY,
      room TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      is_power_off INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_dummy INTEGER NOT NULL DEFAULT 0,
      extra_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS child_cards (
      mccb_id TEXT NOT NULL,
      card_id INTEGER NOT NULL,
      is_borrowed INTEGER NOT NULL DEFAULT 0,
      worker_name TEXT NOT NULL DEFAULT '',
      extra_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (mccb_id, card_id),
      FOREIGN KEY (mccb_id) REFERENCES mccbs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_collections (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);

  const hasRows = () => {
    const row = db.prepare('SELECT COUNT(*) AS count FROM mccbs').get();
    return row.count > 0;
  };

  const readCollection = (key) => {
    const row = db
      .prepare('SELECT value_json FROM app_collections WHERE key = ?')
      .get(key);
    return parseJson(row?.value_json, defaults[key]);
  };

  const writeCollection = (key, value) => {
    db.prepare(
      `INSERT INTO app_collections (key, value_json)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ).run(key, JSON.stringify(value));
  };

  const readMccb = (id) => {
    const row = db
      .prepare(
        `SELECT id, room, category, name, is_power_off, is_favorite, is_dummy, extra_json
         FROM mccbs
         WHERE id = ?`,
      )
      .get(id);

    if (!row) return null;

    const childCards = db
      .prepare(
        `SELECT card_id, is_borrowed, worker_name, extra_json
         FROM child_cards
         WHERE mccb_id = ?
         ORDER BY card_id`,
      )
      .all(id)
      .map((card) => ({
        ...parseJson(card.extra_json, {}),
        id: card.card_id,
        isBorrowed: intToBool(card.is_borrowed),
        workerName: card.worker_name,
      }));

    return toMccbObject(row, childCards);
  };

  const writeMccb = (mccb, now = Date.now()) => {
    const {
      id,
      room,
      category,
      name,
      isPowerOff,
      isFavorite,
      isDummy,
      childCards,
      ...extra
    } = mccb;

    db.prepare(
      `INSERT INTO mccbs (
        id, room, category, name, is_power_off, is_favorite, is_dummy, extra_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        room = excluded.room,
        category = excluded.category,
        name = excluded.name,
        is_power_off = excluded.is_power_off,
        is_favorite = excluded.is_favorite,
        is_dummy = excluded.is_dummy,
        extra_json = excluded.extra_json,
        updated_at = excluded.updated_at`,
    ).run(
      id,
      room || '',
      category || '',
      name || '',
      boolToInt(isPowerOff),
      boolToInt(isFavorite),
      boolToInt(isDummy),
      JSON.stringify(extra),
      now,
    );

    db.prepare('DELETE FROM child_cards WHERE mccb_id = ?').run(id);

    const insertChildCard = db.prepare(`
      INSERT INTO child_cards (
        mccb_id, card_id, is_borrowed, worker_name, extra_json
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const cards = Array.isArray(childCards) ? childCards : [];
    for (const card of cards) {
      const { id: cardId, isBorrowed, workerName, ...cardExtra } = card;
      insertChildCard.run(
        id,
        Number(cardId),
        boolToInt(isBorrowed),
        workerName || '',
        JSON.stringify(cardExtra),
      );
    }
  };

  const saveAll = (data) => {
    const normalized = normalizeData(data, defaults);
    const now = Date.now();

    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('DELETE FROM child_cards');
      db.exec('DELETE FROM mccbs');

      const upsertCollection = db.prepare(`
        INSERT INTO app_collections (key, value_json)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
      `);

      for (const mccb of normalized.mccbList) {
        writeMccb(mccb, now);
      }

      for (const key of COLLECTION_KEYS) {
        upsertCollection.run(key, JSON.stringify(normalized[key]));
      }

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    return normalized;
  };

  const readAll = () => {
    const rows = db
      .prepare(
        `SELECT id, room, category, name, is_power_off, is_favorite, is_dummy, extra_json
         FROM mccbs
         ORDER BY rowid`,
      )
      .all();

    const childRows = db
      .prepare(
        `SELECT mccb_id, card_id, is_borrowed, worker_name, extra_json
         FROM child_cards
         ORDER BY mccb_id, card_id`,
      )
      .all();

    const childCardsByMccb = new Map();
    for (const row of childRows) {
      const cards = childCardsByMccb.get(row.mccb_id) || [];
      cards.push({
        ...parseJson(row.extra_json, {}),
        id: row.card_id,
        isBorrowed: intToBool(row.is_borrowed),
        workerName: row.worker_name,
      });
      childCardsByMccb.set(row.mccb_id, cards);
    }

    const collections = new Map(
      db
        .prepare('SELECT key, value_json FROM app_collections')
        .all()
        .map((row) => [row.key, row.value_json]),
    );

    const data = {
      mccbList: rows.map((row) =>
        toMccbObject(row, childCardsByMccb.get(row.id) || []),
      ),
    };

    for (const key of COLLECTION_KEYS) {
      data[key] = parseJson(collections.get(key), defaults[key]);
    }

    return normalizeData(data, defaults);
  };

  const updateMccb = (updatedMccb) => {
    const before = readMccb(updatedMccb.id);
    if (!before) return null;

    db.exec('BEGIN IMMEDIATE');
    try {
      writeMccb(updatedMccb);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    return {
      before,
      after: readMccb(updatedMccb.id),
    };
  };

  if (!hasRows()) {
    if (fs.existsSync(jsonPath)) {
      const rawData = fs.readFileSync(jsonPath, 'utf-8');
      saveAll(parseJson(rawData, defaults));
    } else {
      saveAll(defaults);
    }
  }

  return {
    readAll,
    readCollection,
    readMccb,
    saveAll,
    updateMccb,
    writeCollection,
  };
}
