import express from 'express';
import fs from 'fs';
import cors from 'cors';
import path from 'path'; 
import os from 'os'; 
import { fileURLToPath } from 'url';

const app = express();

// --- ミドルウェア設定 ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ESモジュール環境用の __dirname 互換定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_PATH = path.join(__dirname, 'mccb_data.json');
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

// ==========================================
// 2. API エンドポイントの定義
// ==========================================

/** 設備マスタ＆ステータスデータの取得 (GET) */
app.get('/api/mccb', (req, res) => {
  // 初回起動時など、ファイルが存在しない場合は初期データファイルを作成
  if (!fs.existsSync(FILE_PATH)) {
    const initialObj = { 
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
    fs.writeFileSync(FILE_PATH, JSON.stringify(initialObj, null, 2), 'utf-8');
    return res.json(initialObj);
  }

  // ファイルが存在する場合は読み込んでパース
  try {
    const rawData = fs.readFileSync(FILE_PATH, 'utf-8');
    let parsed = JSON.parse(rawData);

    // 旧バージョンデータ（配列形式）だった場合は、最新のオブジェクト構造へ自動スキーマアップグレード
    if (Array.isArray(parsed)) {
      parsed = { 
        mccbList: parsed, 
        rooms: DEFAULT_ROOMS, 
        categories: DEFAULT_CATEGORIES, 
        logs: [{ id: "UPGRADE", timestamp: getTimestamp(), type: "システム", message: "データ構造をマスター・ログ・依頼対応版にアップグレードしました。" }], 
        logSettings: { maxSize: 500 }, 
        requests: [],
        deviceGroups: [],
        requestHistory: [],
        historySettings: { maxSize: 500 }
      };
      fs.writeFileSync(FILE_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    
    res.json(parsed);
  } catch (error) {
    console.error("データファイル読み込み失敗:", error);
    res.status(500).json({ error: 'サーバーデータの解析に失敗しました。' });
  }
});

/** 設備マスタ＆ステータスデータの保存更新 (POST) */
app.post('/api/mccb', (req, res) => {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ status: 'success' });
  } catch (error) {
    console.error("データファイル書き込み失敗:", error);
    res.status(500).json({ error: 'ファイルの書き込みに失敗しました' });
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
  console.log(` 🚀 禁止札データ ＆ Webサーバーが一体型で正常稼働しました`);
  console.log(` 🌐 接続URL: http://${localIp}:${PORT}`);
  console.log(`==================================================`);
});
