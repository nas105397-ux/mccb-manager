import express from 'express';
import cors from 'cors';
import path from 'path'; 
import os from 'os'; 
import { fileURLToPath } from 'url';
import { createMccbStore } from './dbStore.js';

const app = express();

// --- ミドルウェア設定 ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ESモジュール環境用の __dirname 互換定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_PATH = path.join(__dirname, 'mccb_data.json');
const DB_PATH = process.env.MCCB_DB_PATH || path.join(__dirname, 'mccb_data.sqlite');
const PORT = process.env.PORT || 5000;

// マスタデータ初期化用デフォルト値
const DEFAULT_MCCB = [
  { 
    id: "SAMPLE-1", 
    room: "1階高圧電気室", 
    category: "1スト", 
    name: "No.1加熱炉 送風ファン用MCCB", 
    isPowerOff: false, 
    isFavorite: false, 
    childCards: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, isBorrowed: false, workerName: '' })) 
  }
];

const DEFAULT_ROOMS = ['1階高圧電気室', '1階電気室', '2階電気室', '2次トーチ電気室', 'LT-UT電気室', '水処理電気室'];
const DEFAULT_CATEGORIES = ['1スト', '2スト', '3スト', '4スト', '5スト', '6スト', '共通'];
const LOG_TYPES = Object.freeze({
  OPERATION: "操作",
  CARD_LOAN: "札貸出",
  MASTER_CREATE: "マスタ登録",
  MASTER_UPDATE: "マスタ編集",
});
const DEFAULT_DATA = {
  mccbList: DEFAULT_MCCB,
  rooms: DEFAULT_ROOMS,
  categories: DEFAULT_CATEGORIES,
  logs: [{ id: "INIT", timestamp: getTimestamp(), type: "システム", message: "システムログ機能が初期化されました。" }],
  logSettings: { maxSize: 500 },
  requests: [],
  deviceGroups: [],
  requestHistory: [],
  historySettings: { maxSize: 500 }
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

function getChangedMccbs(beforeList, afterList) {
  const beforeById = new Map(beforeList.map((mccb) => [mccb.id, mccb]));
  return afterList.filter((mccb) => {
    const before = beforeById.get(mccb.id);
    return JSON.stringify(before?.childCards || []) !== JSON.stringify(mccb.childCards || []);
  });
}

const store = createMccbStore({
  dbPath: DB_PATH,
  jsonPath: FILE_PATH,
  defaults: DEFAULT_DATA,
});

// ==========================================
// 2. API エンドポイントの定義
// ==========================================

/** 設備マスタ＆ステータスデータの取得 (GET) */
app.get('/api/mccb', (req, res) => {
  try {
    res.json(store.readAll());
  } catch (error) {
    console.error("SQLiteデータ読み込み失敗:", error);
    res.status(500).json({ error: 'サーバーデータの読み込みに失敗しました。' });
  }
});

/** 設備マスタ＆ステータスデータの保存更新 (POST) */
app.post('/api/mccb', (req, res) => {
  try {
    store.saveAll(req.body);
    res.json({ status: 'success' });
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
        logSettings?.maxSize || 500,
      );
      store.writeCollection('logs', logs);
    }

    res.json({
      status: 'success',
      mccb: result.after,
      logs,
    });
  } catch (error) {
    console.error("SQLite設備更新失敗:", error);
    res.status(500).json({ error: '設備データの更新に失敗しました' });
  }
});

/** 停電作業依頼の発行と子札予約 */
app.post('/api/requests', (req, res) => {
  try {
    const newRequest = req.body?.request;
    if (!newRequest || !Array.isArray(newRequest.targetMccbIds)) {
      return res.status(400).json({ error: '依頼データが不正です。' });
    }

    const latest = store.readAll();
    const beforeMccbList = latest.mccbList;
    let currentMccbList = cloneMccbListForMutation(beforeMccbList);
    const currentRequests = latest.requests || [];

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

    const finalRequest = { ...newRequest, reservedCards };
    const requests = [finalRequest, ...currentRequests];
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${newRequest.workerName}氏の停電依頼を発行し\n子札を貸出予約しました。`,
      latest.logs,
      latest.logSettings?.maxSize || 500,
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
    });
  } catch (error) {
    console.error("停電作業依頼発行失敗:", error);
    res.status(500).json({ error: '停電作業依頼の発行に失敗しました' });
  }
});

/** 停電作業依頼の完了・解約と子札返却 */
app.delete('/api/requests/:id', (req, res) => {
  try {
    const latest = store.readAll();
    const beforeMccbList = latest.mccbList;
    let currentMccbList = cloneMccbListForMutation(beforeMccbList);
    const currentRequests = latest.requests || [];
    const currentHistory = latest.requestHistory || [];
    const reqToDelete = currentRequests.find((request) => request.id === req.params.id);

    if (!reqToDelete) {
      return res.status(404).json({ error: '対象の依頼が見つかりません。' });
    }

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
    const maxHistorySize = latest.historySettings?.maxSize || 500;
    const requestHistory = [completedRequest, ...currentHistory].slice(0, maxHistorySize);
    const logs = createUpdatedLogs(
      LOG_TYPES.OPERATION,
      `👷 ${reqToDelete.workerName || "作業者"}氏の作業完了に伴い\n子札が返却されました。`,
      latest.logs,
      latest.logSettings?.maxSize || 500,
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
