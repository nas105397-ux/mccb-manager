# MCCB Manager 取扱説明書・導入手順

操作禁止札、停電依頼、子札貸出を管理する Web アプリです。
Raspberry Pi で常時稼働させ、Pi 本体の kiosk 画面、PC、タブレットから同じ画面を開いて使います。

## 前提

- OS は Raspberry Pi OS Lite 64-bit のみ対応です。
- Raspberry Pi OS with Desktop は対象外です。
- Raspberry Pi 5 推奨です。
- Node.js 24 以上が必要です。
- 本番運用では nginx で HTTPS 公開します。

関連ドキュメント:

- [Raspberry Pi OS Lite 導入詳細](deploy/raspi/README-lite.md)
- [SSH デプロイ詳細](deploy/raspi/README-ssh-deploy.md)
- [システム構成図](docs/system-architecture.md)
- [ハードウェア構成図](docs/hardware-architecture.md)
- [Raspberry Pi OA LAN 接続設定案](docs/raspberry-pi-oalan-settings.md)

## 1. 画面の開き方

Raspberry Pi で動かしている場合:

```text
https://<Raspberry PiのIP>/#/
```

例:

```text
https://192.168.40.111/#/
```

スター精密プリンターを WebUSB で接続する端末では、`localhost` または HTTPS で開く必要があります。
Raspberry Pi の LAN URL で開く場合は、HTTPS 証明書を端末に信頼登録してください。

主な画面:

| 画面 | URL | 使う場面 |
| --- | --- | --- |
| メイン操作 | `/#/` | 設備の検索、停電・送電、子札貸出 |
| 停電依頼作成 | `/#/request` | 停電依頼表の作成、印刷 |
| 依頼一覧 | `/#/request-list` | 進行中依頼、履歴、再印刷、作業完了 |
| 電気室モニター | `/#/monitor` | モニター表示用 |
| 管理画面 | `/#/admin` | 設備登録、CSV、マスター、ログ、DB バックアップ |

管理者モードの初期パスワードは `admin` です。

## 2. 基本操作

### 設備を探す

1. メイン操作画面を開きます。
2. 設備名称で検索します。
3. 必要に応じて、電気室、状態、お気に入りで絞り込みます。
4. 設備カードをクリックすると、操作画面が開きます。

状態の見方:

| 表示 | 意味 |
| --- | --- |
| 送電中 | 通常運用中です |
| 停電中 | 操作禁止、停電扱いです |
| 依頼発行中 | 停電依頼に含まれています |
| 札返却済み | 停電中で、子札はすべて返却済みです |

### 停電・送電を切り替える

1. メイン操作画面で設備をクリックします。
2. `現在：通常運用（送電中）` または `現在：操作禁止（停電中）` のボタンを押します。
3. 停電中に未返却の子札がある場合、送電には戻せません。

注意:

- 停電依頼を発行しても、設備の送電・停電状態は自動では変わりません。
- 送電へ戻す操作は、設備ごとの画面で手動で行います。
- 送電前に未返却の子札がないことを必ず確認してください。

### 子札を貸し出す

1. メイン操作画面で設備をクリックします。
2. 空いている子札の行に使用者名を入力します。
3. `貸出` を押します。
4. 返却時は同じ画面で `札を返却` を押します。

### 停電依頼表を作成して印刷する

1. 上部メニューの `停電依頼作成` を開きます。
2. 作業責任者名を入力します。
3. 作業内容・目的を入力します。
4. 対象設備を選択します。
5. ダミー札を選んだ場合は、代替する実際の設備名称を入力します。
6. `停電依頼を発行して印刷` を押します。

発行すると、依頼一覧に追加されます。
子札に空きがある設備は、依頼用の子札が確保されます。

### 進行中の依頼を確認する

1. 上部メニューの `依頼一覧` を開きます。
2. `進行中` タブで現在の依頼を確認します。
3. 必要に応じて次の操作をします。

| 操作 | 内容 |
| --- | --- |
| 停電設備を追加 | 発行済み依頼に対象設備を追加します |
| 依頼表を再印刷 | 同じ依頼表をもう一度印刷します |
| 解約・作業完了 | 依頼を完了し、依頼で確保した札を解放します |

作業完了後は `履歴` タブで確認できます。

### 管理画面を使う

1. 右上の `モード: 一般ユーザー` を押します。
2. パスワード `admin` を入力します。
3. 上部メニューの `管理` を開きます。

管理画面でできること:

- 設備の新規登録
- CSV 取り込み、CSV 出力
- 電気室マスターの追加、編集、削除
- 区分マスターの追加、編集、削除、表示色変更
- 停電依頼で使う設備グループの作成
- 操作ログの確認、削除
- 依頼履歴の保持件数設定、削除
- SQLite DB バックアップ作成

## 3. Raspberry Pi 導入の流れ

標準手順は、Windows PC から Raspberry Pi へ SSH でデプロイする方法です。
Pi 本体に画面を出す場合は kiosk 表示あり、別端末から見るだけの場合は kiosk 表示なしで導入します。

```text
1. Raspberry Pi OS Lite 64-bit を書き込む
2. SSH を有効にして起動する
3. Raspberry Pi へ SSH 接続する
4. OS を更新する
5. Lite 用パッケージを入れる
6. Node.js 24 以上を入れる
7. Windows PC からアプリを転送する
8. 再起動して表示確認する
```

### 3.1 OS を書き込む

Raspberry Pi Imager で設定します。

```text
OS: Raspberry Pi OS Lite 64-bit
ユーザー名: pi
SSH: 有効
Timezone: Asia/Tokyo
Wi-Fi: 必要な場合だけ設定
```

起動後、Windows PC から SSH 接続します。

```bash
ssh pi@<Raspberry PiのIP>
```

### 3.2 OS を更新する

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

再起動後、もう一度 SSH 接続します。

### 3.3 必要パッケージを入れる

kiosk 表示あり:

```bash
sudo apt update
sudo apt install -y --no-install-recommends \
  ca-certificates curl openssl unzip nginx \
  fontconfig fonts-noto-cjk fonts-noto-cjk-extra fonts-noto-color-emoji \
  xserver-xorg xserver-xorg-legacy xinit openbox x11-xserver-utils dbus-x11 chromium
```

kiosk 表示なし:

```bash
sudo apt update
sudo apt install -y --no-install-recommends ca-certificates curl openssl unzip nginx
```

アプリ配置後は、Lite 用セットアップスクリプトでもパッケージ導入とサービス作成ができます。

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi bash deploy/raspi/setup-lite-os.sh
```

すでにパッケージ導入済みで、サービス作成だけ行う場合:

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi SKIP_APT=1 bash deploy/raspi/setup-lite-os.sh
```

Pi 本体に画面を出さない場合:

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi INSTALL_KIOSK=0 bash deploy/raspi/setup-lite-os.sh
```

### 3.4 Node.js 24 以上を入れる

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

確認:

```bash
node -v
npm -v
node -e "require('node:sqlite').DatabaseSync"
```

`node:sqlite` でエラーが出なければ OK です。

### 3.5 アプリを転送する

Windows PC の PowerShell で、リポジトリのフォルダを開きます。

```powershell
cd C:\Users\<ユーザー名>\Documents\GitHub\mccb-manager
```

kiosk 表示あり:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry PiのIP> -StartKiosk
```

kiosk 表示なし:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry PiのIP>
```

クリック実行する場合:

```text
deploy\raspi\deploy-over-ssh.cmd
```

転送後、Raspberry Pi を再起動します。

```bash
sudo reboot
```

詳しい Lite 初期設定は [deploy/raspi/README-lite.md](deploy/raspi/README-lite.md)、SSH デプロイの詳細は [deploy/raspi/README-ssh-deploy.md](deploy/raspi/README-ssh-deploy.md) を参照してください。

## 4. 動作確認

ブラウザで開きます。

```text
https://<Raspberry PiのIP>/#/
```

サービス確認:

```bash
systemctl status mccb-manager.service
systemctl status nginx
systemctl status mccb-xsession.service
systemctl --user status mccb-kiosk.service
```

Pi 本体の kiosk 画面を使う場合は、再起動後に Chromium が自動で全画面表示されれば OK です。

HTTPS は Raspberry Pi 上の nginx で終端します。初回セットアップ時に自己署名証明書が作成されます。

```text
/etc/ssl/certs/mccb-manager-selfsigned.crt
/etc/ssl/private/mccb-manager-selfsigned.key
```

PC やタブレットからスター精密プリンターを接続する場合は、上記の `.crt` をその端末の信頼済み証明書として登録してから `https://<Raspberry PiのIP>/#/` を開きます。

Pi 本体の Chromium/kiosk から USB 接続のスター精密プリンターを使う場合:

```bash
cd /home/pi/mccb-manager
sudo bash deploy/raspi/install-star-webusb-driver.sh
sudo reboot
```

## 5. よく使うコマンド

アプリ再起動:

```bash
sudo systemctl restart mccb-manager.service
```

kiosk 画面再起動:

```bash
systemctl --user restart mccb-kiosk.service
```

kiosk 画面停止:

```bash
systemctl --user stop mccb-kiosk.service
pkill chromium
```

nginx 確認:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

ログ確認:

```bash
journalctl -u mccb-manager.service --no-pager -n 80
journalctl -u mccb-xsession.service --no-pager -n 80
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

Raspberry Pi の状態確認:

```bash
vcgencmd measure_temp
vcgencmd get_throttled
free -h
df -h
```

目安:

```text
throttled=0x0 なら電源・温度は概ね正常
温度は75度未満を目安にする
```

## 6. バックアップと復旧

運用データは次に保存されます。

```text
data/mccb_data.sqlite
```

バックアップは次に保存されます。

```text
data/backups/
```

バックアップは起動時と 24 時間ごとに自動作成されます。
管理画面の `DBバックアップ作成` から手動作成もできます。

バックアップ確認:

```bash
ls -lh /home/pi/mccb-manager/data/backups
```

復旧する場合:

```bash
cd /home/pi/mccb-manager
sudo systemctl stop mccb-manager.service
cp data/mccb_data.sqlite data/mccb_data.before-restore.sqlite
cp data/backups/<backup-file>.sqlite data/mccb_data.sqlite
sudo systemctl start mccb-manager.service
```

## 7. 更新するとき

Windows PC で最新版を転送します。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry PiのIP> -StartKiosk
```

kiosk 表示なしの場合は `-StartKiosk` を外します。

注意:

- `data/` は運用データです。
- 更新時に `data/` を手動で上書きしないでください。
- 大きな更新前は、管理画面で DB バックアップを作成してください。

## 8. 開発用コマンド

Windows PC や開発機で使います。

```bash
npm install
npm run dev
```

本番ビルド:

```bash
npm run build
```

本番サーバー起動:

```bash
npm start
```

確認:

```bash
npm run lint
node --check server.js
node --check dbStore.js
npm run build
```

## 9. 困ったとき

### 画面が開かない

```bash
systemctl status mccb-manager.service
systemctl status nginx
journalctl -u mccb-manager.service --no-pager -n 120
```

### 画面が古い

Pi 本体の kiosk 画面:

```bash
systemctl --user restart mccb-kiosk.service
```

PC やタブレットの場合は、ブラウザを再読み込みします。

### nginx の Welcome 画面が出る

```bash
sudo nginx -t
sudo systemctl reload nginx
ls -l /etc/nginx/sites-enabled/
```

### kiosk が出ない

```bash
systemctl status mccb-xsession.service
systemctl --user status mccb-kiosk.service
journalctl -u mccb-xsession.service --no-pager -n 80
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

## 10. 注意事項

- 停電操作、送電操作、禁止札運用は現場安全に直結します。
- 送電前に未返却の子札がないことを必ず確認してください。
- 管理者モードは信頼できる担当者だけが使用してください。
- Raspberry Pi の電源を切る前に、可能なら DB バックアップを確認してください。
