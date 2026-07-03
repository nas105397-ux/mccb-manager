# MCCB Manager 取扱説明書・導入手順

操作禁止札、停電依頼、子札貸出を管理するWebアプリです。
Raspberry Piで常時表示し、PCやタブレットからも同じ画面を開いて使えます。

## 1. 画面の開き方

Raspberry Piで動かしている場合:

```text
https://<Raspberry PiのIP>/#/
```

例:

```text
https://192.168.40.111/#/
```

スター精密プリンターをWebUSBで接続する端末では、`localhost` または HTTPS で開く必要があります。
Raspberry Pi の LAN URL で開く場合は、HTTPS 証明書を端末に信頼登録してください。

主な画面:

| 画面 | URL | 使う場面 |
| --- | --- | --- |
| メイン操作 | `/#/` | 設備の検索、停電・送電、子札貸出 |
| 停電依頼作成 | `/#/request` | 停電依頼表の作成、印刷 |
| 依頼一覧 | `/#/request-list` | 進行中依頼、履歴、再印刷、作業完了 |
| 電気室モニター | `/#/monitor` | モニター表示用 |
| 管理画面 | `/#/admin` | 設備登録、CSV、マスター、ログ、DBバックアップ |

管理者モードの初期パスワードは `admin` です。

## 2. アプリの使い方

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
- CSV取り込み、CSV出力
- 電気室マスターの追加、編集、削除
- 区分マスターの追加、編集、削除、表示色変更
- 停電依頼で使う設備グループの作成
- 操作ログの確認、削除
- 依頼履歴の保持件数設定、削除
- SQLite DBバックアップ作成

## 3. Raspberry Pi 導入手順

### 用意するもの

- Raspberry Pi 5推奨
- Raspberry Pi OS Lite 64-bit
- microSDカード
- 有線LANまたはWi-Fi
- Windows PC
- Raspberry PiにSSH接続できる環境

### 導入の流れ

```text
1. Raspberry Pi OS Liteを書き込む
2. SSHを有効にして起動する
3. Raspberry PiへSSH接続する
4. OSを更新する
5. 必要パッケージを入れる
6. Node.js 24以上を入れる
7. Windows PCからアプリを転送する
8. 再起動して表示確認する
```

## 4. Raspberry Pi 初期設定

### OSを書き込む

Raspberry Pi Imagerで設定します。

```text
OS: Raspberry Pi OS Lite 64-bit
ユーザー名: pi
SSH: 有効
Timezone: Asia/Tokyo
Wi-Fi: 必要な場合だけ設定
```

起動後、Windows PCからSSH接続します。

```bash
ssh pi@<Raspberry PiのIP>
```

### OSを更新する

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

再起動後、もう一度SSH接続します。

### IPアドレスを確認する

```bash
hostname -I
ip addr
```

固定IPにする場合は、接続名を確認します。

```bash
nmcli connection show
```

有線LANの例:

```bash
sudo nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses 192.168.40.111/24 \
  ipv4.gateway 192.168.40.1 \
  ipv4.dns "192.168.40.1 8.8.8.8"

sudo nmcli connection down "Wired connection 1"
sudo nmcli connection up "Wired connection 1"
```

## 5. Raspberry Piへ必要なものを入れる

### kiosk表示ありの場合

Pi本体の画面にアプリを全画面表示する場合です。

```bash
sudo apt update
sudo apt install -y --no-install-recommends \
  ca-certificates curl gnupg unzip nginx \
  fontconfig fonts-noto-cjk fonts-noto-cjk-extra fonts-noto-color-emoji \
  xserver-xorg xserver-xorg-legacy xinit openbox x11-xserver-utils dbus-x11 chromium
```

### kiosk表示なしの場合

Pi本体には表示せず、PCやタブレットから見るだけの場合です。

```bash
sudo apt update
sudo apt install -y --no-install-recommends ca-certificates curl gnupg unzip nginx
```

### Node.js 24以上を入れる

このアプリはNode.js 24以上が必要です。

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

`node:sqlite` でエラーが出なければOKです。

## 6. アプリをRaspberry Piへ転送する

Windows PCのPowerShellで、リポジトリのフォルダを開きます。

```powershell
cd C:\Users\takum\Documents\GitHub\mccb-manager
```

kiosk表示ありで転送:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry PiのIP> -StartKiosk
```

例:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.40.111 -StartKiosk
```

kiosk表示なしで転送:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry PiのIP>
```

kiosk表示ありの場合は、初回転送後にPiへSSH接続して、kiosk用サービスも作成します。

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi SKIP_APT=1 bash deploy/raspi/setup-lite-os.sh
```

パッケージ導入もスクリプトに任せる場合:

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi bash deploy/raspi/setup-lite-os.sh
```

最後にRaspberry Piを再起動します。

```bash
sudo reboot
```

## 7. 動作確認

ブラウザで開きます。

```text
https://<Raspberry PiのIP>/#/
```

HTTPS は Raspberry Pi 上の nginx で終端します。初回セットアップ時に自己署名証明書が作成されます。

```text
/etc/ssl/certs/mccb-manager-selfsigned.crt
/etc/ssl/private/mccb-manager-selfsigned.key
```

PCやタブレットからスター精密プリンターを接続する場合は、上記の `.crt` をその端末の信頼済み証明書として登録してから `https://<Raspberry PiのIP>/#/` を開きます。証明書が信頼されていない状態では、Chrome/EdgeでWebUSBが使えないことがあります。

Pi本体のChromium/kioskからUSB接続のスター精密プリンターを使う場合は、WebUSB用の設定を入れます。

```bash
cd /home/pi/mccb-manager
sudo bash deploy/raspi/install-star-webusb-driver.sh
sudo reboot
```

この設定は、スター精密プリンターのUSB権限を許可し、Linuxの `usblp` がプリンターを先に掴まないようにします。
接続時に `Open failed.` が出る場合は、Pi上でこの設定を再実行してからUSBケーブルを抜き差し、または再起動します。

```bash
cd /home/pi/mccb-manager
sudo bash deploy/raspi/install-star-webusb-driver.sh
sudo reboot
```

再実行時のログで `Detected Star USB devices:` にプリンターが出て、`usblp is not loaded.` と表示されれば、WebUSB側で開ける状態に近づきます。
デプロイ後は `mccb-star-webusb.service` が登録され、再起動時にもこのWebUSB設定が自動で適用されます。

```bash
systemctl status mccb-star-webusb.service
```

Pi本体のkiosk画面を使う場合は、再起動後にChromiumが自動で全画面表示されればOKです。
プリンター接続情報はkiosk用Chromiumプロファイルに保存され、再起動後も残ります。
標準のkiosk URLは `https://192.168.40.111/#/` です。
IP変更後や証明書警告が消えない場合は、証明書を再生成してからkioskを再起動します。

```bash
cd /home/pi/mccb-manager
MCCB_REGENERATE_CERT=1 MCCB_SERVER_HOST=192.168.40.111 bash deploy/raspi/setup-system.sh
systemctl --user restart mccb-kiosk.service
```

サービス確認:

```bash
systemctl status mccb-manager.service
systemctl status nginx
systemctl --user status mccb-kiosk.service
```

ログ確認:

```bash
journalctl -u mccb-manager.service --no-pager -n 80
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

## 8. よく使うコマンド

### アプリを再起動する

```bash
sudo systemctl restart mccb-manager.service
```

### kiosk画面を再起動する

```bash
systemctl --user restart mccb-kiosk.service
```

### kiosk画面を止める

```bash
systemctl --user stop mccb-kiosk.service
pkill chromium
```

### nginxを確認する

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Raspberry Piの状態を見る

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

## 9. バックアップと復旧

運用データは次に保存されます。

```text
data/mccb_data.sqlite
```

バックアップは次に保存されます。

```text
data/backups/
```

バックアップは起動時と24時間ごとに自動作成されます。
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

## 10. 更新するとき

Windows PCで最新版を転送します。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry PiのIP> -StartKiosk
```

注意:

- `data/` は運用データです。
- 更新時に `data/` を手動で上書きしないでください。
- 大きな更新前は、管理画面でDBバックアップを作成してください。

## 11. 開発用コマンド

Windows PCや開発機で使います。

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

## 12. 困ったとき

### 画面が開かない

```bash
systemctl status mccb-manager.service
systemctl status nginx
journalctl -u mccb-manager.service --no-pager -n 120
```

### 画面が古い

```bash
systemctl --user restart mccb-kiosk.service
```

PCやタブレットの場合は、ブラウザを再読み込みします。

### nginxのWelcome画面が出る

```bash
sudo nginx -t
sudo systemctl reload nginx
ls -l /etc/nginx/sites-enabled/
```

### kioskが出ない

```bash
systemctl status mccb-xsession.service
systemctl --user status mccb-kiosk.service
journalctl -u mccb-xsession.service --no-pager -n 80
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

## 13. 詳細資料

より詳しいRaspberry Pi手順:

- [deploy/raspi/README-lite.md](deploy/raspi/README-lite.md)
- [deploy/raspi/README-lite-kiosk.md](deploy/raspi/README-lite-kiosk.md)
- [deploy/raspi/README-ssh-deploy.md](deploy/raspi/README-ssh-deploy.md)

## 14. 注意事項

- 停電操作、送電操作、禁止札運用は現場安全に直結します。
- 送電前に未返却の子札がないことを必ず確認してください。
- 管理者モードは信頼できる担当者だけが使用してください。
- Raspberry Piの電源を切る前に、可能ならDBバックアップを確認してください。
