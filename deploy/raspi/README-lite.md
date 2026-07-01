# Raspberry Pi OS Lite kiosk setup

Raspberry Pi OS LiteでMCCB Managerを動かすための手順です。

Liteではデスクトップ環境を入れず、最小のX + Openbox + Chromiumだけでkiosk表示します。Piをサーバー専用にして別端末から見る場合は、kiosk関連は不要です。

## 推奨構成

```text
Raspberry Pi OS Lite 64-bit
Node.js 24+
nginx
unzip or python3
MCCB Manager systemd service

kiosk表示する場合:
  xserver-xorg
  xinit
  openbox
  chromium
  x11-xserver-utils
  fontconfig
  fonts-noto-cjk
  fonts-noto-cjk-extra
  fonts-noto-color-emoji
```

## 1. Raspberry Pi OS Liteを書き込む

Raspberry Pi Imagerで以下を設定します。

```text
OS: Raspberry Pi OS Lite 64-bit
ユーザー: pi
SSH: 有効
Wi-Fiまたは有線LAN: 現場環境に合わせる
```

初回起動後、PCからSSH接続します。

```bash
ssh pi@<Raspberry Pi IP>
```

## 2. OSを更新する

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

再起動後、再度SSH接続します。

## 3. Lite用の最小GUI環境を入れる

先に必要パッケージだけ手動で入れる場合は、以下を実行します。

kiosk表示あり:

```bash
sudo apt update
sudo apt install -y --no-install-recommends ca-certificates curl unzip nginx xserver-xorg xserver-xorg-legacy xinit openbox x11-xserver-utils dbus-x11 chromium fontconfig fonts-noto-cjk fonts-noto-cjk-extra fonts-noto-color-emoji
```

日本語入力も使う場合:

```bash
sudo apt install -y --no-install-recommends fontconfig fonts-noto-cjk fonts-noto-cjk-extra fcitx5 fcitx5-frontend-gtk3 fcitx5-mozc
```

Pi本体に画面を出さず、別PCやタブレットから見るだけの場合:

```bash
sudo apt update
sudo apt install -y --no-install-recommends ca-certificates curl unzip nginx
```

`unzip` を入れない場合でも、`python3` があればデプロイZIPは展開できます。

```bash
command -v unzip || command -v python3
```

アプリをPiへ配置した後でも実行できますが、先にこのスクリプトを置ける場合は以下を実行します。上のパッケージ導入と最小Xサービス作成をまとめて行います。

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi bash deploy/raspi/setup-lite-os.sh
```

すでに必要パッケージを入れてあり、サービス作成だけ行う場合:

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi SKIP_APT=1 bash deploy/raspi/setup-lite-os.sh
```

日本語入力も入れる場合:

```bash
sudo TARGET_USER=pi INSTALL_JAPANESE_INPUT=1 bash deploy/raspi/setup-lite-os.sh
```

この指定では `fcitx5-mozc` を入れ、Mozcを既定の日本語入力にする設定も作成します。

画面をPi本体に出さず、別PCやタブレットから見るだけならkioskは不要です。

```bash
sudo TARGET_USER=pi INSTALL_KIOSK=0 bash deploy/raspi/setup-lite-os.sh
```

## 4. Node.js 24+を入れる

既存のデプロイスクリプトはPi上にNode.js 24以上が入っている前提です。

確認:

```bash
node -v
```

`v24.x.x` 以上ならOKです。

入っていない場合は、オンライン環境でNode.js 24以上を入れてからオフライン運用へ移してください。

## 5. PCからアプリをデプロイする

Windows PC側で実行します。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry Pi IP> -StartKiosk
```

クリック実行する場合:

```text
deploy\raspi\deploy-over-ssh.cmd
```

## 6. 再起動する

```bash
sudo reboot
```

再起動後、以下が起動します。

```text
mccb-manager.service  アプリサーバー
nginx                 80番公開
mccb-xsession.service 最小X/Openbox
mccb-kiosk.service    Chromium kiosk
```

マウスカーソルを表示したい場合は、最新の `setup-lite-os.sh` を反映してください。Xorg起動オプションから `-nocursor` を外しています。
カーソルが大きい場合は、kioskサービスの `XCURSOR_SIZE` を小さくします。既定は `24` です。

## 7. 状態確認

```bash
systemctl status mccb-manager.service --no-pager -n 20
systemctl status nginx --no-pager -n 20
systemctl status mccb-xsession.service --no-pager -n 20
systemctl --user status mccb-kiosk.service --no-pager -n 20
```

ログ:

```bash
journalctl -u mccb-manager.service --no-pager -n 80
journalctl -u mccb-xsession.service --no-pager -n 80
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

`mccb-xsession.service` が `status=1/FAILURE` で落ちる場合は、Xwrapper設定を確認します。

```bash
cat /etc/X11/Xwrapper.config
```

以下になっていればOKです。

```text
allowed_users=anybody
needs_root_rights=yes
```

設定を作り直す場合:

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi SKIP_APT=1 bash deploy/raspi/setup-lite-os.sh
sudo systemctl restart mccb-xsession.service
systemctl --user restart mccb-kiosk.service
```

日本語入力を反映した直後は、ユーザー環境変数も読み直すため再起動が確実です。

```bash
sudo reboot
```

ログに `Couldn't get a file descriptor referring to the console.` が出る場合は、最新の `setup-lite-os.sh` を反映して `/dev/tty7` を使うサービス定義に更新してください。

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi SKIP_APT=1 bash deploy/raspi/setup-lite-os.sh
sudo systemctl daemon-reload
sudo systemctl restart mccb-xsession.service
```

ログに `Cannot run in framebuffer mode. Please specify busIDs for all framebuffer devices` が出る場合は、XorgがPiのDRM/KMSデバイスを掴めていません。最新の `setup-lite-os.sh` では `/dev/dri/card*` を検出して `/etc/X11/xorg.conf.d/99-mccb-kiosk.conf` を作成します。

確認:

```bash
ls -l /dev/dri
cat /etc/X11/xorg.conf.d/99-mccb-kiosk.conf
groups pi
```

`card0` で `no screens found` が出る場合は、HDMI出力が `card1` 側にある可能性があります。最新の `setup-lite-os.sh` は `/sys/class/drm/card*-*/status` の `connected` を見て、接続済みディスプレイの `card*` を優先します。

接続状況の確認:

```bash
for f in /sys/class/drm/card*-*/status; do echo "$f: $(cat "$f")"; done
```

設定を作り直す場合:

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi SKIP_APT=1 bash deploy/raspi/setup-lite-os.sh
sudo reboot
```

## 8. よく使う操作

アプリ再起動:

```bash
sudo systemctl restart mccb-manager.service
```

kiosk再起動:

```bash
systemctl --user restart mccb-kiosk.service
```

カーソルサイズ変更:

```bash
systemctl --user edit mccb-kiosk.service
```

```ini
[Service]
Environment=XCURSOR_SIZE=20
```

反映:

```bash
systemctl --user daemon-reload
systemctl --user restart mccb-kiosk.service
```

Chromiumログに `unrecognized flag --no-decommit-pooled-pages` が出る場合は、Raspberry Pi側のChromiumラッパーが古いV8フラグを自動付与しています。最新の `start-kiosk.sh` は `/usr/lib/chromium/chromium` が存在する場合に実体バイナリを直接使い、ラッパー由来のフラグを避けます。

反映:

```bash
cd /home/pi/mccb-manager
systemctl --user restart mccb-kiosk.service
pgrep -a chromium | head
```

最小Xごと再起動:

```bash
sudo systemctl restart mccb-xsession.service
```

kiosk停止:

```bash
systemctl --user stop mccb-kiosk.service
pkill chromium
```

## 9. アクセスURL

nginxあり:

```text
http://<Raspberry Pi IP>/#/
http://<Raspberry Pi IP>/#/monitor
```

nginxなし:

```text
http://<Raspberry Pi IP>:5000/#/
http://<Raspberry Pi IP>:5000/#/monitor
```

## 注意

- `data/` は運用DBです。再デプロイ時に上書きしないでください。
- LiteではDesktop版の設定画面がありません。画面回転、解像度、ネットワーク固定IPなどはCLIで設定します。
- Pi本体表示が不要なら、kioskを入れずサーバー専用にした方が最も軽くなります。
