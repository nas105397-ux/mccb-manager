import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path'; 
import os from 'os'; 
import { fileURLToPath } from 'url';
import { createMccbStore } from './dbStore.js';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MAX_SIZE,
  DEFAULT_ROOMS,
  LOG_TYPES,
} from './src/shared/appConstants.js';

const app = express();

// --- ミドルウェア設定 ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ESモジュール環境用の __dirname 互換定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const FILE_PATH = path.join(DATA_DIR, 'mccb_data.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const LEGACY_JSON_PATH = path.join(__dirname, 'mccb_data.json');
const LEGACY_DB_PATH = path.join(__dirname, 'mccb_data.sqlite');
const DB_PATH = process.env.MCCB_DB_PATH || path.join(DATA_DIR, 'mccb_data.sqlite');
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

  if (!fs.existsSync(FILE_PATH) && fs.existsSync(LEGACY_JSON_PATH)) {
    fs.copyFileSync(LEGACY_JSON_PATH, FILE_PATH);
  }

  if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
    fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);

    for (const suffix of ['-wal', '-shm']) {
      const legacySidecar = `${LEGACY_DB_PATH}${suffix}`;
      if (fs.existsSync(legacySidecar)) {
        fs.copyFileSync(legacySidecar, `${DB_PATH}${suffix}`);
      }
    }
  }
}

// マスタデータ初期化用デフォルト値
const DEFAULT_MCCB = [
  { 
    id: "SAMPLE-1", 
    room: DEFAULT_ROOMS[0], 
    category: DEFAULT_CATEGORIES[0], 
    name: "No.1加熱炉 送風ファン用MCCB", 
    isPowerOff: false, 
    isFavorite: false, 
    childCards: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, isBorrowed: false, workerName: '' })) 
  }
];

const DEFAULT_DATA = {
  mccbList: DEFAULT_MCCB,
  rooms: DEFAULT_ROOMS,
  categories: DEFAULT_CATEGORIES,
  logs: [{ id: "INIT", timestamp: getTimestamp(), type: LOG_TYPES.SYSTEM, message: "システムログ機能が初期化されました。" }],
  logSettings: { maxSize: DEFAULT_MAX_SIZE },
  requests: [],
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
  return [newLog, ...currentLogs].slice(0, maxSize);
}

function countBorrowedCards(mccb) {
  return mccb?.childCards?.filter((card) => card.isBorrowed).length || 0;
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

const isDummyMccb = (mccb) =>
  mccb?.isDummy || mccb?.name?.includes("ダミー") || mccb?.id?.includes("DUMMY");

const hasBorrowedChildCard = (mccb) =>
  mccb?.childCards?.some((card) => card.isBorrowed) ?? false;

const findFirstFreeChildCardIndex = (mccb) =>
  mccb?.childCards?.findIndex((card) => !card.isBorrowed) ?? -1;

const compareMccbNameNumeric = (a, b) =>
  (a.name || "").localeCompare(b.name || "", "ja", { numeric: true });

function getAvailableDummyCandidates(targetMccb, currentMccbList) {
  const availableDummies = currentMccbList.filter(
    (mccb) => isDummyMccb(mccb) && !hasBorrowedChildCard(mccb),
  );
  const sameRoom = availableDummies
    .filter((mccb) => mccb.room === targetMccb.room)
    .sort(compareMccbNameNumeric);
  const otherRooms = availableDummies
    .filter((mccb) => mccb.room !== targetMccb.room)
    .sort((a, b) => {
      if (a.name === "ダミー0" && b.name !== "ダミー0") return -1;
      if (a.name !== "ダミー0" && b.name === "ダミー0") return 1;
      return compareMccbNameNumeric(a, b);
    });

  return [...sameRoom, ...otherRooms];
}

function findExistingDummyAssignment(targetId, currentRequests, currentMccbList) {
  for (const request of currentRequests) {
    const reservedInfo = request.reservedCards?.[targetId];
    if (!reservedInfo?.actualMccbId || reservedInfo.actualMccbId === targetId) {
      continue;
    }

    const assignedMccb = currentMccbList.find(
      (mccb) => mccb.id === reservedInfo.actualMccbId,
    );
    if (!isDummyMccb(assignedMccb)) {
      continue;
    }

    const availableIdx = findFirstFreeChildCardIndex(assignedMccb);
    if (availableIdx !== -1) {
      return { finalMccb: assignedMccb, availableIdx };
    }
  }

  return null;
}

function findAvailableCard(targetId, targetMccb, currentMccbList, currentRequests) {
  const isOriginalDummy = isDummyMccb(targetMccb);

  if (!isOriginalDummy) {
    const existingDummy = findExistingDummyAssignment(
      targetId,
      currentRequests,
      currentMccbList,
    );
    if (existingDummy) {
      return existingDummy;
    }
  }

  const ownCardIdx = findFirstFreeChildCardIndex(targetMccb);
  if (ownCardIdx !== -1) {
    return { finalMccb: targetMccb, availableIdx: ownCardIdx };
  }
  if (isOriginalDummy) {
    return { finalMccb: null, availableIdx: -1 };
  }

  for (const dummy of getAvailableDummyCandidates(targetMccb, currentMccbList)) {
    const idx = findFirstFreeChildCardIndex(dummy);
    if (idx !== -1) {
      return { finalMccb: dummy, availableIdx: idx };
    }
  }

  return { finalMccb: null, availableIdx: -1 };
}

function cloneMccbListForMutation(mccbList) {
  return mccbList.map((mccb) => ({
    ...mccb,
    childCards: Array.isArray(mccb.childCards)
      ? mccb.childCards.map((card) => ({ ...card }))
      : [],
  }));
}

function dedupeMccbs(mccbList) {
  return [...new Map(mccbList.map((mccb) => [mccb.id, mccb])).values()];
}

function getChangedMccbs(beforeList, afterList) {
  const beforeById = new Map(beforeList.map((mccb) => [mccb.id, mccb]));
  return afterList.filter((mccb) => {
    const before = beforeById.get(mccb.id);
    return JSON.stringify(before?.childCards || []) !== JSON.stringify(mccb.childCards || []);
  });
}

function getDateCode(date = new Date()) {
  return `${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function buildRequestAssignment(newRequest) {
  const currentRequests = store.readCollection('requests') || [];
  const targetMccbs = store.readMccbsByIds(newRequest.targetMccbIds);
  const dummyMccbs = store.readDummyMccbs();
  const beforeMccbList = dedupeMccbs([...targetMccbs, ...dummyMccbs]);
  let currentMccbList = cloneMccbListForMutation(beforeMccbList);

  const actualReservations = new Map();
  currentRequests.forEach((request) => {
    if (!request.reservedCards) return;
    Object.entries(request.reservedCards).forEach(([, resInfo]) => {
      if (!resInfo || !resInfo.actualMccbId) return;
      const actualId = resInfo.actualMccbId;
      if (!actualReservations.has(actualId)) {
        actualReservations.set(actualId, new Map());
      }
      const cardMap = actualReservations.get(actualId);
      if (resInfo.cardNo != null) {
        cardMap.set(resInfo.cardNo, request.workerName);
      }
    });
  });

  currentMccbList = currentMccbList.map((mccb) => {
    const cardMap = actualReservations.get(mccb.id);
    const updatedCards = mccb.childCards.map((card) => {
      if (cardMap && cardMap.has(card.id)) {
        return {
          ...card,
          isBorrowed: true,
          workerName: cardMap.get(card.id) || "",
        };
      }
      return {
        ...card,
        isBorrowed: !!card.isBorrowed,
        workerName: card.workerName || "",
      };
    });
    return { ...mccb, childCards: updatedCards };
  });

  const reservedCards = {};
  for (const targetId of newRequest.targetMccbIds) {
    const originalMccb = currentMccbList.find((mccb) => mccb.id === targetId);
    if (!originalMccb) {
      reservedCards[targetId] = {
        actualMccbId: null,
        cardNo: null,
        displayName: "空きなし",
        customDummyName: null,
      };
      continue;
    }

    const { finalMccb, availableIdx } = findAvailableCard(
      targetId,
      originalMccb,
      currentMccbList,
      currentRequests,
    );

    if (finalMccb && availableIdx !== -1) {
      currentMccbList = currentMccbList.map((mccb) => {
        if (mccb.id === finalMccb.id) {
          const updatedCards = [...mccb.childCards];
          updatedCards[availableIdx] = {
            ...updatedCards[availableIdx],
            isBorrowed: true,
            workerName: newRequest.workerName,
          };
          return { ...mccb, childCards: updatedCards };
        }
        return mccb;
      });

      const assignedCardNo =
        finalMccb.childCards[availableIdx]?.id ?? availableIdx + 1;

      reservedCards[targetId] = {
        actualMccbId: finalMccb.id,
        cardNo: assignedCardNo,
        displayName: finalMccb.name,
        customDummyName: newRequest.dummyNames?.[targetId] || null,
      };
    } else {
      reservedCards[targetId] = {
        actualMccbId: null,
        cardNo: null,
        displayName: "空きなし",
        customDummyName: null,
      };
    }
  }

  return {
    currentRequests,
    beforeMccbList,
    currentMccbList,
    finalRequest: { ...newRequest, reservedCards },
  };
}

function buildRequestPreviewItems(finalRequest, assignmentMccbList) {
  const mccbById = new Map(assignmentMccbList.map((mccb) => [mccb.id, mccb]));
  const dateCode = getDateCode();

  return (finalRequest.targetMccbIds || [])
    .map((targetId) => {
      const originalMccb = mccbById.get(targetId);
      const reserveInfo = finalRequest.reservedCards?.[targetId];
      const actualMccb = reserveInfo?.actualMccbId
        ? mccbById.get(reserveInfo.actualMccbId)
        : null;

      if (!originalMccb && !reserveInfo) return null;

      const finalMccb = actualMccb || originalMccb;
      const isOriginalDummy = isDummyMccb(originalMccb);
      const isAllocatedFromDummy =
        !!actualMccb && !!originalMccb && actualMccb.id !== originalMccb.id;
      const cardNo = reserveInfo?.cardNo ?? 1;

      let name = originalMccb?.name || reserveInfo?.displayName || "空きなし";
      if (isOriginalDummy && reserveInfo?.customDummyName) {
        name = `${originalMccb.name} (${reserveInfo.customDummyName})`;
      } else if (isAllocatedFromDummy) {
        name = `${actualMccb.name} (${originalMccb.name})`;
      }

      const cardLabel = isAllocatedFromDummy
        ? `代替:${actualMccb.name} No.${cardNo}`
        : `子札 No.${cardNo}`;
      const generatedCardNo = finalMccb
        ? `${dateCode}-${finalMccb.id.slice(-4)}-${cardNo}`
        : `${dateCode}-NONE-${cardNo}`;

      return {
        ...(originalMccb || {}),
        id: targetId,
        room: originalMccb?.room || finalMccb?.room || "",
        name,
        cardLabel,
        generatedCardNo,
        isDummy: isAllocatedFromDummy || isOriginalDummy,
        allocatedDummyName: actualMccb?.name || null,
        reserveInfo,
      };
    })
    .filter(Boolean);
}

ensureDefaultDatabasePath();

const store = createMccbStore({
  dbPath: DB_PATH,
  jsonPath: FILE_PATH,
  defaults: DEFAULT_DATA,
});

store.checkpointWal({ force: true, mode: 'TRUNCATE' });

const walCheckpointTimer = setInterval(() => {
  store.checkpointWal({ mode: 'PASSIVE' });
}, WAL_CHECKPOINT_INTERVAL_MS);
walCheckpointTimer.unref?.();

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
  store.close();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// ==========================================
// 2. API エンドポイントの定義
// ==========================================

/** 設備マスタ＆ステータスデータの取得 (GET) */
app.get('/api/mccb', (req, res) => {
  try {
    res.json(req.query.core === '1' ? store.readCoreData() : store.readAll());
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
      store.readCollectionPage(
        'logs',
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

/** 設備マスタ＆ステータスデータの保存更新 (POST) */
app.post('/api/mccb', (req, res) => {
  try {
    const saved = store.saveAll(req.body);
    let logs = null;
    if (req.body?.logMessage) {
      logs = createUpdatedLogs(
        req.body.logType || LOG_TYPES.SYSTEM,
        req.body.logMessage,
        store.readCollection('logs'),
        store.readCollection('logSettings')?.maxSize || DEFAULT_MAX_SIZE,
      );
      store.writeCollection('logs', logs);
    }

    res.json({ status: 'success', logs, version: store.getVersion() || saved.version });
  } catch (error) {
    console.error("SQLiteデータ書き込み失敗:", error);
    res.status(500).json({ error: 'データベースの書き込みに失敗しました' });
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

/** 設備マスタ1件の新規登録 */
app.post('/api/mccbs', (req, res) => {
  try {
    const mccb = req.body?.mccb;
    if (!mccb?.id) {
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

    store.writeMccbs(mccbList);
    store.writeCollection('rooms', rooms);
    res.json({ status: 'success', rooms, mccbList, version: store.getVersion() });
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
    if (!categories || !mccbList) {
      return res.status(400).json({ error: '区分マスター更新データが不正です。' });
    }

    store.writeMccbs(mccbList);
    store.writeCollection('categories', categories);
    res.json({ status: 'success', categories, mccbList, version: store.getVersion() });
  } catch (error) {
    console.error("区分マスター更新失敗:", error);
    res.status(500).json({ error: '区分マスターの更新に失敗しました' });
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

    const { finalRequest, currentMccbList } = buildRequestAssignment(previewRequest);

    res.json({
      status: 'success',
      request: finalRequest,
      previewItems: buildRequestPreviewItems(finalRequest, currentMccbList),
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
    } = buildRequestAssignment(newRequest);

    const requests = [finalRequest, ...currentRequests];
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${newRequest.workerName}氏の停電依頼を発行し\n子札を貸出予約しました。`,
      logsBefore,
      logSettings?.maxSize || DEFAULT_MAX_SIZE,
    );
    const changedMccbs = getChangedMccbs(beforeMccbList, currentMccbList);

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
    const changedMccbs = getChangedMccbs(beforeMccbList, currentMccbList);

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
app.listen(PORT, () => {
  const localIp = getLocalIpAddress();
  console.log(`==================================================`);
  console.log(` 🚀 禁止札データ(SQLite) ＆ Webサーバーが一体型で正常稼働しました`);
  console.log(` 🌐 接続URL: http://${localIp}:${PORT}`);
  console.log(` 💾 DB: ${DB_PATH}`);
  console.log(`==================================================`);
});
