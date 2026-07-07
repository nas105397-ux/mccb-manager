# ハードウェア構成図

MCCB Manager の標準構成は、メイン Raspberry Pi 1 台をアプリサーバー、DB、キオスク端末として使う構成です。必要に応じてディスプレイ、プリンター、LAN を接続します。

## 標準構成

```mermaid
flowchart LR
  Power[安定化電源\nUSB-C]
  Network[有線 LAN / Wi-Fi\n保守・拡張端末用]
  MainPi[メイン Raspberry Pi 5\nアプリ / DB / kiosk]
  MainDisplay[メイン操作ディスプレイ\nHDMI]
  MonitorDisplay[モニターディスプレイ\nHDMI / 任意]
  Printer[スター精密プリンター\nUSB / 任意]

  Power --> MainPi
  Network -.-> MainPi
  MainPi -->|HDMI| MainDisplay
  MainPi -.->|HDMI| MonitorDisplay
  MainPi -.->|USB / WebUSB| Printer
```

- Raspberry Pi 5 を推奨します。
- OS は Raspberry Pi OS Lite 64-bit を使用します。
- 1 台運用だけなら LAN 常時接続は必須ではありませんが、保守、更新、PC・タブレット接続を行う場合は固定 IP を推奨します。
- プリンターは、印刷操作を行う端末へ USB 接続します。標準構成ではメイン Raspberry Pi に接続します。

## 役割別の機器一覧

| 区分 | 機器 | 役割 | 備考 |
| --- | --- | --- | --- |
| サーバー / 操作端末 | メイン Raspberry Pi 5 推奨 | Web アプリ、API、SQLite DB、バックアップ、kiosk 表示を 1 台で常時稼働 | Node.js 24 以上を使用 |
| ストレージ | microSD カード | OS、アプリ、`data/mccb_data.sqlite`、`data/backups/` を保存 | 定期的な DB バックアップ取得を推奨 |
| ネットワーク | 有線 LAN / Wi-Fi | 保守、更新、拡張端末接続 | 固定 IP 推奨 |
| 表示 | HDMI ディスプレイ | Pi 本体の kiosk 表示 | メイン操作画面とモニター画面の 2 画面構成も可能 |
| 操作端末 | PC / タブレット / Pi kiosk | `https://<Raspberry Pi の IP>/#/` を開いて操作 | WebUSB 印刷には Chrome/Edge と安全なコンテキストが必要 |
| 印刷 | スター精密プリンター | 停電依頼表などを印刷 | 印刷操作を行う端末へ USB 接続 |

## 標準構成の通信

```mermaid
flowchart LR
  Client[利用端末\nPi kiosk / PC / タブレット]
  Nginx[Nginx\n80 -> 443\n443 HTTPS]
  App[Node.js Express\n127.0.0.1:5000]
  Db[(SQLite DB\nRaspberry Pi ローカル)]

  Client -->|HTTPS 443| Nginx
  Client -.->|HTTP 80 は HTTPS へ転送| Nginx
  Nginx -->|localhost proxy| App
  App -->|ローカルファイルアクセス| Db
```

- Pi 本体の kiosk は `https://localhost/#/` または `https://<Raspberry Pi の IP>/#/` を開きます。
- PC・タブレットから使う場合は `https://<Raspberry Pi の IP>/#/` を開きます。
- Nginx は 80 番を 443 番へリダイレクトし、443 番で Express にリバースプロキシします。
- Express は Raspberry Pi 内部の `127.0.0.1:5000` で動作します。
- SQLite DB とバックアップは Raspberry Pi のローカルストレージに保存されます。

## OA LAN 接続構成

会社 OA LAN から事務所 PC で操作し、現場側 Raspberry Pi でも同じ画面を kiosk 表示する拡張構成です。メイン Raspberry Pi は 2 LAN 構成にし、OA LAN 側と現場 LAN 側の接続点にします。

OA LAN と現場 LAN は切り離して運用します。メイン Raspberry Pi は両方の LAN に接続しますが、OA LAN と現場 LAN の間でパケットを転送するルーターやブリッジにはしません。両側の端末は、メイン Raspberry Pi 上の MCCB Manager へ HTTPS で接続します。

実機設定の具体案は [Raspberry Pi OA LAN 接続設定案](raspberry-pi-oalan-settings.md) にまとめています。

```mermaid
flowchart LR
  OfficePc[事務所 PC]
  OaLan[OA LAN]
  MainPi[メイン Raspberry Pi\nLAN 1: OA LAN\nLAN 2: 現場 LAN]
  FieldHub[現場 HUB]
  FieldPi1[現場 Raspberry Pi A\nkiosk]
  FieldPi2[現場 Raspberry Pi B\nkiosk]
  FieldPiN[現場 Raspberry Pi N\nkiosk]

  OfficePc -->|HTTPS| OaLan
  OaLan -->|LAN 1| MainPi
  MainPi -->|LAN 2| FieldHub
  FieldHub --> FieldPi1
  FieldHub --> FieldPi2
  FieldHub --> FieldPiN
  FieldPi1 -->|HTTPS でメイン Pi を表示| MainPi
  FieldPi2 -->|HTTPS でメイン Pi を表示| MainPi
  FieldPiN -->|HTTPS でメイン Pi を表示| MainPi
```

### 機器ごとの役割

| 機器 | LAN 接続 | 役割 |
| --- | --- | --- |
| 事務所 PC | OA LAN に接続 | ブラウザで MCCB Manager を操作 |
| OA LAN | 事務所 PC とメイン Raspberry Pi の LAN 1 を接続 | 事務所側ネットワーク |
| メイン Raspberry Pi | LAN 1: OA LAN、LAN 2: 現場 HUB | Web アプリ、SQLite DB、kiosk、両 LAN からの HTTPS 入口 |
| 現場 HUB | メイン Raspberry Pi の LAN 2 と現場 Raspberry Pi を接続 | 現場側端末の集約 |
| 現場 Raspberry Pi | 現場 HUB に接続 | メイン Raspberry Pi の画面を kiosk 表示 |

### IP アドレス例

```text
OA LAN:        192.168.10.0/24
Main Pi LAN1:  192.168.10.50

現場 LAN:      192.168.40.0/24
Main Pi LAN2:  192.168.40.111
現場 Pi:       192.168.40.121, 192.168.40.122 ...
```

この場合、事務所 PC は `https://192.168.10.50/#/`、現場 Raspberry Pi は `https://192.168.40.111/#/` を開きます。どちらも同じ MCCB Manager を表示しますが、OA LAN と現場 LAN の端末同士は直接通信しません。

### ネットワーク分離の方針

| 項目 | 方針 |
| --- | --- |
| セグメント | OA LAN と現場 LAN は別 IP セグメントにする |
| L2 接続 | ブリッジ接続はしない。HUB 同士を直接つながない |
| L3 転送 | メイン Raspberry Pi の IP フォワーディング、NAT、ルーティングは無効にする |
| 公開サービス | 両 LAN に公開するのは Nginx の `443/tcp` を基本にする |
| アプリ API | Express は `127.0.0.1:5000` のみで待ち受け、Nginx 経由に限定する |
| SSH | 保守端末の固定 IP だけ許可し、常時開放しない |
| 名前解決 | 必要なら OA LAN 用と現場 LAN 用で別名または別 IP を使う |
| 更新通信 | OS やアプリ更新の経路を決め、現場 LAN から OA LAN や外部へ直接出さない |

## 構成検討チェックリスト

| 項目 | 確認内容 |
| --- | --- |
| メイン Raspberry Pi の配置 | OA LAN と現場 HUB の両方へ接続できる場所、電源、UPS、保守性 |
| LAN ポート | 2 LAN 構成にする。内蔵 LAN + USB LAN アダプターなどを想定 |
| IP アドレス設計 | メイン Raspberry Pi の OA LAN 側 IP、現場 LAN 側 IP、現場 Raspberry Pi の固定 IP |
| 通信制御 | 事務所 PC・現場 Pi からメイン Pi への HTTPS、保守用 SSH の接続元制限 |
| 認証 | 事務所 PC からの操作権限、管理者権限、パスワード運用 |
| HTTPS 証明書 | OA LAN 端末と現場 Raspberry Pi で警告なく使える証明書配布または社内 CA 利用 |
| DB / バックアップ | SQLite DB バックアップ、microSD 障害対策、復旧手順 |
| 障害時運用 | メイン Raspberry Pi 停止時に全端末が操作不可になるため、予備機または復旧手順を用意 |
| 印刷 | メイン Raspberry Pi 接続プリンターで印刷するか、事務所 PC 側で印刷するか |

## WebUSB 印刷時の注意

- プリンターは、印刷操作を行う端末に USB 接続します。
- WebUSB を使う端末は Chrome/Edge を利用し、`localhost` または HTTPS の安全なコンテキストでアプリを開きます。
- タブレットなど USB 接続できない端末では、操作は可能でも WebUSB 印刷はできない場合があります。
