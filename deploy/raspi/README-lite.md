# Raspberry Pi OS Lite kiosk setup

Raspberry Pi OS LiteでMCCB Managerを動かすための手順です。

Liteではデスクトップ環境を入れず、最小のX + Openbox + Chromiumだけでkiosk表示します。Piをサーバー専用にして別端末から見る場合は、kiosk関連は不要です。

## 推奨構成

```text
Raspberry Pi OS Lite 64-bit
Node.js 24+
nginx
MCCB Manager systemd service

kiosk表示する場合:
  xserver-xorg
  xinit
  openbox
  chromium
  x11-xserver-utils
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

アプリをPiへ配置した後でも実行できますが、先にこのスクリプトを置ける場合は以下を実行します。

```bash
cd /home/pi/mccb-manager
sudo TARGET_USER=pi bash deploy/raspi/setup-lite-os.sh
```

日本語入力も入れる場合:

```bash
sudo TARGET_USER=pi INSTALL_JAPANESE_INPUT=1 bash deploy/raspi/setup-lite-os.sh
```

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

## 8. よく使う操作

アプリ再起動:

```bash
sudo systemctl restart mccb-manager.service
```

kiosk再起動:

```bash
systemctl --user restart mccb-kiosk.service
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
