# MCCB Manager

操作禁止札・停電依頼・子札貸出を管理するためのWebアプリです。

Raspberry Pi 5 8GBでの常時運用を想定し、フロントはReact、サーバーはNode.js + Express、データ保存はSQLiteで構成しています。

## 主な機能

- MCCB設備の一覧表示、検索、電気室・状態・お気に入りフィルター
- 停電中、依頼発行中、通常送電の状態表示
- 子札貸出、停電依頼書の作成、印刷
- 依頼一覧と履歴の切り替え表示
- ダミー札、代替ダミー札の自動割り当て
- 電気室、区分、設備グループのマスター管理
- 区分ごとの表示色変更
- 操作ログ、依頼履歴のページング表示
- SQLite DBの自動バックアップ、手動バックアップ
- 電気室モニター用ダッシュボード

## 構成

```text
.
├─ server.js                    # Expressサーバー
├─ dbStore.js                   # SQLite保存処理
├─ data/
│  ├─ mccb_data.sqlite          # 運用DB
│  └─ backups/                  # 自動・手動バックアップ
├─ src/
│  ├─ components/               # Reactコンポーネント
│  ├─ hooks/                    # 画面ロジック
│  └─ shared/                   # サーバー/フロント共通処理
├─ deploy/
│  ├─ raspi/                    # Raspberry Pi配布・systemd設定
│  ├─ nginx/                    # nginx設定
│  └─ kiosk/                    # Chromium kiosk起動
└─ dist/                        # ビルド後の静的ファイル
```

## 画面

| URL | 用途 |
| --- | --- |
| `http://localhost:5000/#/` | メイン操作画面 |
| `http://localhost:5000/#/request` | 停電依頼作成 |
| `http://localhost:5000/#/request-list` | 依頼一覧・履歴 |
| `http://localhost:5000/#/monitor` | モニター用ダッシュボード |

管理者モードの初期パスワードは `admin` です。

## よく使うコマンド

### 開発

```bash
npm install
npm run dev
```

Vite開発サーバーを起動します。通常は `http://localhost:5173` で確認します。

### 本番ビルド

```bash
npm run build
```

`dist/` にフロントの本番ファイルを生成します。

### 本番サーバー起動

```bash
npm start
```

または直接起動します。

```bash
node server.js
```

デフォルトでは `http://localhost:5000` で起動します。

### チェック

```bash
npm run lint
node --check server.js
node --check dbStore.js
npm run build
```

変更後の最終確認では、上の4つを通すのがおすすめです。

### 回帰チェック

停電・送電状態と依頼処理は現場運用に直結するため、デプロイ後は以下を確認してください。

```text
1. 停電中の設備を含めて依頼発行する
   - 依頼発行後も、その設備が停電中のままになっていること
   - 依頼発行によって送電中へ戻らないこと

2. 依頼を削除・作業完了する
   - 子札だけが返却されること
   - 設備の停電中/送電中状態は変わらないこと
   - 他作業者の未返却子札が残っている設備が、勝手に送電中へ戻らないこと

3. 送電操作をする
   - 未返却の子札がある設備は送電できないこと
   - 送電へ切り替わるのは、停電・送電ボタンを手動操作した時だけであること

4. 札返却済み表示を確認する
   - 停電中かつ子札0枚の設備が「札返却済み」として表示されること
   - 状態フィルターの「札返却済みのみ」で対象設備だけが表示されること

5. 依頼表の再印刷を確認する
   - 依頼一覧の発行中依頼から「依頼表を再印刷」できること
   - 発行時と同じ子札番号・代替ダミー札情報で印刷されること
```

### DBバックアップ確認

```bash
ls data/backups
```

Windows PowerShellの場合:

```powershell
Get-ChildItem data\backups
```

## データ保存

運用データは `data/mccb_data.sqlite` に保存されます。

バックアップは `data/backups/` に保存されます。

- 起動時に自動バックアップ
- 24時間ごとに自動バックアップ
- 管理画面から手動バックアップ
- デフォルトで最新10件を保持

### バックアップ設定

環境変数で変更できます。

```bash
# 自動バックアップを無効化
MCCB_AUTO_BACKUP_ENABLED=0 npm start

# 起動時バックアップだけ無効化
MCCB_AUTO_BACKUP_ON_START=0 npm start

# 自動バックアップ間隔を12時間に変更
MCCB_AUTO_BACKUP_INTERVAL_MS=43200000 npm start

# バックアップ保持数を20件に変更
MCCB_BACKUP_MAX_FILES=20 npm start
```

PowerShellの場合:

```powershell
$env:MCCB_BACKUP_MAX_FILES="20"
npm start
```

## Raspberry Pi配布

推奨は、Windows PC側でビルドしてPiへSSH転送する方法です。Piではビルドせず、実行専用にします。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50
```

主なオプション:

```powershell
# SSHポート指定
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -Port 2222

# 配置先指定
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -AppDir '/home/pi/mccb-manager'

# デプロイ後にkioskも起動
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -StartKiosk
```

クリック実行用:

```text
deploy\raspi\deploy-over-ssh.cmd
```

詳細は [deploy/raspi/README-ssh-deploy.md](deploy/raspi/README-ssh-deploy.md) を参照してください。

Raspberry Pi OS Liteで最小GUI/kiosk運用する場合は、[deploy/raspi/README-lite.md](deploy/raspi/README-lite.md) を参照してください。

## Pi側でよく使うコマンド

### サーバー状態確認

```bash
systemctl status mccb-manager.service
journalctl -u mccb-manager.service --no-pager -n 80
```

### サーバー再起動

```bash
sudo systemctl restart mccb-manager.service
```

### nginx確認

```bash
systemctl status nginx
sudo nginx -t
sudo systemctl reload nginx
```

### kiosk確認

```bash
systemctl --user status mccb-kiosk.service
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

### kiosk再起動

```bash
systemctl --user restart mccb-kiosk.service
```

### kiosk停止

```bash
systemctl --user stop mccb-kiosk.service
pkill chromium
```

停止後にXorgのCPU使用率が高いまま残る場合は、kioskサービス定義を更新してから再読み込みします。

```bash
cd /home/pi/mccb-manager
cp deploy/kiosk/mccb-kiosk.service ~/.config/systemd/user/mccb-kiosk.service
chmod +x deploy/kiosk/start-kiosk.sh
systemctl --user daemon-reload
systemctl --user restart mccb-kiosk.service
```

### Chromiumを止める

```bash
pkill chromium
```

### 画面OFF・スリープ確認

```bash
DISPLAY=:0 xset q
```

以下ならOKです。

```text
Screen Saver timeout: 0
DPMS is Disabled
```

### Piの負荷確認

```bash
vcgencmd measure_temp
vcgencmd get_throttled
free -h
df -h
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head -20
```

目安:

```text
mccb-manager.service: active (running)
mccb-kiosk.service: active (running)
nginx: active (running)
throttled=0x0
温度: 75度未満なら概ね良好
```

## 手動配布する場合

PCでビルドします。

```bash
npm ci
npm run build
```

Piへ渡す主なファイル:

```text
package.json
package-lock.json
node_modules/
server.js
dbStore.js
src/shared/
dist/
deploy/
README.md
```

運用中のPiでは `data/` を上書きしないでください。既存の `data/mccb_data.sqlite` と `data/backups/` を保持します。

Pi側で手動起動する場合:

```bash
cd /home/pi/mccb-manager
npm start
```

ブラウザで確認:

```text
http://<Raspberry PiのIP>:5000/#/
http://<Raspberry PiのIP>:5000/#/monitor
```

## トラブル対応

### サーバーが起動しない

```bash
journalctl -u mccb-manager.service --no-pager -n 120
```

DBファイルの場所も確認します。

```bash
ls -lh /home/pi/mccb-manager/data
```

### 画面が古いまま

ブラウザを再読み込みします。kiosk運用ならサービスを再起動します。

```bash
systemctl --user restart mccb-kiosk.service
```

### nginxでWelcome画面が出る

default設定が残っていないか確認します。

```bash
ls -l /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### データを復旧したい

サーバーを止めてから、`data/backups/` のバックアップを `data/mccb_data.sqlite` に戻します。

```bash
sudo systemctl stop mccb-manager.service
cp data/backups/<backup-file>.sqlite data/mccb_data.sqlite
sudo systemctl start mccb-manager.service
```

実行前に現在のDBも別名で残しておくと安全です。

```bash
cp data/mccb_data.sqlite data/mccb_data.before-restore.sqlite
```

## 技術スタック

- Frontend: React + Vite
- Routing: React Router
- UI: Tailwind CSS
- Backend: Node.js + Express
- Data: SQLite (`node:sqlite`)
- Pi運用: systemd + nginx + Chromium kiosk

## 注意

- 停電操作・禁止札運用は現場安全に直結します。
- 管理者モードは信頼できるユーザーだけが使用してください。
- `data/` は運用データです。配布や更新時に上書きしないでください。
- 重要な更新前には、管理画面または `data/backups/` でバックアップを確認してください。
