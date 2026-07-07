# システム構成図

MCCB Manager は、Raspberry Pi 上で常時稼働する単一拠点向け Web アプリです。React/Vite の画面、Express API、Node.js 組み込み SQLite による永続化を 1 台に集約し、Pi 本体の kiosk、PC、タブレットから同じ画面を利用します。

## 標準システム構成

```mermaid
flowchart LR
  subgraph Clients[利用端末]
    Kiosk[Raspberry Pi 本体\nChromium kiosk]
    Browser[PC / タブレット\nChrome・Edge など]
    Printer[スター精密プリンター\nUSB / WebUSB]
  end

  subgraph Pi[Raspberry Pi]
    Nginx[Nginx\nHTTPS 終端\n80 -> 443 リダイレクト]
    App[Node.js + Express\nserver.js\n127.0.0.1:5000]
    Static[ビルド済み SPA\ndist/]
    Service[停電依頼・札割当\nserver/requestAssignmentService.js]
    Store[SQLite ストア\ndbStore.js]
    Db[(data/mccb_data.sqlite\nWAL 有効)]
    Backups[(data/backups/\nDB バックアップ)]
  end

  Browser -->|HTTPS / Fetch /api/*| Nginx
  Kiosk -->|localhost または HTTPS| Nginx
  Nginx -->|proxy_pass| App
  App -->|SPA 配信| Static
  App -->|依頼処理| Service
  App -->|読込・保存| Store
  Service -->|札割当確認・更新| Store
  Store --> Db
  Store --> Backups
  Browser -.->|印刷操作端末に接続| Printer
  Kiosk -.->|印刷操作端末に接続| Printer
```

## アプリケーション構成

```mermaid
flowchart TB
  Router[src/App.jsx\nHashRouter + 画面ルーティング]
  AppController[src/hooks/useAppController.js\n画面状態・操作集約]
  DataHook[src/hooks/useMccbData.js\nAPI 通信・5秒ポーリング]

  Router --> AppController
  AppController --> DataHook

  subgraph Screens[主要画面]
    Dashboard[メイン操作\n設備検索・停電/送電・子札貸出]
    RequestForm[停電依頼作成\n依頼発行・印刷]
    RequestList[依頼一覧\n進行中・履歴・再印刷]
    Monitor[電気室モニター\n表示専用]
    Admin[管理画面\n設備・マスター・ログ・DB]
  end

  Router --> Dashboard
  Router --> RequestForm
  Router --> RequestList
  Router --> Monitor
  Router --> Admin

  DataHook -->|GET /api/mccb?core=1| CoreApi[初回・更新データ取得]
  DataHook -->|GET /api/mccb/version| VersionApi[更新バージョン確認]
  DataHook -->|GET /api/logs| LogsApi[操作ログ取得]
  DataHook -->|GET /api/request-history| HistoryApi[依頼履歴取得]
  DataHook -->|POST / PATCH / DELETE /api/*| WriteApi[設備・依頼・管理操作]
```

## サーバー API と永続化

```mermaid
flowchart LR
  subgraph Api[Express API]
    MccbApi["/api/mccb\n/api/mccb/version\n/api/mccb/:id"]
    AdminApi["/api/admin/*\nCSV・マスター・ログ・バックアップ"]
    RequestApi["/api/requests/*\n/api/draft-requests/*"]
  end

  subgraph Persistence[SQLite 永続化]
    Mccbs[(mccbs\n設備本体)]
    Cards[(child_cards\n子札状態)]
    Collections[(app_collections\n依頼・マスター・ログ等の JSON)]
    Meta[(app_meta\ndata_version)]
    Backup[(data/backups/\n世代管理)]
  end

  MccbApi --> Mccbs
  MccbApi --> Cards
  AdminApi --> Collections
  AdminApi --> Backup
  RequestApi --> Collections
  RequestApi --> Mccbs
  RequestApi --> Cards
  MccbApi --> Meta
  AdminApi --> Meta
  RequestApi --> Meta
```

SQLite では、設備本体を `mccbs`、子札を `child_cards` に分離して保持します。部屋マスター、区分マスター、色設定、操作ログ、停電依頼、下書き依頼、依頼履歴、設備グループなどの横断データは `app_collections` に JSON として保存します。`app_meta` の `data_version` はクライアントの差分確認に使います。

## 通常同期フロー

```mermaid
sequenceDiagram
  participant UI as ブラウザ UI
  participant Hook as useMccbData
  participant API as Express API
  participant DB as SQLite

  UI->>Hook: 画面表示
  Hook->>API: GET /api/mccb?core=1
  API->>DB: 現在データ読み込み
  DB-->>API: 設備・依頼・マスター・version
  API-->>Hook: JSON
  Hook-->>UI: 状態反映

  loop 5秒ごと
    Hook->>API: GET /api/mccb/version
    API-->>Hook: data_version
    alt 更新あり
      Hook->>API: GET /api/mccb?core=1
      API->>DB: 最新データ読み込み
      API-->>Hook: 最新データ
      Hook-->>UI: 再描画
    end
  end
```

## 停電依頼発行フロー

```mermaid
sequenceDiagram
  participant User as 利用者
  participant UI as 停電依頼作成画面
  participant API as Express API
  participant Assign as 札割当サービス
  participant DB as SQLite

  User->>UI: 対象設備・作業内容を入力
  UI->>API: POST /api/requests
  API->>Assign: 依頼用子札を割当
  Assign->>DB: 設備・子札状態を確認
  DB-->>Assign: 現在状態
  Assign-->>API: 依頼データ・変更設備
  API->>DB: 依頼・子札・ログを保存
  API-->>UI: 作成済み依頼・変更設備・ログ
  UI-->>User: 依頼一覧更新・印刷へ
```

## OA LAN 拡張構成

会社 OA LAN から事務所 PC で操作し、現場側 Raspberry Pi はメイン Raspberry Pi の画面を kiosk 表示する構成です。メイン Raspberry Pi は OA LAN と現場 LAN の両方に接続しますが、ルーター、NAT、ブリッジとしては使いません。両 LAN から公開する入口は MCCB Manager の HTTPS のみに限定します。

```mermaid
flowchart LR
  Office[事務所 PC]
  OALAN[会社 OA LAN]

  subgraph MainPi[メイン Raspberry Pi]
    OaNic[LAN 1\nOA LAN 側]
    FieldNic[LAN 2\n現場 LAN 側]
    Nginx2[Nginx\nHTTPS 443]
    App2[Express API + SPA]
    Db2[(SQLite DB)]
    Kiosk2[Chromium kiosk]
  end

  FieldHub[現場 HUB]

  subgraph Field[現場端末]
    PiA[電気室 A Raspberry Pi\nkiosk]
    PiB[電気室 B Raspberry Pi\nkiosk]
    PiN[電気室 N Raspberry Pi\nkiosk]
  end

  Office -->|HTTPS| OALAN
  OALAN -->|LAN 1| OaNic
  OaNic -->|HTTPS| Nginx2
  Nginx2 --> App2
  App2 --> Db2
  Kiosk2 -->|localhost または HTTPS| Nginx2
  FieldNic -->|LAN 2| FieldHub
  FieldHub --> PiA
  FieldHub --> PiB
  FieldHub --> PiN
  PiA -->|HTTPS でメイン Pi を表示| Nginx2
  PiB -->|HTTPS でメイン Pi を表示| Nginx2
  PiN -->|HTTPS でメイン Pi を表示| Nginx2
```

この構成では、データベースをメイン Raspberry Pi に集約し、事務所 PC と各電気室端末は同じ Web アプリへ接続します。メイン Raspberry Pi が単一障害点になるため、DB バックアップ、予備 microSD、予備 Raspberry Pi、UPS、復旧手順を事前に用意します。

### OA LAN 接続時のセキュリティ方針

- OA LAN 側と現場 LAN 側は別セグメントにし、L2 ブリッジ、NAT、IP フォワーディングを無効にします。
- OA LAN から現場 Raspberry Pi や現場機器へ直接到達できない構成にします。
- 現場 LAN から OA LAN 上の PC、ファイルサーバー、インターネットへ直接到達できない構成にします。
- メイン Raspberry Pi の Nginx だけを両 LAN に公開し、公開ポートは原則 `443/tcp` に限定します。
- Express API は `127.0.0.1:5000` のみで待ち受け、LAN 側へ直接公開しません。
- SSH は保守用に必要な接続元だけ許可し、OA LAN 側または保守端末の固定 IP に制限します。
- 管理者モードは初期パスワードを必ず変更し、操作ログと DB バックアップを定期確認します。
- 証明書は自己署名の個別配布より、可能なら社内 CA または端末管理で信頼配布します。
- OS、Node.js、Nginx の更新手順を決め、更新前に DB バックアップを取得します。

## 運用上のポイント

- 本番運用では Raspberry Pi 上で Node.js/Express を起動し、Nginx は HTTPS 終端と `127.0.0.1:5000` へのリバースプロキシを担当します。
- Express は `/api/*` とビルド済みフロントエンド `dist/` の SPA 配信を担当します。
- クライアント側のルーティングは `HashRouter` なので、各画面は `/#/request` や `/#/admin` のような URL で開きます。
- WebUSB 印刷を使う端末は、Chrome/Edge で `localhost` または HTTPS の安全なコンテキストから開く必要があります。
- SQLite は WAL モードで動作し、定期チェックポイントとバックアップ作成に対応します。
- 管理画面から CSV 取込・マスター編集・ログ管理・履歴管理・DB バックアップ作成を実行できます。
