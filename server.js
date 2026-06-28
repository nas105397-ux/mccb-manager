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
const DB_PATH = path.join(__dirname, 'mccb_data.sqlite');
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
