import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path'; 
import os from 'os'; 
import { fileURLToPath } from 'url';
import { createMccbStore } from './dbStore.js';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CHILD_CARD_COUNT,
  DEFAULT_MAX_SIZE,
  DEFAULT_ROOMS,
  LOG_TYPES,
  normalizeLogs,
} from './src/shared/appConstants.js';
import {
  DEFAULT_CATEGORY_COLOR_KEYS,
  normalizeCategoryColors,
} from './src/shared/categoryColorUtils.js';
import { countBorrowedCards } from './src/shared/mccbViewUtils.js';
import {
  cloneMccbListForMutation,
  createRequestAssignmentService,
  getChangedMccbs,
  hasBorrowedChildCard,
  preservePowerStateForRequestChanges,
} from './server/requestAssignmentService.js';

const app = express();

// --- ミドルウェア設定 ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ESモジュール環境用の __dirname 互換定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = process.env.MCCB_DB_PATH || path.join(DATA_DIR, 'mccb_data.sqlite');
const HOST = process.env.HOST || process.env.MCCB_SERVER_BIND_HOST || '0.0.0.0';
const PORT = process.env.PORT || 5000;
const BACKUP_MAX_FILES = Number(process.env.MCCB_BACKUP_MAX_FILES || 10);
const AUTO_BACKUP_ENABLED = process.env.MCCB_AUTO_BACKUP_ENABLED !== '0';
const AUTO_BACKUP_ON_START = process.env.MCCB_AUTO_BACKUP_ON_START !== '0';
const AUTO_BACKUP_INTERVAL_MS = Number(
  process.env.MCCB_AUTO_BACKUP_INTERVAL_MS || 24 * 60 * 60 * 1000,
);
const WAL_CHECKPOINT_INTERVAL_MS = Number(
  process.env.MCCB_WAL_CHECKPOINT_INTERVAL_MS || 10 * 60 * 1000,
);

function ensureDefaultDatabasePath() {
  if (process.env.MCCB_DB_PATH) return;

  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const createDefaultChildCards = () =>
  Array.from({ length: DEFAULT_CHILD_CARD_COUNT }, (_, i) => ({
    id: i + 1,
    isBorrowed: false,
    workerName: '',
  }));

const createMccbId = (suffix = '') =>
  `MCCB-${Date.now()}${suffix !== '' ? `-${suffix}` : ''}`;

const normalizeMccbForCreate = (mccb, suffix = '') => ({
  ...mccb,
  id: mccb?.id || createMccbId(suffix),
  room: mccb?.room || DEFAULT_ROOMS[0],
  category: mccb?.category || DEFAULT_CATEGORIES[0],
  name: mccb?.name || '',
  isPowerOff: !!mccb?.isPowerOff,
  isFavorite: !!mccb?.isFavorite,
  childCards: Array.isArray(mccb?.childCards)
    ? mccb.childCards
    : createDefaultChildCards(),
});

// マスタデータ初期化用デフォルト値
const DEFAULT_MCCB = [
  { 
    id: "SAMPLE-1", 
    room: DEFAULT_ROOMS[0], 
    category: DEFAULT_CATEGORIES[0], 
    name: "No.1加熱炉 送風ファン用MCCB", 
    isPowerOff: false, 
    isFavorite: false, 
    childCards: createDefaultChildCards(), 
  }
];

const DEFAULT_DATA = {
  mccbList: DEFAULT_MCCB,
  rooms: DEFAULT_ROOMS,
  categories: DEFAULT_CATEGORIES,
  categoryColors: normalizeCategoryColors(DEFAULT_CATEGORIES, DEFAULT_CATEGORY_COLOR_KEYS),
  logs: [{ id: "INIT", timestamp: getTimestamp(), type: LOG_TYPES.SYSTEM, message: "システムログ機能が初期化されました。" }],
  logSettings: { maxSize: DEFAULT_MAX_SIZE },
  requests: [],
  draftRequests: [],
  deviceGroups: [],
  requestHistory: [],
  historySettings: { maxSize: DEFAULT_MAX_SIZE }
};

// ==========================================
// 1. フック外の共通ユーティリティ関数群
// ==========================================

/** サーバーログ用のタイムスタンプ文字列を生成 */
function getTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

/** サーバーマシーンのローカルIPアドレス（IPv4）を自動検出 */
function getLocalIpAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // family が IPv4 かつローカルホスト（internal）でない実アドレスを抽出
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function createUpdatedLogs(type, message, currentLogs, maxSize) {
  const newLog = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: getTimestamp(),
    type,
    message,
  };
  return [newLog, ...normalizeLogs(currentLogs)].slice(0, maxSize);
}

function createIssueRequestFromDraft(draftRequest) {
  return {
    ...draftRequest,
    id: `REQ-${Date.now()}`,
    timestamp: getTimestamp(),
  };
}

function createPage(items, page = 1, pageSize = 50) {
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
    version: store.getVersion(),
  };
}

function createMccbChangeLog(before, after) {
  const changeDetails = [];
  let logType = LOG_TYPES.MASTER_UPDATE;

  if (before.room !== after.room) {
    changeDetails.push(`電気室: ${before.room} → ${after.room}`);
  }

  if (before.category !== after.category) {
    changeDetails.push(`区分: ${before.category} → ${after.category}`);
  }

  if (before.name !== after.name) {
    changeDetails.push(`設備名: ${before.name} → ${after.name}`);
  }

  if (before.isFavorite !== after.isFavorite) {
    changeDetails.push(
      `お気に入り${after.isFavorite ? "登録しました。" : "解除しました。"}`,
    );
  }

  if (before.isPowerOff !== after.isPowerOff) {
    changeDetails.push(
      `${after.isPowerOff ? "🔴停電しました。" : "🟢送電しました。"}`,
    );
    logType = LOG_TYPES.OPERATION;
  }

  const beforeBorrowed = countBorrowedCards(before);
  const afterBorrowed = countBorrowedCards(after);
  if (beforeBorrowed !== afterBorrowed) {
    logType = LOG_TYPES.CARD_LOAN;
    changeDetails.push(`貸出札: ${beforeBorrowed}枚 → ${afterBorrowed}枚`);
  }

  if (changeDetails.length === 0) {
    return null;
  }

  return {
    type: logType,
    message: `【${before.room} / ${before.name}】${changeDetails.join(" / ")}`,
  };
}

function mergeMccbMasterFields(incomingList, allowedFields) {
  const currentById = new Map(store.readAll().mccbList.map((mccb) => [mccb.id, mccb]));
  return incomingList.map((incoming) => {
    const current = currentById.get(incoming.id);
    if (!current) return incoming;

    return allowedFields.reduce(
      (merged, field) =>
        Object.prototype.hasOwnProperty.call(incoming, field)
          ? { ...merged, [field]: incoming[field] }
          : merged,
      current,
    );
  });
}

ensureDefaultDatabasePath();

const store = createMccbStore({
  dbPath: DB_PATH,
  defaults: DEFAULT_DATA,
});

// 停電依頼の札割当ロジックはサービスへ分離し、API層を薄く保つ。
const requestAssignmentService = createRequestAssignmentService({ store });

function normalizeStoredLogs() {
  const currentLogs = store.readCollection('logs');
  const normalizedLogs = normalizeLogs(currentLogs);
  if (JSON.stringify(currentLogs) !== JSON.stringify(normalizedLogs)) {
    store.writeCollection('logs', normalizedLogs);
  }
}

normalizeStoredLogs();
store.checkpointWal({ force: true, mode: 'TRUNCATE' });

const walCheckpointTimer = setInterval(() => {
  store.checkpointWal({ mode: 'PASSIVE' });
}, WAL_CHECKPOINT_INTERVAL_MS);
walCheckpointTimer.unref?.();

let httpServer = null;

function listDatabaseBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  return fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^mccb_data_\d{8}_\d{6}\.sqlite$/.test(entry.name))
    .map((entry) => {
      const filePath = path.join(BACKUP_DIR, entry.name);
      const stat = fs.statSync(filePath);
      return {
        fileName: entry.name,
        size: stat.size,
        createdAt: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function resolveBackupPath(fileName) {
  const requestedFileName = String(fileName || '');
  const safeFileName = path.basename(requestedFileName);
  if (
    safeFileName !== requestedFileName ||
    !/^mccb_data_\d{8}_\d{6}\.sqlite$/.test(safeFileName)
  ) {
    throw new Error('復旧対象のバックアップファイル名が不正です。');
  }

  const backupPath = path.join(BACKUP_DIR, safeFileName);
  if (!fs.existsSync(backupPath)) {
    throw new Error('復旧対象のバックアップファイルが見つかりません。');
  }

  return backupPath;
}

function createDatabaseBackup(reason = '手動') {
  const backup = store.createBackup({
    backupDir: BACKUP_DIR,
    maxFiles: BACKUP_MAX_FILES,
  });
  const logs = createUpdatedLogs(
    LOG_TYPES.SYSTEM,
    `${reason}DBバックアップを作成しました: ${backup.fileName}`,
    store.readCollection('logs'),
    store.readCollection('logSettings')?.maxSize || DEFAULT_MAX_SIZE,
  );
  store.writeCollection('logs', logs);

  return {
    backup,
    logs,
    version: store.getVersion(),
  };
}

function restoreDatabaseBackup(fileName) {
  const backupPath = resolveBackupPath(fileName);
  const backupStore = createMccbStore({
    dbPath: backupPath,
    defaults: DEFAULT_DATA,
  });
  let backupData;

  try {
    backupData = backupStore.readAll();
  } finally {
    backupStore.close();
  }

  const rollbackBackup = store.createBackup({
    backupDir: BACKUP_DIR,
    maxFiles: BACKUP_MAX_FILES,
  });
  const maxLogSize = backupData.logSettings?.maxSize || DEFAULT_MAX_SIZE;
  const logs = createUpdatedLogs(
    LOG_TYPES.SYSTEM,
    `DBをバックアップから復旧しました: ${fileName}（復旧前バックアップ: ${rollbackBackup.fileName}）`,
    backupData.logs,
    maxLogSize,
  );
  const saved = store.saveAll({ ...backupData, logs });

  return {
    data: { ...saved, logs },
    restoredFrom: fileName,
    rollbackBackup,
    backups: listDatabaseBackups(),
    version: store.getVersion() || saved.version,
  };
}

const backupTimers = [];
if (AUTO_BACKUP_ENABLED) {
  if (AUTO_BACKUP_ON_START) {
    const startupBackupTimer = setTimeout(() => {
      try {
        createDatabaseBackup('起動時自動');
      } catch (error) {
        console.error("起動時DBバックアップ作成失敗:", error);
      }
    }, 3000);
    startupBackupTimer.unref?.();
    backupTimers.push(startupBackupTimer);
  }

  const autoBackupTimer = setInterval(() => {
    try {
      createDatabaseBackup('定期自動');
    } catch (error) {
      console.error("定期DBバックアップ作成失敗:", error);
    }
  }, AUTO_BACKUP_INTERVAL_MS);
  autoBackupTimer.unref?.();
  backupTimers.push(autoBackupTimer);
}

function shutdown(signal) {
  console.log(`\n${signal} を受信したため、SQLiteを安全に終了します。`);
  clearInterval(walCheckpointTimer);
  backupTimers.forEach((timer) => clearInterval(timer));
  const closeStoreAndExit = () => {
    store.close();
    process.exit(0);
  };

  if (httpServer) {
    httpServer.close(closeStoreAndExit);
    return;
  }

  closeStoreAndExit();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// ==========================================
// 2. API エンドポイントの定義
// ==========================================

/** 設備マスタ＆ステータスデータの取得 (GET) */
app.get('/api/mccb', (req, res) => {
  try {
    const data = req.query.core === '1' ? store.readCoreData() : store.readAll();
    res.json({ ...data, logs: normalizeLogs(data.logs) });
  } catch (error) {
    console.error("SQLiteデータ読み込み失敗:", error);
    res.status(500).json({ error: 'サーバーデータの読み込みに失敗しました。' });
  }
});

/** データ変更有無だけを確認する軽量エンドポイント */
app.get('/api/mccb/version', (req, res) => {
  try {
    res.json({ version: store.getVersion() });
  } catch (error) {
    console.error("SQLiteバージョン読み込み失敗:", error);
    res.status(500).json({ error: 'サーバーデータの更新番号取得に失敗しました。' });
  }
});

/** システムログのページ取得 */
app.get('/api/logs', (req, res) => {
  try {
    res.json(
      createPage(
        normalizeLogs(store.readCollection('logs')),
        Number(req.query.page || 1),
        Number(req.query.pageSize || 50),
      ),
    );
  } catch (error) {
    console.error("ログページ読み込み失敗:", error);
    res.status(500).json({ error: 'ログ履歴の読み込みに失敗しました。' });
  }
});

/** 完了済み依頼履歴のページ取得 */
app.get('/api/request-history', (req, res) => {
  try {
    res.json(
      store.readCollectionPage(
        'requestHistory',
        Number(req.query.page || 1),
        Number(req.query.pageSize || 20),
      ),
    );
  } catch (error) {
    console.error("依頼履歴ページ読み込み失敗:", error);
    res.status(500).json({ error: '依頼履歴の読み込みに失敗しました。' });
  }
});

/** SQLite DBの手動バックアップ */
app.post('/api/admin/backups', (req, res) => {
  try {
    const { backup, logs, version } = createDatabaseBackup('手動');

    res.json({
      status: 'success',
      backup,
      logs,
      version,
    });
  } catch (error) {
    console.error("DBバックアップ作成失敗:", error);
    res.status(500).json({ error: 'DBバックアップの作成に失敗しました' });
  }
});

/** SQLite DBバックアップ一覧 */
app.get('/api/admin/backups', (req, res) => {
  try {
    res.json({
      status: 'success',
      backups: listDatabaseBackups(),
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("DBバックアップ一覧取得失敗:", error);
    res.status(500).json({ error: 'DBバックアップ一覧の取得に失敗しました' });
  }
});

/** SQLite DBをバックアップから復旧 */
app.post('/api/admin/backups/restore', (req, res) => {
  try {
    const fileName = req.body?.fileName;
    const result = restoreDatabaseBackup(fileName);

    res.json({
      status: 'success',
      ...result,
    });
  } catch (error) {
    console.error("DBバックアップ復旧失敗:", error);
    res.status(500).json({
      error: error.message || 'DBバックアップからの復旧に失敗しました',
    });
  }
});

/** CSV取込による設備マスタ一括上書き */
app.post('/api/admin/mccb-import', (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
    if (!entries) {
      return res.status(400).json({ error: 'CSV取込データが不正です。' });
    }

    const current = store.readAll();
    const mccbList = entries.map((mccb, index) =>
      normalizeMccbForCreate(mccb, index),
    );
    const deviceGroups = Array.isArray(current.deviceGroups)
      ? current.deviceGroups.map((group) => ({ ...group, mccbIds: [] }))
      : [];
    const saved = store.saveAll({ ...current, mccbList, deviceGroups });
    const logs = createUpdatedLogs(
      LOG_TYPES.MASTER_CREATE,
      `CSVから ${mccbList.length} 件の設備データが一括上書きインポートされ、設備グループの紐づけが初期化されました。`,
      store.readCollection('logs'),
      store.readCollection('logSettings')?.maxSize || DEFAULT_MAX_SIZE,
    );
    store.writeCollection('logs', logs);

    res.json({
      status: 'success',
      mccbList: saved.mccbList,
      deviceGroups: saved.deviceGroups,
      logs,
      version: store.getVersion() || saved.version,
    });
  } catch (error) {
    console.error("CSV設備取込失敗:", error);
    res.status(500).json({ error: 'CSV設備データの取り込みに失敗しました' });
  }
});

/** 設備1件のみの軽量更新 (PATCH) */
app.patch('/api/mccb/:id', (req, res) => {
  try {
    const updatedMccb = req.body?.mccb;

    if (!updatedMccb || updatedMccb.id !== req.params.id) {
      return res.status(400).json({ error: '更新対象の設備IDが不正です。' });
    }

    const result = store.updateMccb(updatedMccb);
    if (!result) {
      return res.status(404).json({ error: '更新対象の設備が見つかりません。' });
    }

    const changeLog = createMccbChangeLog(result.before, result.after);
    let logs = store.readCollection('logs');

    if (changeLog) {
      const logSettings = store.readCollection('logSettings');
      logs = createUpdatedLogs(
        changeLog.type,
        changeLog.message,
        logs,
        logSettings?.maxSize || DEFAULT_MAX_SIZE,
      );
      store.writeCollection('logs', logs);
    }

    res.json({
      status: 'success',
      mccb: result.after,
      logs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("SQLite設備更新失敗:", error);
    res.status(500).json({ error: '設備データの更新に失敗しました' });
  }
});

/** 設備の停電・送電状態のみを更新する専用API */
app.patch('/api/mccb/:id/power', (req, res) => {
  try {
    const nextIsPowerOff = req.body?.isPowerOff;
    if (typeof nextIsPowerOff !== 'boolean') {
      return res.status(400).json({ error: '停電・送電状態が不正です。' });
    }

    const target = store.readMccb(req.params.id);
    if (!target) {
      return res.status(404).json({ error: '更新対象の設備が見つかりません。' });
    }

    if (!nextIsPowerOff && hasBorrowedChildCard(target)) {
      return res.status(409).json({ error: '未返却の子札があるため送電できません。' });
    }

    if (target.isPowerOff === nextIsPowerOff) {
      return res.json({
        status: 'success',
        mccb: target,
        logs: normalizeLogs(store.readCollection('logs')),
        version: store.getVersion(),
      });
    }

    const result = store.updateMccb({ ...target, isPowerOff: nextIsPowerOff });
    if (!result) {
      return res.status(404).json({ error: '更新対象の設備が見つかりません。' });
    }

    const changeLog = createMccbChangeLog(result.before, result.after);
    let logs = store.readCollection('logs');
    if (changeLog) {
      const logSettings = store.readCollection('logSettings');
      logs = createUpdatedLogs(
        changeLog.type,
        changeLog.message,
        logs,
        logSettings?.maxSize || DEFAULT_MAX_SIZE,
      );
      store.writeCollection('logs', logs);
    }

    res.json({
      status: 'success',
      mccb: result.after,
      logs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("SQLite設備停電・送電更新失敗:", error);
    res.status(500).json({ error: '停電・送電状態の更新に失敗しました' });
  }
});

/** 設備マスタ1件の新規登録 */
app.post('/api/mccbs', (req, res) => {
  try {
    const mccb = normalizeMccbForCreate(req.body?.mccb);
    if (!mccb.name) {
      return res.status(400).json({ error: '設備データが不正です。' });
    }

    const result = store.createMccb(mccb);
    const logs = createUpdatedLogs(
      LOG_TYPES.MASTER_CREATE,
      `設備「${mccb.name}」が登録されました。`,
      store.readCollection('logs'),
      store.readCollection('logSettings')?.maxSize || DEFAULT_MAX_SIZE,
    );
    store.writeCollection('logs', logs);

    res.json({
      status: 'success',
      mccb: result.mccb,
      logs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("設備登録失敗:", error);
    res.status(500).json({ error: '設備データの登録に失敗しました' });
  }
});

/** 設備マスタ1件の削除 */
app.delete('/api/mccbs/:id', (req, res) => {
  try {
    const result = store.deleteMccb(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '削除対象の設備が見つかりません。' });
    }

    const logs = createUpdatedLogs(
      LOG_TYPES.MASTER_DELETE,
      `設備「${result.deleted.name}」が削除されました。`,
      store.readCollection('logs'),
      store.readCollection('logSettings')?.maxSize || DEFAULT_MAX_SIZE,
    );
    store.writeCollection('logs', logs);

    res.json({
      status: 'success',
      deletedId: result.deleted.id,
      logs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("設備削除失敗:", error);
    res.status(500).json({ error: '設備データの削除に失敗しました' });
  }
});

/** 電気室マスター更新 */
app.patch('/api/admin/rooms', (req, res) => {
  try {
    const rooms = Array.isArray(req.body?.rooms) ? req.body.rooms : null;
    const mccbList = Array.isArray(req.body?.mccbList) ? req.body.mccbList : null;
    if (!rooms || !mccbList) {
      return res.status(400).json({ error: '電気室マスター更新データが不正です。' });
    }

    const mergedMccbList = mergeMccbMasterFields(mccbList, ['room']);
    store.writeMccbs(mergedMccbList);
    store.writeCollection('rooms', rooms);
    res.json({ status: 'success', rooms, mccbList: mergedMccbList, version: store.getVersion() });
  } catch (error) {
    console.error("電気室マスター更新失敗:", error);
    res.status(500).json({ error: '電気室マスターの更新に失敗しました' });
  }
});

/** 区分マスター更新 */
app.patch('/api/admin/categories', (req, res) => {
  try {
    const categories = Array.isArray(req.body?.categories) ? req.body.categories : null;
    const mccbList = Array.isArray(req.body?.mccbList) ? req.body.mccbList : null;
    const incomingCategoryColors =
      req.body?.categoryColors && typeof req.body.categoryColors === 'object'
        ? req.body.categoryColors
        : store.readCollection('categoryColors');
    if (!categories || !mccbList) {
      return res.status(400).json({ error: '区分マスター更新データが不正です。' });
    }

    const categoryColors = normalizeCategoryColors(categories, incomingCategoryColors);
    const mergedMccbList = mergeMccbMasterFields(mccbList, ['category']);
    store.writeMccbs(mergedMccbList);
    store.writeCollections({ categories, categoryColors });
    res.json({
      status: 'success',
      categories,
      categoryColors,
      mccbList: mergedMccbList,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("区分マスター更新失敗:", error);
    res.status(500).json({ error: '区分マスターの更新に失敗しました' });
  }
});

/** 区分色マスター更新 */
app.patch('/api/admin/category-colors', (req, res) => {
  try {
    const categoryColors =
      req.body?.categoryColors && typeof req.body.categoryColors === 'object'
        ? req.body.categoryColors
        : null;
    if (!categoryColors) {
      return res.status(400).json({ error: '区分色マスター更新データが不正です。' });
    }

    const categories = store.readCollection('categories');
    const normalizedCategoryColors = normalizeCategoryColors(categories, categoryColors);
    store.writeCollection('categoryColors', normalizedCategoryColors);

    const logs = createUpdatedLogs(
      LOG_TYPES.MASTER_UPDATE,
      '区分マスターの表示色を更新しました。',
      store.readCollection('logs'),
      store.readCollection('logSettings')?.maxSize || DEFAULT_MAX_SIZE,
    );
    store.writeCollection('logs', logs);

    res.json({
      status: 'success',
      categoryColors: normalizedCategoryColors,
      logs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("区分色マスター更新失敗:", error);
    res.status(500).json({ error: '区分色マスターの更新に失敗しました' });
  }
});

/** 設備グループマスター更新 */
app.patch('/api/admin/device-groups', (req, res) => {
  try {
    const deviceGroups = Array.isArray(req.body?.deviceGroups)
      ? req.body.deviceGroups
      : null;
    if (!deviceGroups) {
      return res.status(400).json({ error: '設備グループ更新データが不正です。' });
    }

    store.writeCollection('deviceGroups', deviceGroups);
    let logs = null;
    if (req.body?.logMessage) {
      logs = createUpdatedLogs(
        req.body.logType || LOG_TYPES.MASTER_UPDATE,
        req.body.logMessage,
        store.readCollection('logs'),
        store.readCollection('logSettings')?.maxSize || DEFAULT_MAX_SIZE,
      );
      store.writeCollection('logs', logs);
    }
    res.json({ status: 'success', deviceGroups, logs, version: store.getVersion() });
  } catch (error) {
    console.error("設備グループ更新失敗:", error);
    res.status(500).json({ error: '設備グループの更新に失敗しました' });
  }
});

/** ログ保持設定・ログクリア */
app.patch('/api/admin/logs', (req, res) => {
  try {
    const action = req.body?.action;
    const currentLogs = store.readCollection('logs');
    const currentSettings = store.readCollection('logSettings');
    let logs = currentLogs;
    let logSettings = currentSettings;

    if (action === 'clear') {
      logs = [
        {
          id: `LOG-${Date.now()}`,
          timestamp: getTimestamp(),
          type: LOG_TYPES.SYSTEM,
          message: "ログ履歴がクリアされました。",
        },
      ];
    } else if (action === 'setMaxSize') {
      const maxSize = Number(req.body?.maxSize);
      if (!maxSize) {
        return res.status(400).json({ error: 'ログ保持件数が不正です。' });
      }
      logSettings = { ...currentSettings, maxSize };
      logs = createUpdatedLogs(
        LOG_TYPES.SYSTEM,
        `ログ保持件数変更`,
        currentLogs.slice(0, maxSize),
        maxSize,
      );
    } else {
      return res.status(400).json({ error: 'ログ管理操作が不正です。' });
    }

    store.writeCollections({ logs, logSettings });
    res.json({ status: 'success', logs, logSettings, version: store.getVersion() });
  } catch (error) {
    console.error("ログ管理更新失敗:", error);
    res.status(500).json({ error: 'ログ管理の更新に失敗しました' });
  }
});

/** 依頼履歴保持設定・履歴クリア */
app.patch('/api/admin/request-history', (req, res) => {
  try {
    const action = req.body?.action;
    const currentHistory = store.readCollection('requestHistory');
    const currentSettings = store.readCollection('historySettings');
    const currentLogs = store.readCollection('logs');
    const logSettings = store.readCollection('logSettings');
    let requestHistory = currentHistory;
    let historySettings = currentSettings;

    if (action === 'clear') {
      requestHistory = [];
    } else if (action === 'setMaxSize') {
      const maxSize = Number(req.body?.maxSize);
      if (!maxSize) {
        return res.status(400).json({ error: '依頼履歴保持件数が不正です。' });
      }
      historySettings = { maxSize };
      requestHistory = currentHistory.slice(0, maxSize);
    } else {
      return res.status(400).json({ error: '依頼履歴管理操作が不正です。' });
    }

    const logs = createUpdatedLogs(
      LOG_TYPES.SYSTEM,
      action === 'clear'
        ? "停電作業の依頼履歴がすべてクリアされました。"
        : `最大依頼履歴数が ${historySettings.maxSize} 件に変更されました。`,
      currentLogs,
      logSettings?.maxSize || DEFAULT_MAX_SIZE,
    );

    store.writeCollections({ requestHistory, historySettings, logs });
    res.json({
      status: 'success',
      requestHistory,
      historySettings,
      logs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("依頼履歴管理更新失敗:", error);
    res.status(500).json({ error: '依頼履歴管理の更新に失敗しました' });
  }
});

/** 停電作業依頼の発行と子札予約 */
app.post('/api/requests/preview', (req, res) => {
  try {
    const previewRequest = req.body?.request;
    if (!previewRequest || !Array.isArray(previewRequest.targetMccbIds)) {
      return res.status(400).json({ error: '依頼プレビューデータが不正です。' });
    }

    const { finalRequest, currentMccbList } = requestAssignmentService.buildRequestAssignment(previewRequest);

    res.json({
      status: 'success',
      request: finalRequest,
      previewItems: requestAssignmentService.buildRequestPreviewItems(finalRequest, currentMccbList),
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("停電作業依頼プレビュー作成失敗", error);
    res.status(500).json({ error: '停電作業依頼プレビューの作成に失敗しました' });
  }
});

app.post('/api/requests', (req, res) => {
  try {
    const newRequest = req.body?.request;
    if (!newRequest || !Array.isArray(newRequest.targetMccbIds)) {
      return res.status(400).json({ error: '依頼データが不正です。' });
    }

    const logsBefore = store.readCollection('logs');
    const logSettings = store.readCollection('logSettings');
    const {
      currentRequests,
      beforeMccbList,
      currentMccbList,
      finalRequest,
    } = requestAssignmentService.buildRequestAssignment(newRequest);

    const requests = [finalRequest, ...currentRequests];
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${newRequest.workerName}氏の停電依頼を発行し\n子札を貸出予約しました。`,
      logsBefore,
      logSettings?.maxSize || DEFAULT_MAX_SIZE,
    );
    const changedMccbs = preservePowerStateForRequestChanges(
      beforeMccbList,
      getChangedMccbs(beforeMccbList, currentMccbList),
    );

    store.writeMccbs(changedMccbs);
    store.writeCollection('requests', requests);
    store.writeCollection('logs', logs);

    res.json({
      status: 'success',
      request: finalRequest,
      requests,
      logs,
      changedMccbs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("停電作業依頼発行失敗:", error);
    res.status(500).json({ error: '停電作業依頼の発行に失敗しました' });
  }
});

/** 停電作業依頼の仮発行（子札は確保しない） */
app.post('/api/draft-requests', (req, res) => {
  try {
    const draftRequest = req.body?.request;
    if (!draftRequest || !Array.isArray(draftRequest.targetMccbIds)) {
      return res.status(400).json({ error: '仮発行依頼データが不正です。' });
    }

    const currentDrafts = store.readCollection('draftRequests') || [];
    const logsBefore = store.readCollection('logs');
    const logSettings = store.readCollection('logSettings');
    const finalDraft = {
      ...draftRequest,
      id: `DRAFT-${Date.now()}`,
      timestamp: getTimestamp(),
      reservedCards: undefined,
    };
    const draftRequests = [finalDraft, ...currentDrafts];
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${finalDraft.workerName || "作業者"}氏の停電依頼を仮発行しました。`,
      logsBefore,
      logSettings?.maxSize || DEFAULT_MAX_SIZE,
    );

    store.writeCollections({ draftRequests, logs });

    res.json({
      status: 'success',
      draftRequest: finalDraft,
      draftRequests,
      logs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("停電作業依頼仮発行失敗:", error);
    res.status(500).json({ error: '停電作業依頼の仮発行に失敗しました' });
  }
});

/** 仮発行依頼を本発行し、現在の空き子札で割当する */
app.post('/api/draft-requests/:id/issue', (req, res) => {
  try {
    const currentDrafts = store.readCollection('draftRequests') || [];
    const draftToIssue = currentDrafts.find((request) => request.id === req.params.id);

    if (!draftToIssue) {
      return res.status(404).json({ error: '対象の仮発行依頼が見つかりません。' });
    }

    const newRequest = createIssueRequestFromDraft(draftToIssue);
    const logsBefore = store.readCollection('logs');
    const logSettings = store.readCollection('logSettings');
    const {
      currentRequests,
      beforeMccbList,
      currentMccbList,
      finalRequest,
    } = requestAssignmentService.buildRequestAssignment(newRequest);

    const requests = [finalRequest, ...currentRequests];
    const draftRequests = currentDrafts.filter((request) => request.id !== req.params.id);
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${newRequest.workerName || "作業者"}氏の仮発行依頼を本発行し\n子札を貸出予約しました。`,
      logsBefore,
      logSettings?.maxSize || DEFAULT_MAX_SIZE,
    );
    const changedMccbs = preservePowerStateForRequestChanges(
      beforeMccbList,
      getChangedMccbs(beforeMccbList, currentMccbList),
    );

    store.writeMccbs(changedMccbs);
    store.writeCollections({ requests, draftRequests, logs });

    res.json({
      status: 'success',
      request: finalRequest,
      requests,
      draftRequests,
      logs,
      changedMccbs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("仮発行依頼の本発行失敗:", error);
    res.status(500).json({ error: '仮発行依頼の本発行に失敗しました' });
  }
});

/** 仮発行依頼の削除 */
app.delete('/api/draft-requests/:id', (req, res) => {
  try {
    const currentDrafts = store.readCollection('draftRequests') || [];
    const draftToDelete = currentDrafts.find((request) => request.id === req.params.id);

    if (!draftToDelete) {
      return res.status(404).json({ error: '対象の仮発行依頼が見つかりません。' });
    }

    const logsBefore = store.readCollection('logs');
    const logSettings = store.readCollection('logSettings');
    const draftRequests = currentDrafts.filter((request) => request.id !== req.params.id);
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${draftToDelete.workerName || "作業者"}氏の仮発行依頼を削除しました。`,
      logsBefore,
      logSettings?.maxSize || DEFAULT_MAX_SIZE,
    );

    store.writeCollections({ draftRequests, logs });

    res.json({
      status: 'success',
      draftRequests,
      logs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("仮発行依頼削除失敗:", error);
    res.status(500).json({ error: '仮発行依頼の削除に失敗しました' });
  }
});

/** 発行済み停電作業依頼への対象設備追加 */
app.patch('/api/requests/:id/targets', (req, res) => {
  try {
    const targetMccbIds = Array.isArray(req.body?.targetMccbIds)
      ? req.body.targetMccbIds
      : null;
    const dummyNames =
      req.body?.dummyNames && typeof req.body.dummyNames === 'object'
        ? req.body.dummyNames
        : {};

    if (!targetMccbIds) {
      return res.status(400).json({ error: '追加する設備データが不正です。' });
    }

    const currentRequests = store.readCollection('requests') || [];
    const targetRequest = currentRequests.find(
      (request) => request.id === req.params.id,
    );

    if (!targetRequest) {
      return res.status(404).json({ error: '対象の依頼が見つかりません。' });
    }

    const addition = requestAssignmentService.buildRequestTargetAddition(
      targetRequest,
      targetMccbIds,
      dummyNames,
    );

    if (!addition) {
      return res.status(400).json({ error: '追加可能な設備が選択されていません。' });
    }

    const logsBefore = store.readCollection('logs');
    const logSettings = store.readCollection('logSettings');
    const requests = currentRequests.map((request) =>
      request.id === targetRequest.id ? addition.updatedRequest : request,
    );
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${targetRequest.workerName || "作業者"}氏の停電依頼に ${addition.additionalTargetIds.length} 件の設備を追加し\n子札を貸出予約しました。`,
      logsBefore,
      logSettings?.maxSize || DEFAULT_MAX_SIZE,
    );
    const changedMccbs = preservePowerStateForRequestChanges(
      addition.beforeMccbList,
      getChangedMccbs(addition.beforeMccbList, addition.currentMccbList),
    );

    store.writeMccbs(changedMccbs);
    store.writeCollection('requests', requests);
    store.writeCollection('logs', logs);

    res.json({
      status: 'success',
      request: addition.updatedRequest,
      requests,
      logs,
      changedMccbs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("停電作業依頼への設備追加失敗:", error);
    res.status(500).json({ error: '停電作業依頼への設備追加に失敗しました' });
  }
});

/** 発行中依頼の対象設備ごとの子札を一時返却・再貸出 */
app.patch('/api/requests/:id/targets/:targetId/card', (req, res) => {
  try {
    const action = req.body?.action;
    if (!["return", "borrow"].includes(action)) {
      return res.status(400).json({ error: '子札操作が不正です。' });
    }

    const currentRequests = store.readCollection('requests') || [];
    const targetRequest = currentRequests.find((request) => request.id === req.params.id);
    if (!targetRequest) {
      return res.status(404).json({ error: '対象の依頼が見つかりません。' });
    }

    const reserveInfo = targetRequest.reservedCards?.[req.params.targetId];
    if (!reserveInfo?.actualMccbId || !reserveInfo?.cardNo) {
      return res.status(400).json({ error: '操作できる確保札がありません。' });
    }

    const beforeMccbList = store.readMccbsByIds([reserveInfo.actualMccbId]);
    let currentMccbList = cloneMccbListForMutation(beforeMccbList);
    let operated = false;
    let blockedByOtherWorker = false;

    currentMccbList = currentMccbList.map((mccb) => {
      if (mccb.id !== reserveInfo.actualMccbId || !Array.isArray(mccb.childCards)) {
        return mccb;
      }

      const cardIdx = mccb.childCards.findIndex((card) => card.id === reserveInfo.cardNo);
      if (cardIdx === -1) return mccb;

      const card = mccb.childCards[cardIdx];
      const updatedCards = [...mccb.childCards];
      if (action === "return") {
        if (!card.isBorrowed) return mccb;
        if (card.workerName && card.workerName !== targetRequest.workerName) {
          blockedByOtherWorker = true;
          return mccb;
        }
        updatedCards[cardIdx] = { ...card, isBorrowed: false, workerName: "" };
      } else {
        if (card.isBorrowed) {
          if (card.workerName !== targetRequest.workerName) blockedByOtherWorker = true;
          return mccb;
        }
        updatedCards[cardIdx] = {
          ...card,
          isBorrowed: true,
          workerName: targetRequest.workerName || "",
        };
      }
      operated = true;
      return { ...mccb, childCards: updatedCards };
    });

    if (blockedByOtherWorker) {
      return res.status(409).json({ error: '別作業者が使用中の子札は操作できません。' });
    }

    const logsBefore = store.readCollection('logs');
    const logSettings = store.readCollection('logSettings');
    const changedMccbs = preservePowerStateForRequestChanges(
      beforeMccbList,
      getChangedMccbs(beforeMccbList, currentMccbList),
    );
    const logs = operated
      ? createUpdatedLogs(
          LOG_TYPES.CARD_LOAN,
          `👷 ${targetRequest.workerName || "作業者"}氏の停電依頼で ${reserveInfo.displayName} No.${reserveInfo.cardNo} を${action === "return" ? "一時返却" : "再貸出"}しました。`,
          logsBefore,
          logSettings?.maxSize || DEFAULT_MAX_SIZE,
        )
      : logsBefore;

    store.writeMccbs(changedMccbs);
    if (operated) store.writeCollection('logs', logs);

    res.json({
      status: 'success',
      requests: currentRequests,
      logs,
      changedMccbs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("停電作業依頼の子札操作失敗:", error);
    res.status(500).json({ error: '停電作業依頼の子札操作に失敗しました' });
  }
});

/** 停電作業依頼の完了・解約と子札返却 */
app.delete('/api/requests/:id', (req, res) => {
  try {
    const currentRequests = store.readCollection('requests') || [];
    const currentHistory = store.readCollection('requestHistory') || [];
    const historySettings = store.readCollection('historySettings');
    const logsBefore = store.readCollection('logs');
    const logSettings = store.readCollection('logSettings');
    const reqToDelete = currentRequests.find((request) => request.id === req.params.id);

    if (!reqToDelete) {
      return res.status(404).json({ error: '対象の依頼が見つかりません。' });
    }

    const affectedMccbIds = Object.values(reqToDelete.reservedCards || {})
      .map((resInfo) => resInfo?.actualMccbId)
      .filter(Boolean);
    const beforeMccbList = store.readMccbsByIds(affectedMccbIds);
    let currentMccbList = cloneMccbListForMutation(beforeMccbList);

    if (reqToDelete.reservedCards) {
      Object.keys(reqToDelete.reservedCards).forEach((targetId) => {
        const resInfo = reqToDelete.reservedCards[targetId];
        if (resInfo?.actualMccbId && resInfo?.cardNo) {
          currentMccbList = currentMccbList.map((mccb) => {
            if (mccb.id === resInfo.actualMccbId && mccb.childCards) {
              const cardIdx = mccb.childCards.findIndex(
                (card) => card.id === resInfo.cardNo,
              );
              if (cardIdx !== -1) {
                const card = mccb.childCards[cardIdx];
                if (card.workerName === reqToDelete.workerName) {
                  const updatedCards = [...mccb.childCards];
                  updatedCards[cardIdx] = {
                    ...card,
                    isBorrowed: false,
                    workerName: "",
                  };
                  return { ...mccb, childCards: updatedCards };
                }
              }
            }
            return mccb;
          });
        }
      });
    }

    const completedRequest = {
      ...reqToDelete,
      completedTimestamp: getTimestamp(),
    };
    const requests = currentRequests.filter((request) => request.id !== req.params.id);
    const maxHistorySize = historySettings?.maxSize || DEFAULT_MAX_SIZE;
    const requestHistory = [completedRequest, ...currentHistory].slice(0, maxHistorySize);
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${reqToDelete.workerName || "作業者"}氏の作業完了に伴い\n子札が返却されました。`,
      logsBefore,
      logSettings?.maxSize || DEFAULT_MAX_SIZE,
    );
    const changedMccbs = preservePowerStateForRequestChanges(
      beforeMccbList,
      getChangedMccbs(beforeMccbList, currentMccbList),
    );

    store.writeMccbs(changedMccbs);
    store.writeCollection('requests', requests);
    store.writeCollection('requestHistory', requestHistory);
    store.writeCollection('logs', logs);

    res.json({
      status: 'success',
      requests,
      requestHistory,
      logs,
      changedMccbs,
      version: store.getVersion(),
    });
  } catch (error) {
    console.error("停電作業依頼完了失敗:", error);
    res.status(500).json({ error: '停電作業依頼の完了処理に失敗しました' });
  }
});

// ==========================================
// 3. 静的ファイル配信・SPAキャッチオールルーティング
// ==========================================

// ビルドされた React アプリ (Vite等) の dist ディレクトリを静的ファイルとして配信
app.use(express.static(path.join(__dirname, 'dist')));

// Express v5 仕様: API以外のURLリクエストをすべてフロントエンドの index.html へ流す (SPA用)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==========================================
// 4. サーバーの起動
// ==========================================
httpServer = app.listen(PORT, HOST, () => {
  const localIp = getLocalIpAddress();
  console.log(`==================================================`);
  console.log(` 🚀 禁止札データ(SQLite) ＆ Webサーバーが一体型で正常稼働しました`);
  console.log(` 🌐 待受: http://${HOST}:${PORT}`);
  console.log(` 🌐 LAN接続URL目安: http://${localIp}:${PORT}`);
  console.log(` 💾 DB: ${DB_PATH}`);
  console.log(`==================================================`);
});

httpServer.on('error', (error) => {
  console.error("Webサーバー起動失敗:", error);
  process.exit(1);
});
