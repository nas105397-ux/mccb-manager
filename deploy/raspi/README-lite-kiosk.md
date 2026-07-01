# Raspberry Pi OS Lite kiosk setup

Raspberry Pi OS Lite から MCCB Manager の kiosk 端末を作る手順です。
通常の Raspberry Pi OS Desktop とは別に、Lite へ必要な最小 GUI と Chromium だけを追加します。

## 方針

- OS は Raspberry Pi OS Lite 64-bit を使う
- アプリは `mccb-manager.service` で常駐させる
- 表示は Xorg + openbox + Chromium kiosk で起動する
- Windows PC 側でビルドして、SSH で Raspberry Pi へ転送する
- Raspberry Pi 側では運用データ `data/` を保持する

## 1. Raspberry Pi Imager の設定

Raspberry Pi Imager で次の内容にします。

- OS: Raspberry Pi OS Lite 64-bit
- SSH: 有効
- ユーザー名: pi
- パスワード: passwd
- Wi-Fi または有線 LAN: 運用環境に合わせる
- Hostname: pi
- Timezone: `Asia/Tokyo`

初回起動後、PC から SSH で接続できることを確認します。

```bash
ssh pi@<Raspberry Pi IP>
```

## 2. 有線 LAN の IP を固定する

固定 IP は Raspberry Pi 側で `nmcli` を使って設定します。
例では次の値にしています。現場のネットワークに合わせて変更してください。

```text
Raspberry Pi IP: 192.168.40.111/24
Gateway:         192.168.40.1
DNS:             192.168.40.1 8.8.8.8
```

まず接続名を確認します。

```bash
nmcli connection show
nmcli device status
```

有線 LAN の接続名が `Wired connection 1` の場合:

```bash
sudo nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses 192.168.40.111/24 \
  ipv4.gateway 192.168.40.1 \
  ipv4.dns "192.168.40.1 8.8.8.8"

sudo nmcli connection down "Wired connection 1"
sudo nmcli connection up "Wired connection 1"
```

設定後に確認します。

```bash
ip addr show eth0
ip route
ping -c 3 192.168.40.1
ping -c 3 google.com
```

接続名が違う場合は、`"Wired connection 1"` の部分を `nmcli connection show` で表示された名前に置き換えてください。
ルーター側で DHCP 予約を使える場合は、Raspberry Pi 側では固定せず、ルーター側で IP を固定する方法でも問題ありません。

## 3. Wi-Fi の操作

有線 LAN を使う場合でも、保守用に Wi-Fi の確認方法を残しておきます。

Wi-Fi の状態確認:

```bash
nmcli radio wifi
nmcli device status
nmcli connection show
```

Wi-Fi を有効化:

```bash
sudo nmcli radio wifi on
```

SSID を検索:

```bash
nmcli device wifi list
```

Wi-Fi に接続:

```bash
sudo nmcli device wifi connect "SSID名" password "Wi-Fiパスワード"
```

接続確認:

```bash
ip addr
ping -c 3 192.168.40.1
ping -c 3 google.com
```

登録済み Wi-Fi を再接続:

```bash
sudo nmcli connection up "SSID名"
```

Wi-Fi を切断:

```bash
sudo nmcli connection down "SSID名"
```

Wi-Fi を無効化:

```bash
sudo nmcli radio wifi off
```

登録済み Wi-Fi 設定を削除:

```bash
sudo nmcli connection delete "SSID名"
```

Wi-Fi 側も固定 IP にする場合:

```bash
sudo nmcli connection modify "SSID名" \
  ipv4.method manual \
  ipv4.addresses 192.168.40.112/24 \
  ipv4.gateway 192.168.40.1 \
  ipv4.dns "192.168.40.1 8.8.8.8"

sudo nmcli connection down "SSID名"
sudo nmcli connection up "SSID名"
```

メインサーバーは有線 LAN の `192.168.40.111` を使う想定です。
Wi-Fi を同時に使う場合は、同じ IP を有線 LAN と Wi-Fi の両方に設定しないでください。

## 4. Bluetooth の操作

Bluetooth キーボードやマウスを使う場合は、`bluetoothctl` で設定します。

必要なパッケージを入れます。

```bash
sudo apt install -y bluetooth bluez
sudo systemctl enable --now bluetooth
```

Bluetooth の状態確認:

```bash
systemctl status bluetooth
bluetoothctl show
```

対話モードを開始:

```bash
bluetoothctl
```

`bluetoothctl` の中で次を実行します。

```text
power on
agent on
default-agent
scan on
```

接続したい機器の MAC アドレスが表示されたら、次を実行します。

```text
pair XX:XX:XX:XX:XX:XX
trust XX:XX:XX:XX:XX:XX
connect XX:XX:XX:XX:XX:XX
scan off
quit
```

登録済み機器の確認:

```bash
bluetoothctl devices
bluetoothctl paired-devices
```

再接続:

```bash
bluetoothctl connect XX:XX:XX:XX:XX:XX
```

切断:

```bash
bluetoothctl disconnect XX:XX:XX:XX:XX:XX
```

登録削除:

```bash
bluetoothctl remove XX:XX:XX:XX:XX:XX
```

Bluetooth を停止する場合:

```bash
sudo systemctl stop bluetooth
```

Bluetooth を自動起動しない場合:

```bash
sudo systemctl disable bluetooth
```

## 5. Lite に kiosk 用パッケージを入れる

通常の Raspberry Pi OS Desktop を見本に、Lite へ足りない実行環境だけを入れます。
ポイントは次の通りです。

- アプリ常駐、zip 展開、nginx 公開に必要な基本パッケージ
- Xorg、openbox、Chromium kiosk に必要な最小 GUI
- 通常 OS Desktop と同じように日本語表示が崩れないフォント
- NodeSource 追加に必要な `curl`、証明書、GPG 周辺

Raspberry Pi に SSH で入り、まず共通パッケージを入れます。

```bash
sudo apt update
sudo apt install -y \
  ca-certificates \
  curl \
  gnupg \
  unzip \
  nginx \
  dbus-x11 \
  xserver-xorg \
  xinit \
  openbox \
  x11-xserver-utils \
  unclutter \
  fonts-noto-cjk \
  fonts-noto-color-emoji
```

次に Chromium を入れます。Raspberry Pi OS のイメージやリポジトリ状態でパッケージ名が違う場合があるため、片方が失敗したらもう片方を試します。

```bash
sudo apt install -y chromium-browser || sudo apt install -y chromium
```

日本語入力が必要な場合だけ、通常 OS Desktop と同じ扱いで IME を追加します。

```bash
sudo apt install -y fcitx5 fcitx5-mozc
```

Bluetooth キーボードやマウスを使う場合だけ、Bluetooth 関連を追加します。

```bash
sudo apt install -y bluetooth bluez
sudo systemctl enable --now bluetooth
```

インストール後、kiosk に必要なコマンドが見つかることを確認します。

```bash
command -v startx
command -v openbox-session
command -v xset
command -v chromium-browser || command -v chromium
```

## 6. Node.js 24 以上を入れる

このアプリは `node:sqlite` を使うため、Node.js 24 以上が必要です。
Raspberry Pi に SSH で入り、NodeSource の Debian/Raspberry Pi OS 向けリポジトリから入れます。

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

インストール後、次が通ることを確認します。

```bash
node -v
npm -v
node -e "require('node:sqlite').DatabaseSync"
```

`node:sqlite` でエラーが出る場合は、Node.js のバージョンが古いです。

## 7. 自動ログインを有効にする

Lite 起動後に指定ユーザーで自動ログインさせます。

```bash
sudo raspi-config
```

`System Options` -> `Boot / Auto Login` から、console autologin を選びます。
メニュー名は OS バージョンで少し変わる場合があります。

## 8. Xorg と kiosk をログイン時に起動する

ホームディレクトリに `.bash_profile` を作ります。

```bash
nano ~/.bash_profile
```

内容:

```bash
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx -- -nocursor
fi
```

次に `.xinitrc` を作ります。

```bash
nano ~/.xinitrc
```

内容:

```bash
if command -v dbus-launch >/dev/null 2>&1 && [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
  eval "$(dbus-launch --sh-syntax)"
fi

xset s off
xset -dpms
xset s noblank
unclutter -idle 0.5 -root &
openbox-session &

sleep 3
systemctl --user restart mccb-kiosk.service

wait
```

## 9. Windows PC からデプロイする

リポジトリのルートで実行します。

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry Pi IP> -StartKiosk
```

メインサーバーを `192.168.40.111` にした場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.40.111 -StartKiosk
```

Lite では SSH デプロイ直後に Xorg が起動していない場合、kiosk の即時起動に失敗することがあります。
その場合でもアプリと service の登録が完了していれば問題ありません。次の再起動後に kiosk を確認します。

SSH ポートが 22 以外の場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry Pi IP> -Port 2222 -StartKiosk
```

デプロイ先を変える場合:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry Pi IP> -AppDir '/home/pi/mccb-manager' -StartKiosk
```

## 10. 再起動して確認する

```bash
sudo reboot
```

起動後、Chromium が kiosk 表示になれば完了です。

別 PC からも次で確認できます。

```text
http://<Raspberry Pi IP>/#/
http://<Raspberry Pi IP>/#/monitor
```

メインサーバーが `192.168.40.111` の場合:

```text
http://192.168.40.111/#/
http://192.168.40.111/#/monitor
```

## 11. 状態確認

アプリサーバー:

```bash
systemctl status mccb-manager.service
journalctl -u mccb-manager.service --no-pager -n 80
```

kiosk:

```bash
systemctl --user status mccb-kiosk.service
journalctl --user -u mccb-kiosk.service --no-pager -n 80
```

nginx:

```bash
systemctl status nginx
sudo nginx -t
```

画面スリープ:

```bash
DISPLAY=:0 xset q
```

次の状態なら問題ありません。

```text
Screen Saver timeout: 0
DPMS is Disabled
```

## 12. よく使う操作

kiosk 再起動:

```bash
systemctl --user restart mccb-kiosk.service
```

kiosk 停止:

```bash
systemctl --user stop mccb-kiosk.service
pkill chromium
```

アプリサーバー再起動:

```bash
sudo systemctl restart mccb-manager.service
```

SSH デプロイ中に `Connection timed out` が出た場合:

```powershell
Test-NetConnection 192.168.40.111 -Port 22
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@192.168.40.111 -StartKiosk
```

ZIP 転送後に失敗した場合でも、再実行して問題ありません。`data/` はデプロイ対象に含めないため、既存の運用 DB は保持されます。
同じ IP を別機器や Wi-Fi と有線 LAN の両方に設定していないかも確認してください。

kiosk が `ExecStartPre=/usr/bin/xset s off` で失敗する場合:

```bash
sed -i 's|^ExecStartPre=/usr/bin/xset|ExecStartPre=-/usr/bin/xset|' ~/.config/systemd/user/mccb-kiosk.service
systemctl --user daemon-reload
systemctl --user reset-failed mccb-kiosk.service
systemctl --user restart mccb-kiosk.service
```

まだ Xorg が起動していない状態では kiosk は表示できません。
Lite では tty1 の自動ログインから `.bash_profile` -> `startx` -> `.xinitrc` の順に起動しているか確認し、必要なら再起動します。

## 13. 注意点

- 通常の Raspberry Pi OS Desktop を使う場合は、この手順ではなく既存の SSH デプロイ手順を使います。
- Lite で kiosk を使う場合は、必ず `-StartKiosk` を付けてデプロイします。
- `data/` は運用データです。更新時に上書きしないでください。
- 画面が出ない場合は、まず `startx` が単体で起動できるか確認してください。
