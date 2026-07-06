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

## 将来システム構成案: メインサーバー経由で OA LAN へ展開

会社 OA LAN から事務所パソコンで操作する将来構成では、現場用 LAN と OA LAN をメインサーバーで分離・中継します。現場では HUB 配下の各電気室に Raspberry Pi を配置し、OA LAN 側では会社ネットワーク上の事務所 PC からメインサーバーへ HTTPS 接続して利用します。

```mermaid
flowchart LR
  subgraph Field[現場用 LAN]
    Hub[現場 HUB]
    PiA[電気室 A\nRaspberry Pi]
    PiB[電気室 B\nRaspberry Pi]
    PiC[電気室 C\nRaspberry Pi]
  end

  subgraph Main[メインサーバー]
    ReverseProxy[リバースプロキシ / HTTPS 終端]
    Auth[認証・アクセス制御]
    Aggregation[データ集約または各 Pi への中継]
  end

  subgraph OA[会社 OA LAN]
    Office[事務所 PC]
    AdminPc[管理者 PC]
  end

  Hub --> PiA
  Hub --> PiB
  Hub --> PiC
  Hub <-->|現場側 NIC| Main
  Main <-->|OA 側 NIC| OA
  Office -->|HTTPS| ReverseProxy
  AdminPc -->|HTTPS| ReverseProxy
  ReverseProxy --> Auth
  Auth --> Aggregation
  Aggregation -->|必要に応じて中継| PiA
  Aggregation -->|必要に応じて中継| PiB
  Aggregation -->|必要に応じて中継| PiC
```

この構成では、OA LAN と現場用 LAN を同一セグメントにせず、メインサーバーを境界にして通信経路、認証、証明書、ログ、バックアップ方針を管理します。各電気室の Raspberry Pi を独立稼働させる方式にするか、メインサーバーにデータを集約する方式にするかは、停止時の現場継続運用とデータ一元管理のどちらを優先するかで決定します。

## デプロイ・運用上のポイント

- 本番運用では Raspberry Pi 上で Node.js/Express を起動し、Nginx から静的ファイルと API を提供します。
- クライアント側のルーティングは `HashRouter` なので、各画面は `/#/request` や `/#/admin` のような URL で開きます。
- WebUSB 印刷を使う端末は、Chrome/Edge で `localhost` または HTTPS の安全なコンテキストから開く必要があります。
- SQLite は WAL モードで動作し、定期チェックポイントとバックアップ作成に対応します。
- 管理画面から CSV 取込・マスター編集・ログ管理・履歴管理・DB バックアップ作成を実行できます。
