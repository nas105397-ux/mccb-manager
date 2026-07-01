# Raspberry Pi オフライン SSH デプロイ

この手順は、Raspberry Pi をインターネットへ接続しない運用を前提にしています。

PC 側でアプリをビルドし、`dist/`、サーバーファイル、`src/shared/`、`deploy/`、`node_modules` をまとめて SSH で Raspberry Pi へ転送します。Raspberry Pi 側のセットアップでは `apt`、NodeSource、`npm install` は実行しません。

## Raspberry Pi イメージの事前準備

Raspberry Pi をオフライン運用にする前に、イメージへ以下を入れておいてください。

- Node.js 24 以上
- `unzip` または `python3`（配布ZIPの展開に使用）
- `systemd`
- `systemd --user`（kiosk表示を使う場合）
- 80 番ポートで公開する場合は `nginx`
- kiosk 表示を使う場合は `chromium` または `chromium-browser` と `xset`
- kiosk 表示で日本語を表示する場合は `fontconfig`、`fonts-noto-cjk`、`fonts-noto-cjk-extra`、`fonts-noto-color-emoji`

`nginx` が無くてもアプリは動作します。その場合は 5000 番ポートでアクセスします。

先に必要パッケージを入れる場合:

```bash
sudo apt update
sudo apt install -y --no-install-recommends unzip nginx
```

kiosk表示も使う場合:

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

## デプロイ処理の内容

1. PC 側で `node_modules` が無ければ `npm ci` を実行します。
2. PC 側で `npm run build` を実行します。
3. アプリ本体、`src/shared/`、`node_modules` を zip 化します。
4. Raspberry Pi の `/tmp/mccb-manager-deploy.zip` へ転送します。
5. 既定では Raspberry Pi の `$HOME/mccb-manager` へ展開します。
6. `mccb-manager.service` を systemd のシステムサービスとして登録します。
7. `nginx` が入っている場合だけ、80 番ポート公開の設定を行います。
8. Chromium と `xset` が入っている場合だけ、kiosk サービスを登録します。

PC 側の `data/` ディレクトリはアップロードしません。Raspberry Pi 側にある `data/mccb_data.sqlite` と `data/backups/` は保持されます。

配布ZIPに含める主な内容:

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

## アクセス URL

`nginx` がある場合:

```text
http://<Raspberry Pi IP>/#/
http://<Raspberry Pi IP>/#/monitor
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
