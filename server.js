import express from 'express';
import fs from 'fs';
import cors from 'cors';
import path from 'path'; // パス操作用の標準モジュール
import os from 'os'; // 💡 【追加】機器のネットワーク情報を取得するための標準モジュール
import { fileURLToPath } from 'url'; // ESモジュール環境用の定義用

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ESモジュール環境（import形式）で、現在のフォルダパス（__dirname）を使えるようにする定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_PATH = './mccb_data.json';

const defaultData = [
  { id: "SAMPLE-1", room: "1階高圧電気室", category: "1スト", name: "No.1加熱炉 送風ファン用MCCB", isPowerOff: false, isFavorite: false, childCards: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, isBorrowed: false, workerName: '' })) }
];

function getTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
}

// 💡 【新設】機器の有線LANやWi-FiのIPアドレス（IPv4）を自動で探して取得する関数
function getLocalIpAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // familyが IPv4 であり、かつ internal（127.0.0.1などの内部ループバック）ではない実際のIPを抽出
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost'; // 万が一ネットワーク未接続だった場合のフォールバック
}

// ----------------------------------------------------
// ⚙️ 1. APIエンドポイント（既存ロジックはそのまま完全維持）
// ----------------------------------------------------
app.get('/api/mccb', (req, res) => {
  if (!fs.existsSync(FILE_PATH)) {
    const initialObj = { mccbList: defaultData, rooms: ['1階高圧電気室', '1階電気室', '2階電気室', '2次トーチ電気室', 'LT-UT電気室', '水処理電気室'], categories: ['1スト', '2スト', '3スト', '4スト', '5スト', '6スト', '共通'], logs: [{ id: "INIT", timestamp: getTimestamp(), type: "システム", message: "システムログ機能が初期化されました。" }], logSettings: { maxSize: 500 }, requests: [] };
    fs.writeFileSync(FILE_PATH, JSON.stringify(initialObj, null, 2), 'utf-8');
    return res.json(initialObj);
  }
  const data = fs.readFileSync(FILE_PATH, 'utf-8');
  let parsed;
  try { parsed = JSON.parse(data); } catch { parsed = defaultData; }

  if (Array.isArray(parsed)) {
    parsed = { mccbList: parsed, rooms: ['1階高圧電気室', '1階電気室', '2階電気室', '2次トーチ電気室', 'LT-UT電気室', '水処理電気室'], categories: ['1スト', '2スト', '3スト', '4スト', '5スト', '6スト', '共通'], logs: [{ id: "UPGRADE", timestamp: getTimestamp(), type: "システム", message: "データ構造をマスター・ログ・依頼対応版にアップグレードしました。" }], logSettings: { maxSize: 500 }, requests: [] };
    fs.writeFileSync(FILE_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
  }
  res.json(parsed);
});

app.post('/api/mccb', (req, res) => {
  try { fs.writeFileSync(FILE_PATH, JSON.stringify(req.body, null, 2), 'utf-8'); res.json({ status: 'success' }); } 
  catch  { res.status(500).json({ error: 'ファイルの書き込みに失敗しました' }); }
});

// ----------------------------------------------------
// 🖨️ 2. フロントエンド静的ファイルの配信設定
// ----------------------------------------------------
// ビルドされた React アプリの「dist」フォルダ内の静的ファイル（JSやCSS）を自動配信
app.use(express.static(path.join(__dirname, 'dist')));

// Express v5 の仕様に合わせたキャッチオールルーティング
// ルートパス「/」から、深い階層のURL（SPAルーティング用）まで安全に React の index.html に流します
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ----------------------------------------------------
// 🚀 サーバー起動設定
// ----------------------------------------------------
const PORT = 5000;
app.listen(PORT, () => {
  const localIp = getLocalIpAddress(); // 💡 起動した瞬間に自身のIPを自動取得
  console.log(`==================================================`);
  console.log(` 🚀 禁止札データ ＆ Webサーバーが一体型で正常稼働しました`);
  console.log(` 🌐 接続URL: http://${localIp}:${PORT}`);
  console.log(`==================================================`);
});