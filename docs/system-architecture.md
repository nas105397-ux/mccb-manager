# システム構成図

MCCB Manager は、React/Vite のフロントエンド、Express の API サーバー、Node.js 組み込み SQLite による永続化で構成される単一拠点向け Web アプリです。Raspberry Pi 上で常時稼働させ、LAN 内の PC・タブレット・Pi 本体のキオスク表示から同じ画面を利用します。

## 全体構成

```mermaid
flowchart LR
  subgraph Clients[利用端末]
    Kiosk[Raspberry Pi 本体\nChromium キオスク]
    Browser[PC / タブレット\nChrome・Edge など]
    Printer[スター精密プリンター\nWebUSB 接続]
  end

  subgraph RaspberryPi[Raspberry Pi / アプリ稼働環境]
    Nginx[Nginx\nHTTPS 終端・静的配信]
    Static[ビルド済みフロントエンド\ndist/]
    Api[Node.js + Express\nserver.js]
    Service[停電依頼・札割当ロジック\nserver/requestAssignmentService.js]
    Store[SQLite ストア\ndbStore.js]
    Db[(data/mccb_data.sqlite\nWAL 有効)]
    Backups[(data/backups/\nDB バックアップ)]
  end

  Browser -->|HTTPS / #/ 画面表示| Nginx
  Kiosk -->|localhost または HTTPS| Nginx
  Nginx --> Static
  Static -->|Fetch /api/*| Api
  Api --> Service
  Api --> Store
  Service --> Store
  Store --> Db
  Store --> Backups
  Browser -.->|WebUSB 印刷操作| Printer
  Kiosk -.->|WebUSB 印刷操作| Printer
```

## アプリケーション構成

```mermaid
flowchart TB
  App[src/App.jsx\nHashRouter + 画面ルーティング]
  Controller[src/hooks/useAppController.js\n画面状態・操作の集約]
  DataHook[src/hooks/useMccbData.js\nAPI 通信・5秒ポーリング]

  App --> Controller
  Controller --> DataHook

  subgraph Screens[主要画面]
    Main[メイン操作\n設備検索・停電/送電・札貸出]
    Request[停電依頼作成]
    RequestList[依頼一覧・履歴]
    Monitor[電気室モニター]
    Admin[管理画面]
  end

  App --> Main
  App --> Request
  App --> RequestList
  App --> Monitor
  App --> Admin

  DataHook -->|GET /api/mccb?core=1| CoreApi[最新データ取得]
  DataHook -->|GET /api/mccb/version| VersionApi[差分確認]
  DataHook -->|GET /api/logs| LogsApi[ログページング]
  DataHook -->|GET /api/request-history| HistoryApi[履歴ページング]
  DataHook -->|PATCH / POST / DELETE /api/*| WriteApi[設備・依頼・管理操作]
```

## データ構成

```mermaid
erDiagram
  MCCBS ||--o{ CHILD_CARDS : has
  APP_COLLECTIONS ||--|| APP_META : complements

  MCCBS {
    text id PK
    text room
    text category
    text name
    integer is_power_off
    integer is_favorite
    integer is_dummy
    text extra_json
    integer updated_at
  }

  CHILD_CARDS {
    text mccb_id PK,FK
    integer card_id PK
    integer is_borrowed
    text worker_name
    text extra_json
  }

  APP_COLLECTIONS {
    text key PK
    text value_json
  }

  APP_META {
    text key PK
    text value
  }
```

SQLite では、設備本体を `mccbs`、子札を `child_cards` に分離して保持します。部屋マスター、区分マスター、ログ、停電依頼、設備グループ、履歴設定などのアプリ横断データは `app_collections` に JSON として保持し、`app_meta` の `data_version` でクライアント同期用の更新バージョンを管理します。

## 主要な通信・処理フロー

### 通常同期

```mermaid
sequenceDiagram
  participant UI as ブラウザ UI
  participant Hook as useMccbData
  participant API as Express API
  participant DB as SQLite

  UI->>Hook: 画面表示
  Hook->>API: GET /api/mccb?core=1
  API->>DB: 現在データ読み込み
  DB-->>API: 設備・依頼・マスター
  API-->>Hook: JSON + version
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

### 停電依頼発行

```mermaid
sequenceDiagram
  participant User as 利用者
  participant UI as 停電依頼作成画面
  participant API as Express API
  participant Assign as 札割当サービス
  participant DB as SQLite

  User->>UI: 対象設備・作業内容を入力
  UI->>API: POST /api/requests
  API->>Assign: 対象設備の依頼用子札を割当
  Assign->>DB: 設備・子札状態を確認
  DB-->>Assign: 現在状態
  Assign-->>API: 依頼データ・変更設備
  API->>DB: トランザクションで保存
  API-->>UI: 作成済み依頼・変更設備・ログ
  UI-->>User: 依頼一覧更新・印刷へ
```

## 将来システム構成案: メイン Raspberry Pi で OA LAN と現場 HUB を接続

会社 OA LAN から事務所 PC で操作する将来構成では、メイン Raspberry Pi がアプリサーバー、SQLite DB、kiosk、OA LAN と現場用 LAN の接続点を兼ねます。接続順は `事務所 PC → OA LAN → メイン Raspberry Pi → 現場 HUB → 他電気室 Raspberry Pi` です。

```mermaid
flowchart LR
  Office[事務所 PC]
  OALAN[会社 OA LAN]

  subgraph MainPi[メイン Raspberry Pi]
    ReverseProxy[Nginx / HTTPS]
    App[Node.js Express API]
    Db[(SQLite DB)]
    Kiosk[Chromium kiosk]
  end

  FieldHub[現場 HUB]

  subgraph Rooms[他電気室]
    PiA[電気室 A Raspberry Pi\nkiosk 表示]
    PiB[電気室 B Raspberry Pi\nkiosk 表示]
    PiN[電気室 N Raspberry Pi\nkiosk 表示]
  end

  Office -->|HTTPS 操作| OALAN
  OALAN -->|HTTPS| ReverseProxy
  ReverseProxy --> App
  App --> Db
  Kiosk -->|localhost / HTTPS| ReverseProxy
  MainPi -->|現場用 LAN| FieldHub
  FieldHub --> PiA
  FieldHub --> PiB
  FieldHub --> PiN
  PiA -->|HTTPS でメイン Pi を表示| ReverseProxy
  PiB -->|HTTPS でメイン Pi を表示| ReverseProxy
  PiN -->|HTTPS でメイン Pi を表示| ReverseProxy
```

この構成では、データベースをメイン Raspberry Pi に集約し、事務所 PC と他電気室 Raspberry Pi は同じメイン Raspberry Pi の Web アプリへ接続します。メイン Raspberry Pi が単一障害点になるため、DB バックアップ、予備 microSD、予備 Raspberry Pi、UPS、復旧手順を事前に用意することが重要です。

## デプロイ・運用上のポイント

- 本番運用では Raspberry Pi 上で Node.js/Express を起動し、Nginx から静的ファイルと API を提供します。
- クライアント側のルーティングは `HashRouter` なので、各画面は `/#/request` や `/#/admin` のような URL で開きます。
- WebUSB 印刷を使う端末は、Chrome/Edge で `localhost` または HTTPS の安全なコンテキストから開く必要があります。
- SQLite は WAL モードで動作し、定期チェックポイントとバックアップ作成に対応します。
- 管理画面から CSV 取込・マスター編集・ログ管理・履歴管理・DB バックアップ作成を実行できます。
