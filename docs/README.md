# 詳細ドキュメント一覧

README は概要と入口に絞り、詳しい手順や構成情報はこの配下に分けています。

## 読む順番

| 目的 | ドキュメント |
| --- | --- |
| 停電依頼を受けて設備を停電させる（一般作業者向け） | [停電依頼・停電操作 手順書](power-outage-request-user-manual.md) |
| 修繕日・大修繕日にまとめて仮発行する（一般作業者向け） | [修繕日・大修繕日 仮発行手順書](maintenance-batch-request-user-manual.md) |
| 作業完了後に送電へ戻す（一般作業者向け） | [送電・依頼解約 手順書](power-restoration-user-manual.md) |
| 日常操作、更新、バックアップ、困ったとき | [取扱説明・運用ガイド](operation-guide.md) |
| アプリ、API、DB、同期処理の構成を確認する | [システム構成](system-architecture.md) |
| Raspberry Pi、表示器、プリンター、LAN などの物理構成を確認する | [ハードウェア構成](hardware-architecture.md) |
| OA LAN と現場 LAN の 2 LAN 構成を設定する | [Raspberry Pi OA LAN 接続設定案](raspberry-pi-oalan-settings.md) |
| Raspberry Pi OS Lite を初期セットアップする | [Raspberry Pi OS Lite 導入手順](../deploy/raspi/README-lite.md) |
| Windows PC から Raspberry Pi へデプロイする | [Raspberry Pi オフライン SSH デプロイ](../deploy/raspi/README-ssh-deploy.md) |

## 文書の役割

| 文書 | 役割 |
| --- | --- |
| `power-outage-request-user-manual.md` | 一般作業者向け。停電依頼を受けてから設備を停電中にするまでの通常手順をまとめます。印刷用に `power-outage-request-user-manual.html` も用意しています。 |
| `maintenance-batch-request-user-manual.md` | 一般作業者向け。修繕日・大修繕日の依頼を事前に仮発行し、当日に一致する依頼だけを発行する手順をまとめます。 |
| `power-restoration-user-manual.md` | 一般作業者向け。停電作業完了後に依頼を解約し、対象設備を送電状態へ戻すまでの手順をまとめます。 |
| `operation-guide.md` | 操作者・保守担当者向け。画面操作、確認コマンド、バックアップ、復旧、更新、トラブル確認をまとめます。 |
| `system-architecture.md` | 開発者・保守担当者向け。Web アプリ、API、SQLite、同期、停電依頼処理の流れをまとめます。 |
| `hardware-architecture.md` | 設置検討向け。Raspberry Pi、ディスプレイ、プリンター、LAN の物理的なつなぎ方をまとめます。 |
| `raspberry-pi-oalan-settings.md` | 実機設定向け。OA LAN と現場 LAN を分離して使う場合の IP、ファイアウォール、証明書設定をまとめます。 |

