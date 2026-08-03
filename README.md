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

Raspberry Pi で動かしている場合、ブラウザで次を開きます。

```text
https://<Raspberry PiのIP>/#/
```

例: `https://192.168.40.111/#/`

管理者モードの初期パスワードは `admin` です。本番運用前に変更してください。

画面一覧、WebUSB 印刷の注意点は [取扱説明・運用ガイド](docs/operation-guide.md) を参照してください。

## 導入の入口

標準手順は、Windows PC から Raspberry Pi へ SSH でデプロイする方法です。
Pi の役割（サーバーのみ / サーバー + kiosk / kiosk のみ）を選んで導入します。

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

最短のデプロイコマンド（サーバー + kiosk）:

```powershell
.\deploy\raspi\deploy-over-ssh.ps1 -Target pi@<Raspberry PiのIP> -StartKiosk
```

サーバーのみ、kiosk のみなど他の役割の選び方は [Raspberry Pi オフライン SSH デプロイ](deploy/raspi/README-ssh-deploy.md) の「サーバー + kiosk と kiosk のみを選ぶ」を参照してください。

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

本番サーバー停止（Windows PC で、既定ポート5000を使用中のプロセスを終了）:

```bash
npm run stop
```

確認:

```bash
npm run lint
node --check server.js
node --check dbStore.js
npm run build
```

## 注意事項

停電操作・送電操作・禁止札運用は現場安全に直結します。送電前は未返却の子札がないことを必ず確認してください。
詳しい注意事項は [取扱説明・運用ガイド](docs/operation-guide.md) を参照してください。
