# Raspberry Pi オフライン SSH デプロイ

この手順は、Raspberry Pi OS Lite 64-bit 固定で、Raspberry Pi をインターネットへ接続しない運用を前提にしています。Raspberry Pi OS with Desktop（通常OS）は使用しません。

PC 側でアプリをビルドし、`dist/`、サーバーファイル、`src/shared/`、`deploy/`、サーバ実行に必要な `node_modules` だけをまとめて SSH で Raspberry Pi へ転送します。Raspberry Pi 側のセットアップでは `apt`、NodeSource、`npm install` は実行しません。

Lite OS の初期セットアップは [Raspberry Pi OS Lite 導入手順](README-lite.md) を参照してください。
日常操作、バックアップ、更新時の注意、トラブル確認は [取扱説明・運用ガイド](../../docs/operation-guide.md) を参照してください。

## Raspberry Pi OS Lite イメージの事前準備

Raspberry Pi OS Lite 64-bit をオフライン運用にする前に、オンラインで準備できる環境で以下を入れておいてください。

- Node.js 24 以上
- `unzip` または `python3`（配布ZIPの展開に使用）
- `systemd`
- `systemd --user`（Lite kiosk表示を使う場合）
- HTTPS（443 番）/ HTTP リダイレクト（80 番）で公開する場合は `nginx` と `openssl`
- Lite kiosk 表示を使う場合は `xserver-xorg`、`xinit`、`openbox`、`chromium` または `chromium-browser`、`xset`
- kiosk 表示で日本語を表示する場合は `fontconfig`、`fonts-noto-cjk`、`fonts-noto-cjk-extra`、`fonts-noto-color-emoji`

`nginx` が無くてもアプリは動作します。その場合は 5000 番ポートでアクセスします。

先に必要パッケージを入れる場合:

```bash
sudo apt update
sudo apt install -y --no-install-recommends unzip nginx openssl
```

Node.js 24 以上をオンライン環境で入れる場合:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -e "require('node:sqlite').DatabaseSync"
```

Lite kiosk表示も使う場合:

```bash
sudo apt install -y --no-install-recommends xserver-xorg xserver-xorg-legacy xinit openbox x11-xserver-utils dbus-x11 chromium fontconfig fonts-noto-cjk fonts-noto-cjk-extra fonts-noto-color-emoji
```

日本語入力も使う場合:

```bash
sudo apt install -y --no-install-recommends fontconfig fonts-noto-cjk fonts-noto-cjk-extra fcitx5 fcitx5-frontend-gtk3 fcitx5-mozc
```

## Windows PowerShell からデプロイ

`deploy-over-ssh.ps1` をダブルクリックすると、実行されずにエディタで開く場合があります。その場合は次のどちらかで実行してください。

### クリックして実行する場合

`deploy\raspi\deploy-over-ssh.cmd` をダブルクリックしてください。接続先、SSH ポート、配置先を順番に日本語で入力できます。

### npm scripts から実行する場合

リポジトリのルートで次を実行してください。

```powershell
npm run deploy
```

SSH 鍵の設定:

```powershell
npm run ssh-key
```

## SSH パスワード入力を省略する

パスワード認証のままデプロイすると、`scp` と `ssh` の接続ごとにパスワードを聞かれます。初回だけ SSH 鍵を Raspberry Pi に登録しておくと、以後はパスワード入力なしでデプロイできます。

クリックして設定する場合:

```text
deploy\raspi\setup-ssh-key.cmd
```

PowerShell から設定する場合:

```powershell
.\deploy\raspi\setup-ssh-key.ps1 -Target pi@192.168.1.50
```

この設定では、既定で Windows 側に `%USERPROFILE%\.ssh\mccb_manager_ed25519` を作成し、公開鍵を Raspberry Pi の `~/.ssh/authorized_keys` に追加します。登録時だけ Raspberry Pi の SSH パスワードを入力します。

通常のデプロイでは、この既定鍵があれば自動で使われます。別の鍵を使う場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -KeyPath "$HOME\.ssh\id_ed25519"
```

### PowerShell から直接実行する場合

リポジトリのルートで PowerShell を開いて、次を実行します。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50
```

初回セットアップもまとめて行う場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -BootstrapLite
```

SSH ポートが 22 以外の場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -Port 2222
```

配置先を変更する場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -AppDir '/home/pi/mccb-manager'
```

デプロイ直後に kiosk サービスも起動する場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -StartKiosk
```

Pi本体に画面を出さないサーバー専用運用では、`-StartKiosk` は付けません。

初回セットアップと kiosk 表示をまとめて行う場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -BootstrapLite -StartKiosk
```

`-BootstrapLite` は Raspberry Pi がインターネットへ接続できる初回セットアップ向けです。既定で Lite 用パッケージ、Node.js 24 以上、日本語入力（fcitx5-mozc）をインストールします。すでに Node.js を用意済みで、NodeSource へ接続したくない場合は `-NoInstallNode` を付けます。

## LAN固定IPを設定する

`-BootstrapLite` による初回セットアップ時に、Raspberry PiのLANアドレスを固定IPにできます。指定しない場合はDHCPのままです。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -BootstrapLite -StaticIp 192.168.1.50/24 -StaticGateway 192.168.1.1 -StaticDns 192.168.1.1
```

対象のネットワーク接続名を明示したい場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -BootstrapLite -StaticIp 192.168.1.50/24 -StaticConnection "Wired connection 1"
```

固定IPが今回の接続先アドレスと異なる場合、反映と同時にSSH接続が切れます。これは想定内の動作です。反映は数秒後にバックグラウンドで行われるため、デプロイ処理自体はSSH切断の影響を受けません。反映後は新しいIPで再接続してください。

```bash
ssh pi@192.168.1.50
```

対話モードでクリック実行する場合も、初回セットアップを選択すると固定IPの設定を質問されます（不要なら空Enterでスキップ）。

Raspberry Pi側で後から手動設定・変更する場合:

```bash
cd /home/pi/mccb-manager
sudo STATIC_IP=192.168.1.50/24 STATIC_GATEWAY=192.168.1.1 STATIC_DNS=192.168.1.1 bash deploy/raspi/setup-static-ip.sh
```

2 LAN構成（OA LANと現場LANを分離する運用）は [Raspberry Pi OA LAN 接続設定案](../../docs/raspberry-pi-oalan-settings.md) を参照してください。

## kiosk 画面構成を選ぶ

kiosk が開くURLのホスト/IPは既定で `localhost` です。kiosk はこのRaspberry Pi自身が動かすアプリを表示するため、通常はLAN側のIPを意識せず `localhost` のままで問題ありません。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -StartKiosk -KioskHost localhost
```

別のホスト名やIPを明示したい場合（証明書のSANに含まれる名前が必要です）:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -StartKiosk -KioskHost 192.168.1.50
```

kiosk 表示は、操作画面のみの `main` と、操作画面 + ダッシュボードの `dual` を選べます。

操作画面のみ:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -StartKiosk -KioskMode main
```

操作画面 + ダッシュボード:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -StartKiosk -KioskMode dual
```

画面サイズと配置も変更できます。形式は `幅x高さ+X位置+Y位置` です。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50 -StartKiosk -KioskMode dual -MainGeometry '1920x1080+0+0' -DashboardGeometry '1920x1080+1920+0'
```

例:

```text
1920x1080+0+0       1枚目のフルHD画面
1920x1080+1920+0    1枚目の右にある2枚目のフルHD画面
3840x2160+1920+0    1枚目の右にある4K画面
1080x1920+0+0       縦向きフルHD画面
```

再デプロイせずに Raspberry Pi 側で切り替える場合は、`~/.config/mccb-kiosk/kiosk.env` を作成または編集します。

```bash
mkdir -p ~/.config/mccb-kiosk
nano ~/.config/mccb-kiosk/kiosk.env
```

操作画面のみ:

```ini
KIOSK_MODE=main
MAIN_GEOMETRY=1920x1080+0+0
MAIN_SCALE=1
```

2画面:

```ini
KIOSK_MODE=dual
MAIN_GEOMETRY=1920x1080+0+0
DASHBOARD_GEOMETRY=3840x2160+1920+0
MAIN_SCALE=1
DASHBOARD_SCALE=1.5
```

kiosk が開くURLのホスト/IPを変更する場合（既定は `localhost`）:

```ini
APP_URL=https://192.168.1.50
```

反映:

```bash
systemctl --user restart mccb-kiosk.service
```

## デプロイ処理の内容

1. PC 側で `node_modules` が無ければ `npm ci` を実行します。
2. PC 側で `npm run build` を実行します。
3. アプリ本体、`src/shared/`、サーバ実行に必要な `node_modules` だけを zip 化します。
4. Raspberry Pi の `/tmp/mccb-manager-deploy.zip` へ転送します。
5. 既定では Raspberry Pi の `$HOME/mccb-manager` へ展開します。
6. `-BootstrapLite` 指定時は、Lite 用パッケージ、Node.js 24 以上、最小Xサービスをセットアップします。
7. `mccb-manager.service` を systemd のシステムサービスとして登録します。
8. Raspberry Pi OS with Desktop（通常OS）が検出された場合は停止します。Lite 64-bit を使用してください。
9. `nginx` が入っている場合だけ、自己署名証明書を作成し、443 番 HTTPS 公開と 80 番からのリダイレクトを設定します。
10. Chromium と `xset` が入っている場合だけ、Lite kiosk サービスを登録します。

PC 側の `data/` ディレクトリはアップロードしません。Raspberry Pi 側にある `data/mccb_data.sqlite` と `data/backups/` は保持されます。

配布ZIPに含める主な内容:

```text
package.json
package-lock.json
node_modules/
server.js
dbStore.js
server/
src/shared/
dist/
deploy/
README.md
```

`node_modules/` は全体ではなく、`express`、`cors` とその依存パッケージだけを含めます。React、Vite、Star WebUSB などのフロントエンド用パッケージは `dist/` にビルド済みのため、Raspberry Pi へ毎回転送しません。

## アクセス URL

`nginx` がある場合:

```text
https://<Raspberry Pi IP>/#/
https://<Raspberry Pi IP>/#/monitor
```

`nginx` が無い場合:

```text
http://<Raspberry Pi IP>:5000/#/
http://<Raspberry Pi IP>:5000/#/monitor
```

## Raspberry Pi 側の状態確認

```bash
systemctl status mccb-manager.service
journalctl -u mccb-manager.service --no-pager -n 80
systemctl status nginx
systemctl status mccb-xsession.service
systemctl --user status mccb-kiosk.service
```

## kiosk 画面が出ない場合

アプリサーバーが起動していて画面だけ出ない場合は、最小XまたはChromium kioskを確認します。

```bash
systemctl status mccb-xsession.service --no-pager -n 30
systemctl --user status mccb-kiosk.service --no-pager -n 30
journalctl -u mccb-xsession.service --no-pager -n 80
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

`mccb-xsession.service is not registered` または `Unit mccb-xsession.service could not be found` の場合は、初回Liteセットアップが未実行です。

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi SKIP_APT=1 bash deploy/raspi/setup-lite-os.sh
sudo systemctl restart mccb-xsession.service
systemctl --user restart mccb-kiosk.service
```

HDMIを後から挿した場合や画面が黒い場合は、Raspberry Piを再起動するとXorgが表示デバイスを掴み直します。

```bash
sudo reboot
```

## 関連ドキュメント

- [Raspberry Pi OS Lite 導入手順](README-lite.md)
- [取扱説明・運用ガイド](../../docs/operation-guide.md)
- [システム構成](../../docs/system-architecture.md)
