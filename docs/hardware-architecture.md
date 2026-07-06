# ハードウェア構成図

MCCB Manager の標準構成は、Raspberry Pi をアプリサーバー兼キオスク端末として使い、LAN 内の PC・タブレットから同じ Web 画面にアクセスする構成です。印刷が必要な端末にはスター精密プリンターを USB 接続し、ブラウザの WebUSB から直接印刷します。

## 標準構成

```mermaid
flowchart LR
  subgraph Site[現場 LAN]
    Router[LAN ルーター / スイッチ]

    subgraph PiBox[Raspberry Pi 5 推奨]
      Pi[Raspberry Pi OS Lite 64-bit]
      Storage[microSD カード\nアプリ / SQLite DB / バックアップ]
      Node[Node.js 24+\nExpress API]
      Nginx[Nginx\nHTTPS 443 / HTTP 80]
      Chromium[Chromium キオスク\n任意]
    end

    MainDisplay[メイン操作用ディスプレイ\nHDMI]
    MonitorDisplay[電気室モニター用ディスプレイ\nHDMI / 任意]
    ClientPc[事務所 PC\nChrome / Edge]
    Tablet[タブレット\nブラウザ]
    UsbPrinter[スター精密プリンター\nUSB / WebUSB]
  end

  Router <-->|有線 LAN または Wi-Fi| Pi
  Router <-->|HTTPS| ClientPc
  Router <-->|HTTPS| Tablet

  Pi --> Storage
  Pi --> Node
  Pi --> Nginx
  Pi --> Chromium
  Pi -->|HDMI| MainDisplay
  Pi -->|HDMI / 任意| MonitorDisplay

  ClientPc -.->|USB 接続端末で印刷| UsbPrinter
  Pi -.->|USB 接続時はキオスクから印刷可| UsbPrinter
  Tablet -.->|USB 非対応端末は通常印刷対象外| UsbPrinter
```

## 接続パターン

```mermaid
flowchart TB
  subgraph ServerSide[Raspberry Pi 側]
    PiPower[電源\n安定した USB-C 電源推奨]
    PiLan[有線 LAN 推奨\n固定 IP 例: 192.168.40.111]
    PiHdmi1[HDMI 1\nメイン操作画面]
    PiHdmi2[HDMI 2\nモニター画面 任意]
    PiUsb[USB\nプリンター接続 任意]
  end

  subgraph NetworkSide[LAN 側]
    Switch[スイッチ / ルーター]
    Pc[PC]
    Mobile[タブレット]
  end

  PiPower --> PiLan
  PiLan --> Switch
  Switch --> Pc
  Switch --> Mobile
  PiHdmi1 --> MainScreen[操作画面ディスプレイ]
  PiHdmi2 --> DashboardScreen[電気室モニターディスプレイ]
  PiUsb --> Printer[スター精密プリンター]
```

## 役割別の機器一覧

| 区分 | 機器 | 役割 | 備考 |
| --- | --- | --- | --- |
| サーバー | Raspberry Pi 5 推奨 | Web アプリ、API、SQLite DB、バックアップを常時稼働 | Node.js 24 以上を使用 |
| ストレージ | microSD カード | OS、アプリ、`data/mccb_data.sqlite`、`data/backups/` を保存 | 定期的な DB バックアップ取得を推奨 |
| ネットワーク | LAN ルーター / スイッチ | Pi、PC、タブレットを同一 LAN に接続 | 運用時は固定 IP が分かりやすい |
| 表示 | HDMI ディスプレイ | Pi 本体のキオスク表示 | メイン操作画面とモニター画面の 2 画面構成も可能 |
| 操作端末 | PC / タブレット | `https://<Raspberry Pi の IP>/#/` を開いて操作 | WebUSB 印刷は Chrome/Edge かつ HTTPS または localhost が必要 |
| 印刷 | スター精密プリンター | 停電依頼表などを印刷 | USB 接続した端末のブラウザから WebUSB で印刷 |

## 通信とポート

```mermaid
flowchart LR
  Client[PC / タブレット / キオスク Chromium]
  Nginx[Nginx on Raspberry Pi\n80 -> 443 リダイレクト\n443 HTTPS]
  App[Node.js Express\n127.0.0.1:5000]
  Db[(SQLite DB\nRaspberry Pi ローカル)]

  Client -->|HTTPS 443| Nginx
  Client -.->|HTTP 80 は HTTPS へ転送| Nginx
  Nginx -->|localhost proxy| App
  App -->|ローカルファイルアクセス| Db
```

- LAN 端末からは `https://<Raspberry Pi の IP>/#/` にアクセスします。
- Nginx は 80 番を 443 番へリダイレクトし、443 番で Express にリバースプロキシします。
- Express は Raspberry Pi 内部の `127.0.0.1:5000` で動作します。
- SQLite DB とバックアップは Raspberry Pi のローカルストレージに保存されます。

## WebUSB 印刷時の注意

- プリンターは、印刷操作を行う端末に USB 接続します。
- WebUSB を使う端末は Chrome/Edge を利用し、`localhost` または HTTPS の安全なコンテキストでアプリを開きます。
- タブレットなど USB 接続できない端末では、操作は可能でも WebUSB 印刷はできない場合があります。
