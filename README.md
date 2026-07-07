# MCCB Manager

操作禁止札、停電依頼、子札貸出を管理する Web アプリです。
Raspberry Pi で常時稼働させ、Pi 本体の kiosk 画面、PC、タブレットから同じ画面を開いて使います。

## できること

- 設備ごとの送電中、停電中、依頼発行中、札返却済みの状態管理
- 子札の貸出、返却、未返却チェック
- 停電依頼表の作成、印刷、再印刷、履歴管理
- 設備、電気室、区分、設備グループの管理
- CSV 取り込み、CSV 出力、操作ログ確認、SQLite DB バックアップ

## 利用画面

Raspberry Pi で動かしている場合:

```text
https://<Raspberry PiのIP>/#/
```

例:

```text
https://192.168.40.111/#/
```

主な画面:

| 画面 | URL | 使う場面 |
| --- | --- | --- |
| メイン操作 | `/#/` | 設備の検索、停電・送電、子札貸出 |
| 停電依頼作成 | `/#/request` | 停電依頼表の作成、印刷 |
| 依頼一覧 | `/#/request-list` | 進行中依頼、履歴、再印刷、作業完了 |
| 電気室モニター | `/#/monitor` | モニター表示用 |
| 管理画面 | `/#/admin` | 設備登録、CSV、マスター、ログ、DB バックアップ |

管理者モードの初期パスワードは `admin` です。本番運用前に変更してください。

WebUSB 印刷を使う端末では、Chrome/Edge で `localhost` または HTTPS から開く必要があります。Raspberry Pi の LAN URL で開く場合は、HTTPS 証明書を端末に信頼登録してください。

## 導入の入口

標準手順は、Windows PC から Raspberry Pi へ SSH でデプロイする方法です。
Pi 本体に画面を出す場合は kiosk 表示あり、別端末から見るだけの場合は kiosk 表示なしで導入します。

導入・設定の詳細:

| 目的 | ドキュメント |
| --- | --- |
| Raspberry Pi OS Lite の初期設定 | [Raspberry Pi OS Lite 導入手順](deploy/raspi/README-lite.md) |
| Windows PC から SSH デプロイ | [Raspberry Pi オフライン SSH デプロイ](deploy/raspi/README-ssh-deploy.md) |
| システム構成の確認 | [システム構成図](docs/system-architecture.md) |
| ハードウェア構成の確認 | [ハードウェア構成図](docs/hardware-architecture.md) |
| OA LAN 接続、2 LAN 構成 | [Raspberry Pi OA LAN 接続設定案](docs/raspberry-pi-oalan-settings.md) |
| 日常操作、バックアップ、困ったとき | [取扱説明・運用ガイド](docs/operation-guide.md) |
| 詳細ドキュメント一覧 | [docs/README.md](docs/README.md) |

最短のデプロイコマンド:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry PiのIP> -StartKiosk
```

kiosk 表示なしの場合は `-StartKiosk` を外します。

## 前提

- OS は Raspberry Pi OS Lite 64-bit のみ対応です。
- Raspberry Pi OS with Desktop は対象外です。
- Raspberry Pi 5 推奨です。
- Node.js 24 以上が必要です。
- 本番運用では nginx で HTTPS 公開します。

## 開発用コマンド

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

## 注意事項

- 停電操作、送電操作、禁止札運用は現場安全に直結します。
- 送電前に未返却の子札がないことを必ず確認してください。
- 管理者モードは信頼できる担当者だけが使用してください。
- `data/` は運用データです。更新時に手動で上書きしないでください。
