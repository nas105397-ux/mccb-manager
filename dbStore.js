import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

// SQLite 永続化層。MCCB/子札は正規化テーブル、その他の画面設定や履歴は JSON collection として保存する。
const COLLECTION_KEYS = [
  'rooms',
  'categories',
  'categoryColors',
  'logs',
  'logSettings',
  'requests',
  'draftRequests',
  'deviceGroups',
  'requestHistory',
  'historySettings',
];

const CORE_COLLECTION_KEYS = [
  'rooms',
  'categories',
  'categoryColors',
  'logSettings',
  'requests',
  'draftRequests',
  'deviceGroups',
  'historySettings',
];

const UPSERT_COLLECTION_SQL = `
  INSERT INTO app_collections (key, value_json)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
`;

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
    categoryColors: source.categoryColors || defaults.categoryColors,
    logs: source.logs || defaults.logs,
    logSettings: source.logSettings || defaults.logSettings,
    requests: source.requests || defaults.requests,
    draftRequests: source.draftRequests || defaults.draftRequests,
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

const createBackupFileName = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    'mccb_data',
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  ].join('_') + '.sqlite';
};

export function createMccbStore({ dbPath, defaults }) {
  const db = new DatabaseSync(dbPath);
  let lastCheckpointAt = 0;

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

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const hasRows = () => {
    const row = db.prepare('SELECT COUNT(*) AS count FROM mccbs').get();
    return row.count > 0;
  };

  const getVersion = () => {
    const row = db
      .prepare('SELECT value FROM app_meta WHERE key = ?')
      .get('data_version');
    return Number(row?.value || 0);
  };

  const setVersion = (version) => {
    db.prepare(
      `INSERT INTO app_meta (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run('data_version', String(version));
  };

  const bumpVersion = () => {
    const nextVersion = Math.max(Date.now(), getVersion() + 1);
    setVersion(nextVersion);
    return nextVersion;
  };

  // 書き込み系処理は必ず即時トランザクションに乗せ、途中失敗時はDB状態を戻す。
  const runImmediateTransaction = (operation) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };

  // WAL 運用中のファイル肥大対策。バックアップ/終了時は TRUNCATE で確実に反映する。
  const checkpointWal = ({ force = false, mode = 'PASSIVE' } = {}) => {
    const now = Date.now();
    if (!force && now - lastCheckpointAt < 60_000) return null;

    const checkpointMode = mode === 'TRUNCATE' ? 'TRUNCATE' : 'PASSIVE';
    try {
      const result = db
        .prepare(`PRAGMA wal_checkpoint(${checkpointMode})`)
        .all();
      lastCheckpointAt = now;
      return result?.[0] || null;
    } catch (error) {
      console.warn('SQLite WAL checkpoint skipped:', error.message);
      return null;
    }
  };

  const close = () => {
    checkpointWal({ force: true, mode: 'TRUNCATE' });
    db.close();
  };

  const createBackup = ({ backupDir, maxFiles = 10 } = {}) => {
    if (!backupDir) {
      throw new Error('backupDir is required');
    }

    // コピー前に WAL を本体へ取り込み、単体の .sqlite だけで復旧できるバックアップにする。
    checkpointWal({ force: true, mode: 'TRUNCATE' });
    fs.mkdirSync(backupDir, { recursive: true });

    const fileName = createBackupFileName();
    const backupPath = `${backupDir}/${fileName}`;
    fs.copyFileSync(dbPath, backupPath);

    const backupFiles = fs
      .readdirSync(backupDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^mccb_data_\d{8}_\d{6}\.sqlite$/.test(entry.name))
      .map((entry) => {
        const filePath = `${backupDir}/${entry.name}`;
        const stat = fs.statSync(filePath);
        return {
          fileName: entry.name,
          path: filePath,
          size: stat.size,
          createdAt: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    for (const oldFile of backupFiles.slice(Math.max(1, maxFiles))) {
      fs.unlinkSync(oldFile.path);
    }

    const keptFiles = backupFiles
      .filter((file) => fs.existsSync(file.path))
      .map(({ fileName, size, createdAt }) => ({ fileName, size, createdAt }));

    return {
      fileName,
      path: backupPath,
      size: fs.statSync(backupPath).size,
      keptFiles,
    };
  };

  const readCollection = (key) => {
    const row = db
      .prepare('SELECT value_json FROM app_collections WHERE key = ?')
      .get(key);
    return parseJson(row?.value_json, defaults[key]);
  };

  const readCollectionPage = (key, page = 1, pageSize = 50) => {
    const items = readCollection(key);
    const normalizedItems = Array.isArray(items) ? items : [];
    const safePageSize = Math.max(1, Number(pageSize) || 50);
    const total = normalizedItems.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (safePage - 1) * safePageSize;

    return {
      items: normalizedItems.slice(start, start + safePageSize),
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
      version: getVersion(),
    };
  };

  const writeCollection = (key, value) => {
    db.prepare(UPSERT_COLLECTION_SQL).run(key, JSON.stringify(value));
    return bumpVersion();
  };

  const writeCollections = (entries) => {
    const upsert = db.prepare(UPSERT_COLLECTION_SQL);

    runImmediateTransaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        upsert.run(key, JSON.stringify(value));
      }
    });

    return bumpVersion();
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

  const readMccbsByIds = (ids) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    return uniqueIds.map((id) => readMccb(id)).filter(Boolean);
  };

  const readDummyMccbs = () => {
    const rows = db
      .prepare(
        `SELECT id
         FROM mccbs
         WHERE is_dummy = 1 OR name LIKE '%ダミー%' OR id LIKE '%DUMMY%'
         ORDER BY rowid`,
      )
      .all();
    return rows.map((row) => readMccb(row.id)).filter(Boolean);
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

    // CSV 取込やバックアップ復旧は全体置換なので、MCCB と collection を同一 transaction で入れ替える。
    runImmediateTransaction(() => {
      db.exec('DELETE FROM child_cards');
      db.exec('DELETE FROM mccbs');

      const upsertCollection = db.prepare(UPSERT_COLLECTION_SQL);

      for (const mccb of normalized.mccbList) {
        writeMccb(mccb, now);
      }

      for (const key of COLLECTION_KEYS) {
        upsertCollection.run(key, JSON.stringify(normalized[key]));
      }
    });

    return { ...normalized, version: bumpVersion() };
  };

  const readMccbList = () => {
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

    return rows.map((row) =>
      toMccbObject(row, childCardsByMccb.get(row.id) || []),
    );
  };

  const readCollections = (keys) => {
    if (!keys.length) return {};

    const collections = new Map(
      db
        .prepare(
          `SELECT key, value_json
           FROM app_collections
           WHERE key IN (${keys.map(() => '?').join(',')})`,
        )
        .all(...keys)
        .map((row) => [row.key, row.value_json]),
    );

    return Object.fromEntries(
      keys.map((key) => [key, parseJson(collections.get(key), defaults[key])]),
    );
  };

  const readAll = () => {
    const data = {
      mccbList: readMccbList(),
      ...readCollections(COLLECTION_KEYS),
    };

    return { ...normalizeData(data, defaults), version: getVersion() };
  };

  const readCoreData = () => {
    // 常時ポーリングでは大きくなりやすいログ/履歴を省き、画面状態だけを同期する。
    const data = {
      mccbList: readMccbList(),
      ...readCollections(CORE_COLLECTION_KEYS),
      logs: [],
      requestHistory: [],
    };

    return { ...normalizeData(data, defaults), version: getVersion(), core: true };
  };

  const updateMccb = (updatedMccb) => {
    const before = readMccb(updatedMccb.id);
    if (!before) return null;

    runImmediateTransaction(() => {
      writeMccb(updatedMccb);
    });

    const version = bumpVersion();

    return {
      before,
      after: readMccb(updatedMccb.id),
      version,
    };
  };

  const createMccb = (mccb) => {
    runImmediateTransaction(() => {
      writeMccb(mccb);
    });

    return {
      mccb: readMccb(mccb.id),
      version: bumpVersion(),
    };
  };

  const deleteMccb = (id) => {
    const existing = readMccb(id);
    if (!existing) return null;

    runImmediateTransaction(() => {
      db.prepare('DELETE FROM child_cards WHERE mccb_id = ?').run(id);
      db.prepare('DELETE FROM mccbs WHERE id = ?').run(id);
    });

    return {
      deleted: existing,
      version: bumpVersion(),
    };
  };

  const writeMccbs = (mccbs) => {
    const now = Date.now();

    // 依頼発行などの部分更新用。変更がない場合は version を進めない。
    runImmediateTransaction(() => {
      for (const mccb of mccbs) {
        writeMccb(mccb, now);
      }
    });

    return mccbs.length > 0 ? bumpVersion() : getVersion();
  };

  if (!hasRows()) {
    saveAll(defaults);
  }

  if (getVersion() === 0) {
    bumpVersion();
  }

  return {
    checkpointWal,
    close,
    createBackup,
    getVersion,
    createMccb,
    deleteMccb,
    readAll,
    readCollection,
    readCollectionPage,
    readCoreData,
    readDummyMccbs,
    readMccb,
    readMccbsByIds,
    saveAll,
    updateMccb,
    writeCollection,
    writeCollections,
    writeMccbs,
  };
}
