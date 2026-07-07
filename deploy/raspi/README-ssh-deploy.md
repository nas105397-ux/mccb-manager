# Raspberry Pi オフライン SSH デプロイ

この手順は、Raspberry Pi OS Lite 64-bit 固定で、Raspberry Pi をインターネットへ接続しない運用を前提にしています。Raspberry Pi OS with Desktop（通常OS）は使用しません。

PC 側でアプリをビルドし、`dist/`、サーバーファイル、`src/shared/`、`deploy/`、サーバ実行に必要な `node_modules` だけをまとめて SSH で Raspberry Pi へ転送します。Raspberry Pi 側のセットアップでは `apt`、NodeSource、`npm install` は実行しません。

Lite OS の初期セットアップは `deploy/raspi/README-lite.md` を参照してください。

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

`deploy\raspi\deploy-over-ssh.cmd` をダブルクリックしてください。接続先、SSH ポート、配置先を順番に入力できます。

### PowerShell から直接実行する場合

リポジトリのルートで PowerShell を開いて、次を実行します。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.1.50
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

## デプロイ処理の内容

1. PC 側で `node_modules` が無ければ `npm ci` を実行します。
2. PC 側で `npm run build` を実行します。
3. アプリ本体、`src/shared/`、サーバ実行に必要な `node_modules` だけを zip 化します。
4. Raspberry Pi の `/tmp/mccb-manager-deploy.zip` へ転送します。
5. 既定では Raspberry Pi の `$HOME/mccb-manager` へ展開します。
6. `mccb-manager.service` を systemd のシステムサービスとして登録します。
7. Raspberry Pi OS with Desktop（通常OS）が検出された場合は停止します。Lite 64-bit を使用してください。
8. `nginx` が入っている場合だけ、自己署名証明書を作成し、443 番 HTTPS 公開と 80 番からのリダイレクトを設定します。
9. Chromium と `xset` が入っている場合だけ、Lite kiosk サービスを登録します。

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
systemctl --user status mccb-kiosk.service
```
