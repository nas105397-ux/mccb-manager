# 📋 操作禁止札管理システム

電気工事現場での安全管理を効率化するWebアプリケーションです。電気室の配電盤（MCCB）と停電作業を一元管理し、運用スタッフと工事業者の情報共有を支援します。

## 🎯 主な機能

### 1. **MCCB管理ダッシュボード** （メイン画面）
電気室の配電機器（MCCB）をカード形式で一覧表示・管理します。

**表示項目：**
- **設置場所**: 各MCCBがどの電気室にあるか
- **区分**: 機器の種類（1スト～6スト、共通など）
- **設備名**: 「33KV受電 VCB」など具体的な機器名
- **停電状態**: 🔴停電中 / 🟢送電中
- **お気に入り**: ⭐マークで頻繁に使う設備を管理

**カードの色分け：**
- **赤い枠**: 停電中（作業禁止状態）
- **黄色い枠**: 現在依頼が入っている状態
- **グレー枠**: 通常状態（送電中）

### 2. **検索・フィルタ機能**
大量の設備から必要なものを素早く見つけるためのツール

**検索条件：**
- 📍 **設備名称で検索**: 「VCB」「配電」など部分一致で検索
- 🏢 **部屋で絞り込み**: 「1階高圧電気室」など特定の場所だけ表示
- ⚡ **送電/停電で絞り込み**: 稼働中の設備のみ表示など
- ⭐ **お気に入りのみ表示**: よく使う設備だけを表示

**統計情報：**
- 登録総数
- 送電中: 🟢（稼働中の設備数）
- 停電中: 🔴（作業中の設備数）

### 3. **停電依頼書作成・印刷** （REQUEST パネル）
工事で設備を停止するときに、正式な依頼書を作成して現場に共有します。

**作成手順：**

① **基本情報入力**
- 👷 **工事業者名**: 「〇〇工業」など
- 📝 **工事内容**: 「配線工事」「点検」など

② **対象設備を選択**
- 停止が必要な設備にチェック（複数選択OK）
- ダミー設備を選んだ場合は、実際の設備名を入力

③ **グループ機能**
- よく使う設備の組み合わせを「グループ」として登録可能
- 「A系統全部」「主要機器」など、一括選択できます

④ **プレビュー・印刷**
- 依頼書がプレビューで確認できます
- 「印刷」ボタンで用紙に出力
- 現場スタッフが確認・署名します

**印刷される内容：**
- 依頼日時
- 工事業者名・工事内容
- 停止が必要な設備の一覧
- チェックボックス（現場での確認用）

### 4. **依頼一覧・履歴管理** （REQUEST LIST パネル）
過去の停電依頼書の一覧と履歴を確認

- 📅 **依頼日時**: いつ誰が依頼したか
- 🏷️ **依頼内容**: 工事内容・業者名
- ✅ **状態**: 進行中 / 完了
- 🗑️ **削除**: 不要な依頼は削除可能
- 🔄 **復元**: 過去の依頼を参考に再利用可能

### 5. **電気室モニター** （MONITOR パネル）
現場のモニター画面に常時表示する専用ビュー

**特徴：**
- 🖥️ フルスクリーン対応で壁掛けモニターに表示可能
- 🔄 リアルタイム更新（自動更新）
- 📊 大きな文字・わかりやすいレイアウト
- 🌓 ダークテーマで眼に優しい
- ⏰ 現在時刻表示
- 📈 停電・送電の統計情報

**画面構成：**
- 上部: 全体統計（送電中 / 停電中の件数）
- 左側パネル: 活動ログ（最新の操作記録）
- 中央: 設備カード一覧（リアルタイム表示）
- 右側パネル: 依頼・統計情報

### 6. **管理者機能** （ADMIN パネル）
システム管理者専用の設定・管理画面

**アクセス方法：**
- ログイン時に「🔒 モード: 一般ユーザー」→「🔓 モード: 管理者」に切り替え

**管理項目：**

#### a) **MCCB設備の登録・編集**
- ✏️ 新しいMCCB設備を追加
- 🗑️ 不要な設備を削除
- 📝 設備情報を修正

#### b) **部屋（Room）の管理**
- 新規追加: 「2階変圧器室」など
- 編集・削除

#### c) **区分（Category）の管理**
- 「1スト」「2スト」などのカテゴリを追加・編集
- カラー表示を自動反映

#### d) **設備グループの管理**
- よく使う設備の組み合わせを「グループ」として保存
- 停電依頼書作成時に一括選択可能

#### e) **ログ管理**
- 🔍 全ユーザーの操作ログを確認
- 📊 ログの最大保存件数を調整
- 🗑️ 古いログを削除

**ログタイプ：**
- `操作`: MCCBの停電/送電切り替え
- `札貸出`: 停電依頼書の作成・削除
- `マスタ登録`: 新しい設備追加
- `マスタ編集`: 既存設備を修正
- `マスタ削除`: 設備を削除
- `システム`: その他システム操作

#### f) **CSVインポート機能**
- 一括で複数の設備を登録
- Excel/CSVから数十個～数百個の設備を一度に登録可能

#### g) **依頼履歴管理**
- 過去の停電依頼の保存件数を設定
- 履歴クリア機能

---

## 🖱️ 基本的な操作フロー

### 📍 日常運用

1. **起動**: アプリを開いて、現在のMCCB状態を確認
2. **停電が必要**: 
   - 「REQUEST」タブ → 必要な設備を選択 → 依頼書を印刷
   - 現場スタッフに依頼書を配布
3. **停止後**: 
   - 該当カードをクリック → 「停止」ボタンで赤く表示
4. **復旧**: 
   - 「送電」ボタンで状態を戻す
   - 「REQUEST LIST」で履歴確認

### 🔧 管理者作業

1. **初期設定**:
   - 「ADMIN」タブ → 電気室一覧を登録
   - 各MCCB設備を登録・カテゴリ分類
   - 設備グループ（よく使う組み合わせ）を作成

2. **日常管理**:
   - ログを定期確認（誰が何をしたか）
   - 古いログ削除でディスク容量管理
   - 依頼書の履歴整理

3. **スケール対応**:
   - 設備が増加: CSVインポートで一括登録
   - 施設改修: 区分・部屋情報を更新

---

## 📱 モード切り替え

右上のボタンで2つのモードを切り替えます：

| モード | 操作可能な内容 |
|--------|--------------|
| 🔒 **一般ユーザー** | MCCB状態確認・停電依頼書作成・印刷 |
| 🔓 **管理者** | 上記に加えて、設備登録・ログ管理・設定変更 |

---

## 🎨 UI/UXの特徴

- **直感的なカード表示**: 設備の状態が一目でわかる配色
- **レスポンシブ対応**: PC・タブレット・スマートフォンに対応
- **印刷最適化**: 依頼書が見やすく印刷できる
- **ダークテーマ**: モニター表示に最適化
- **キーボード操作**: Enterキーで設備選択可能（アクセシビリティ）

---

## 📊 データ構造

### MCCBデータ（data/mccb_data.sqlite）

運用データは `data/mccb_data.sqlite` に保存されます。`data/mccb_data.json` は初回移行や復旧時の元データとして使用できます。

バックアップは `data/backups/` に保存されます。サーバー起動時に1回、その後24時間ごとに自動作成され、最新10件を保持します。管理画面から手動作成もできます。

自動バックアップ設定:

```bash
# 自動バックアップを無効化
MCCB_AUTO_BACKUP_ENABLED=0

# 起動時バックアップだけ無効化
MCCB_AUTO_BACKUP_ON_START=0

# 自動バックアップ間隔を変更（例: 12時間）
MCCB_AUTO_BACKUP_INTERVAL_MS=43200000

# 保持件数を変更
MCCB_BACKUP_MAX_FILES=20
```

```json
{
  "mccbList": [
    {
      "id": "MCCB-1782288115869-0",
      "room": "1階高圧電気室",
      "category": "共通",
      "name": "33KV受電 VCB",
      "isPowerOff": false,
      "isFavorite": false,
      "childCards": [
        { "id": 1, "isBorrowed": false, "workerName": "" }
      ]
    }
  ]
}
```

### 各項目の意味

- `id`: 設備を識別するユニークID
- `room`: 設置場所（電気室名）
- `category`: 区分（1スト、2スト、共通など）
- `name`: 設備の名前
- `isPowerOff`: `true`=停止中, `false`=稼働中
- `isFavorite`: `true`=お気に入り, `false`=通常
- `childCards`: 工事札の割り当て情報

---

## 🚀 セットアップ・実行

### インストール
```bash
npm install
```

### 開発サーバー起動
```bash
npm run dev
```

### 本番ビルド
```bash
npm run build
```

### サーバー起動（本番環境）
```bash
npm start
# または
node server.js
```

### Raspberry Pi 5 常時運用（PCビルド + systemd + nginx + X11 kiosk）

本番運用では、開発とビルドはPCで行い、Raspberry Pi 5は実行専用にします。Pi上ではViteビルドを行わず、PCで生成した `dist/` をExpressが配信します。

推奨構成:

```text
systemd: Node/Expressサーバーを常駐
nginx: 80番ポートで公開し、localhost:5000へリバースプロキシ
X11 + Chromium kiosk: FHD操作画面と4Kダッシュボードを2画面固定表示
```

#### 推奨: Windows PCからSSHデプロイ

Piをインターネットへ接続しない運用では、この方法を使います。PC側でビルドし、`node_modules` も含めてPiへ転送します。

事前にPiイメージへ入れておくもの:

```text
Node.js 24以上
unzip
systemd
nginx（80番公開する場合）
chromium または chromium-browser、xset（kiosk表示する場合）
```

PowerShellから直接実行:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50
```

クリック実行する場合:

```text
deploy\raspi\deploy-over-ssh.cmd
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

このスクリプトは以下を行います。

```text
1. PC側で npm ci（node_modules が無い場合）
2. PC側で npm run build
3. 配布ZIPを作成
4. PiへSSH転送
5. Pi側へ展開
6. systemdサービス登録/再起動
7. nginxがあれば80番公開設定
8. Chromium環境があればkioskユーザーサービス登録
```

Pi側の `data/` はアップロードで上書きしません。既存の `data/mccb_data.sqlite` と `data/backups/` は保持されます。

詳細は [deploy/raspi/README-ssh-deploy.md](deploy/raspi/README-ssh-deploy.md) を参照してください。

#### 手動配布する場合

PCでビルド:

```bash
npm ci
npm run build
```

Piへ渡す最小構成:

```text
package.json
package-lock.json
node_modules/
server.js
dbStore.js
src/shared/
ecosystem.config.cjs
dist/
deploy/
README.md
```

新規導入時だけ、必要に応じて `data/mccb_data.json` を配置します。既存運用中のPiでは `data/` を上書きしないでください。

Pi側の配置先は `/home/pi/mccb-manager` を想定しています。

#### 手動起動確認

```bash
cd /home/pi/mccb-manager
npm start
```

別端末またはブラウザで確認:

```text
http://<Raspberry PiのIP>:5000/#/
http://<Raspberry PiのIP>:5000/#/monitor
```

確認できたら `Ctrl + C` で停止します。

#### systemdでサーバーを常駐

```bash
cd /home/pi/mccb-manager
APP_DIR=/home/pi/mccb-manager ENABLE_KIOSK=1 bash deploy/raspi/setup-system.sh
```

確認:

```bash
systemctl status mccb-manager.service
journalctl -u mccb-manager.service --no-pager -n 80
```

#### nginxで80番ポート公開

```bash
cd /home/pi/mccb-manager
sudo cp deploy/nginx/mccb-manager.conf /etc/nginx/sites-available/mccb-manager
sudo ln -s /etc/nginx/sites-available/mccb-manager /etc/nginx/sites-enabled/mccb-manager
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

`sudo rm /etc/nginx/sites-enabled/default` で `No such file` と出た場合は、そのままで問題ありません。

nginx経由のURL:

```text
メイン操作画面: http://<Raspberry PiのIP>/#/
4Kダッシュボード: http://<Raspberry PiのIP>/#/monitor
```

「Welcome to nginx」が出る場合は、`/etc/nginx/sites-enabled/default` が残っていないか確認してください。

```bash
ls -l /etc/nginx/sites-enabled/
systemctl status nginx
```

#### X11 kioskを手動起動で確認

Raspberry Pi OSはX11に切り替えて運用します。SSHからX11上の画面に出す場合は `DISPLAY=:0` を付けます。

```bash
cd /home/pi/mccb-manager
chmod +x deploy/kiosk/start-kiosk.sh
pkill chromium

DISPLAY=:0 \
APP_URL=http://127.0.0.1 \
MAIN_GEOMETRY=1920x1080+0+0 \
DASHBOARD_GEOMETRY=3840x2160+1920+0 \
DASHBOARD_SCALE=1.5 \
./deploy/kiosk/start-kiosk.sh
```

画面配置の想定:

```text
左: FHD操作画面 1920x1080
右: 4Kダッシュボード 3840x2160、表示倍率1.5
```

止める場合:

```bash
pkill chromium
```

描画が乱れる場合はGPU補助を切って起動します。

```bash
DISPLAY=:0 ENABLE_GPU_TUNING=0 APP_URL=http://127.0.0.1 ./deploy/kiosk/start-kiosk.sh
```

#### kioskを自動起動

```bash
cd /home/pi/mccb-manager
mkdir -p ~/.config/systemd/user
cp deploy/kiosk/mccb-kiosk.service ~/.config/systemd/user/mccb-kiosk.service
chmod +x deploy/kiosk/start-kiosk.sh

systemctl --user daemon-reload
systemctl --user enable mccb-kiosk.service
systemctl --user start mccb-kiosk.service
```

確認:

```bash
systemctl --user status mccb-kiosk.service
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

再起動後もユーザーサービスを動かす場合:

```bash
loginctl enable-linger pi
```

#### スリープ・画面OFFを無効化

`deploy/kiosk/mccb-kiosk.service` には以下を入れています。

```ini
Environment=DISPLAY=:0
ExecStartPre=/usr/bin/xset s off
ExecStartPre=/usr/bin/xset -dpms
ExecStartPre=/usr/bin/xset s noblank
```

手動で確認:

```bash
DISPLAY=:0 xset q
```

以下ならOKです。

```text
Screen Saver timeout: 0
DPMS is Disabled
```

#### kioskで日本語入力を使う

X11 + Chromium kioskで日本語入力する場合は、Piに `fcitx5-mozc` を入れます。

```bash
sudo apt update
sudo apt install fcitx5 fcitx5-mozc im-config
```

入力方式を `fcitx5` にします。

```bash
im-config
```

画面で `fcitx5` を選び、Piを再起動します。

```bash
sudo reboot
```

`deploy/kiosk/start-kiosk.sh` は、`fcitx5` が入っていればChromium起動前に自動起動します。`deploy/kiosk/mccb-kiosk.service` には以下の環境変数を入れています。

```ini
Environment=GTK_IM_MODULE=fcitx
Environment=QT_IM_MODULE=fcitx
Environment=XMODIFIERS=@im=fcitx
```

サービスファイルをPi側へ反映したら再読み込みします。

```bash
cd /home/pi/mccb-manager
cp deploy/kiosk/mccb-kiosk.service ~/.config/systemd/user/mccb-kiosk.service
systemctl --user daemon-reload
systemctl --user restart mccb-kiosk.service
```

日本語/英数の切り替えは、通常 `Ctrl + Space` または `半角/全角` です。効かない場合は、デスクトップ上で `fcitx5-configtool` を開き、入力メソッドに `Mozc` を追加してください。

```bash
fcitx5-configtool
```

#### 運用確認コマンド

```bash
systemctl status mccb-manager.service
journalctl -u mccb-manager.service --no-pager -n 80
systemctl --user status mccb-kiosk.service
DISPLAY=:0 xset q
systemctl status nginx
vcgencmd measure_temp
vcgencmd get_throttled
free -h
df -h
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head -20
```

目安:

```text
mccb-kiosk.service: active (running)
mccb-manager.service: active (running)
nginx: active (running)
throttled=0x0
温度: 75度未満なら概ね良好
```

Chromiumの `GetVSyncParametersIfAvailable() failed` やGoogle API/GCM系のログは、画面表示が正常なら基本的に無視できます。

---

## 🔐 セキュリティ上の注意

- ⚠️ 停電操作は重大な影響があります
- 📋 管理者権限は信頼できるユーザーのみに付与してください
- 📝 すべての操作ログは記録されます（監査用）
- 💾 運用データはサーバー側の `data/mccb_data.sqlite` に保存されます

---

## 📞 トラブルシューティング

| 問題 | 解決策 |
|------|------|
| 依頼書が印刷できない | ブラウザの「印刷」機能を確認。PDFで保存することも可能 |
| データが保存されない | ブラウザの容量制限を確認。古いログを削除してください |
| モニターが更新されない | リフレッシュレート設定を確認。ブラウザをリロード |
| 設備が表示されない | フィルター条件を確認。検索文字をクリアしてみてください |

---

## 🛠️ 開発技術スタック

- **Frontend**: React + Vite
- **UI**: Tailwind CSS
- **Routing**: React Router
- **Backend**: Node.js (Express)
- **Data**: JSON（ローカルストレージ）

---

このシステムで、電気工事現場の安全管理と運用効率を大幅に向上させることができます！
