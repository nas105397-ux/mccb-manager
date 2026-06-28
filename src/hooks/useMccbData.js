import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "/api/mccb";
const DEFAULT_ROOMS = [
  "1階高圧電気室",
  "1階電気室",
  "2階電気室",
  "2次トーチ電気室",
  "LT-UT電気室",
  "水処理電気室",
];
const DEFAULT_CATEGORIES = [
  "1スト",
  "2スト",
  "3スト",
  "4スト",
  "5スト",
  "6スト",
  "共通",
];
const POLL_INTERVAL = 5000; // 3s -> 5s に緩和
const DEFAULT_MAX_SIZE = 500;
const CHILD_CARD_COUNT = 5;
const LOG_TYPES = Object.freeze({
  OPERATION: "操作",
  CARD_LOAN: "札貸出",
  MASTER_CREATE: "マスタ登録",
  MASTER_UPDATE: "マスタ編集",
  MASTER_DELETE: "マスタ削除",
  SYSTEM: "システム",
});

const LEGACY_LOG_TYPE_MAP = Object.freeze({
  マスタ変更: LOG_TYPES.MASTER_UPDATE,
  設定変更: LOG_TYPES.SYSTEM,
});
const LOG_TYPE_VALUES = new Set(Object.values(LOG_TYPES));

// ==========================================
// 1. フック外の共通ユーティリティ関数群 (純粋関数)
// ==========================================

/** 現在時刻のフォーマット文字列を取得 */
const getTimestamp = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
};

/** 共通ログ更新処理 */
const createUpdatedLogs = (type, message, currentLogs, maxSize) => {
  const newLog = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: getTimestamp(),
    type,
    message,
  };
  return [newLog, ...currentLogs].slice(0, maxSize);
};

/** MCCB共通ID生成 */
const createMccbId = (suffix = "") =>
  `MCCB-${Date.now()}${suffix !== "" ? `-${suffix}` : ""}`;

/** 子札初期配列を生成 */
const createDefaultChildCards = () => {
  return Array.from({ length: CHILD_CARD_COUNT }, (_, i) => ({
    id: i + 1,
    isBorrowed: false,
    workerName: "",
  }));
};

/** 旧バージョンのログタイプを現在の分類へ正規化 */
const normalizeLogType = (type) => {
  if (LEGACY_LOG_TYPE_MAP[type]) return LEGACY_LOG_TYPE_MAP[type];
  return LOG_TYPE_VALUES.has(type) ? type : LOG_TYPES.SYSTEM;
};

const normalizeLogs = (logs) => {
  if (!Array.isArray(logs)) return [];
  return logs.map((log) => ({
    ...log,
    type: normalizeLogType(log.type),
  }));
};

/** サーバー受信データのパース・デフォルト値マージ */
const parseServerData = (data) => {
  const source = data && typeof data === "object" ? data : {};
  const isArrayPayload = Array.isArray(data);

  return {
    mccbList: source.mccbList || (isArrayPayload ? data : []),
    rooms: source.rooms || DEFAULT_ROOMS,
    categories: source.categories || DEFAULT_CATEGORIES,
    logs: normalizeLogs(source.logs || []),
    logSettings: source.logSettings || { maxSize: DEFAULT_MAX_SIZE },
    requests: source.requests || [],
    deviceGroups: source.deviceGroups || [],
    requestHistory: source.requestHistory || [],
    historySettings: source.historySettings || { maxSize: DEFAULT_MAX_SIZE },
  };
};

// ==========================================
// findAvailableCard: 利用可能な空き子札を探索する（簡略化・高速化）
// ==========================================
const findAvailableCard = (targetMccb, currentMccbList) => {
  const isOriginalDummy =
    targetMccb.isDummy || targetMccb.name.includes("ダミー");

  // 段階 1: 自身の設備に空き札があるか確認
  let cardIdx = targetMccb.childCards.findIndex((c) => !c.isBorrowed);
  if (cardIdx !== -1) return { finalMccb: targetMccb, availableIdx: cardIdx };
  if (isOriginalDummy) return { finalMccb: null, availableIdx: -1 };

  // 段階 2: 同じ電気室内の空きダミー設備を探索
  const sameRoomDummies = currentMccbList
    .filter(
      (m) =>
        m.room === targetMccb.room &&
        (m.name.includes("ダミー") || m.id.includes("DUMMY") || m.isDummy),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  for (const dummy of sameRoomDummies) {
    const idx = dummy.childCards.findIndex((c) => !c.isBorrowed);
    if (idx !== -1) return { finalMccb: dummy, availableIdx: idx };
  }

  // 段階 3: 全エリアの空きダミー設備から再探索 (ダミー0最優先)
  const allDummies = currentMccbList
    .filter(
      (m) => m.name.includes("ダミー") || m.id.includes("DUMMY") || m.isDummy,
    )
    .sort((a, b) => {
      if (a.name === "ダミー0" && b.name !== "ダミー0") return -1;
      if (a.name !== "ダミー0" && b.name === "ダミー0") return 1;
      return a.name.localeCompare(b.name, "ja");
    });

  for (const dummy of allDummies) {
    const idx = dummy.childCards.findIndex((c) => !c.isBorrowed);
    if (idx !== -1) return { finalMccb: dummy, availableIdx: idx };
  }

  return { finalMccb: null, availableIdx: -1 };
};

// ==========================================
// 2. カスタムフック定義
// ==========================================
export function useMccbData() {
  const [mccbList, setMccbList] = useState([]);
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [logs, setLogs] = useState([]);
  const [logSettings, setLogSettings] = useState({ maxSize: DEFAULT_MAX_SIZE });
  const [requests, setRequests] = useState([]);
  const [deviceGroups, setDeviceGroups] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [historySettings, setHistorySettings] = useState({
    maxSize: DEFAULT_MAX_SIZE,
  });

  // 同期タスクキューおよびタイマー制御用のRef
  const syncQueue = useRef(Promise.resolve());
  const pauseTimer = useRef(0);
  const syncInProgress = useRef(false);

  /** 非同期サーバー書き込み処理をキューイングし、自動ポーリングと衝突させない制御ラッパー */
  const runSyncTask = useCallback((taskFn) => {
    pauseTimer.current = Date.now() + 5000; // 手動操作後は自動巡回を一時停止
    syncQueue.current = syncQueue.current.then(async () => {
      syncInProgress.current = true;
      try {
        await taskFn();
      } catch (e) {
        console.error("サーバー同期エラー:", e);
      } finally {
        syncInProgress.current = false;
        pauseTimer.current = Date.now() + 1000;
      }
    });
  }, []);

  // --- 定期自動同期ポーリング設定 (useEffect) ---
  useEffect(() => {
    const fetchData = () => {
      if (Date.now() < pauseTimer.current || syncInProgress.current) return;
      fetch(API_URL)
        .then((res) => res.json())
        .then((data) => {
          const parsed = parseServerData(data);
          setMccbList(parsed.mccbList);
          setRooms(parsed.rooms);
          setCategories(parsed.categories);
          setLogs(parsed.logs);
          setLogSettings(parsed.logSettings);
          setRequests(parsed.requests);
          setDeviceGroups(parsed.deviceGroups);
          setRequestHistory(parsed.requestHistory);
          setHistorySettings(parsed.historySettings);
        })
        .catch((err) => console.error("自動同期エラー:", err));
    };

    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  /** 共通：ローカル状態変更およびサーバーへのPOST送信一括処理 */
  const saveToServer = useCallback(
    (
      nextMccbList,
      nextRooms = rooms,
      nextCategories = categories,
      nextLogs = logs,
      nextSettings = logSettings,
      nextRequests = requests,
      nextDeviceGroups = deviceGroups,
      nextHistory = requestHistory,
      nextHistorySettings = historySettings,
    ) => {
      setMccbList(nextMccbList);
      setRooms(nextRooms);
      setCategories(nextCategories);
      setLogs(nextLogs);
      setLogSettings(nextSettings);
      setRequests(nextRequests);
      setDeviceGroups(nextDeviceGroups);
      setRequestHistory(nextHistory);
      setHistorySettings(nextHistorySettings);

      runSyncTask(async () => {
        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mccbList: nextMccbList,
            rooms: nextRooms,
            categories: nextCategories,
            logs: nextLogs,
            logSettings: nextSettings,
            requests: nextRequests,
            deviceGroups: nextDeviceGroups,
            requestHistory: nextHistory,
            historySettings: nextHistorySettings,
          }),
        });
      });
    },
    [
      rooms,
      categories,
      logs,
      logSettings,
      requests,
      deviceGroups,
      requestHistory,
      historySettings,
      runSyncTask,
    ],
  );

  // --- 各種ビジネスロジック関数群 (useCallbackで完全キャッシュ化) ---

  /** 対象設備の貸出中子札数を取得 */
  const getBorrowedCount = useCallback((mccb) => {
    return mccb ? mccb.childCards.filter((c) => c.isBorrowed).length : 0;
  }, []);

  /** 設備の個別新規マスタ登録 */
  const saveMccbEntry = useCallback(
    (entry) => {
      const newMccb = {
        ...entry,
        id: createMccbId(),
        isPowerOff: false,
        isFavorite: false,
        childCards: createDefaultChildCards(),
      };
      const nextLogs = createUpdatedLogs(
        LOG_TYPES.MASTER_CREATE,
        `設備「${entry.name}」が登録されました。`,
        logs,
        logSettings.maxSize,
      );
      saveToServer([...mccbList, newMccb], rooms, categories, nextLogs);
    },
    [mccbList, rooms, categories, logs, logSettings.maxSize, saveToServer],
  );

  /** 設備データ（開閉状態・お気に入り・子札貸出）の更新操作 */
  const updateMccb = useCallback(
    (updatedMccb) => {
      // UIの応答性を高めるため先にローカル状態を先行更新
      setMccbList((prev) =>
        prev.map((item) => (item.id === updatedMccb.id ? updatedMccb : item)),
      );

      runSyncTask(async () => {
        const res = await fetch(`${API_URL}/${encodeURIComponent(updatedMccb.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mccb: updatedMccb }),
        });

        if (!res.ok) {
          throw new Error(`設備更新に失敗しました (${res.status})`);
        }

        const result = await res.json();
        if (result.mccb) {
          setMccbList((prev) =>
            prev.map((item) => (item.id === result.mccb.id ? result.mccb : item)),
          );
        }
        if (Array.isArray(result.logs)) {
          setLogs(normalizeLogs(result.logs));
        }
      });
    },
    [runSyncTask],
  );

  /** 設備マスタの完全削除 */
  const deleteMccb = useCallback(
    (id) => {
      if (window.confirm(`完全に削除してもよろしいですか？`)) {
        const nextLogs = createUpdatedLogs(
          LOG_TYPES.MASTER_DELETE,
          `設備データが削除されました。`,
          logs,
          logSettings.maxSize,
        );
        saveToServer(
          mccbList.filter((item) => item.id !== id),
          rooms,
          categories,
          nextLogs,
        );
      }
    },
    [mccbList, rooms, categories, logs, logSettings.maxSize, saveToServer],
  );

  // --- マスター項目（電気室・区分）制御 ---
  const addRoom = useCallback(
    (roomName) => {
      const trimmed = roomName.trim();
      if (trimmed && !rooms.includes(trimmed))
        saveToServer(mccbList, [...rooms, trimmed]);
    },
    [mccbList, rooms, saveToServer],
  );

  const updateRoom = useCallback(
    (oldName, newName) => {
      const trimmed = newName.trim();
      if (trimmed && !rooms.includes(trimmed)) {
        const nextList = mccbList.map((m) =>
          m.room === oldName ? { ...m, room: trimmed } : m,
        );
        const nextRooms = rooms.map((r) => (r === oldName ? trimmed : r));
        saveToServer(nextList, nextRooms);
      }
    },
    [mccbList, rooms, saveToServer],
  );

  const deleteRoom = useCallback(
    (roomName) => {
      if (
        !mccbList.some((m) => m.room === roomName) &&
        window.confirm(`削除しますか？`)
      ) {
        saveToServer(
          mccbList,
          rooms.filter((r) => r !== roomName),
        );
      }
    },
    [mccbList, rooms, saveToServer],
  );

  const addCategory = useCallback(
    (categoryName) => {
      const trimmed = categoryName.trim();
      if (trimmed && !categories.includes(trimmed))
        saveToServer(mccbList, rooms, [...categories, trimmed]);
    },
    [mccbList, rooms, categories, saveToServer],
  );

  const updateCategory = useCallback(
    (oldName, newName) => {
      const trimmed = newName.trim();
      if (trimmed && !categories.includes(trimmed)) {
        const nextList = mccbList.map((m) =>
          m.category === oldName ? { ...m, category: trimmed } : m,
        );
        const nextCats = categories.map((c) => (c === oldName ? trimmed : c));
        saveToServer(nextList, rooms, nextCats);
      }
    },
    [mccbList, rooms, categories, saveToServer],
  );

  const deleteCategory = useCallback(
    (categoryName) => {
      if (
        !mccbList.some((m) => m.category === categoryName) &&
        window.confirm(`削除しますか？`)
      ) {
        saveToServer(
          mccbList,
          rooms,
          categories.filter((c) => c !== categoryName),
        );
      }
    },
    [mccbList, rooms, categories, saveToServer],
  );

  // --- システムログ制御 ---
  const clearAllLogs = useCallback(() => {
    if (window.confirm("ログ履歴をクリアしますか？")) {
      const resetLog = [
        {
          id: `LOG-${Date.now()}`,
          timestamp: getTimestamp(),
          type: LOG_TYPES.SYSTEM,
          message: "ログ履歴がクリアされました。",
        },
      ];
      saveToServer(mccbList, rooms, categories, resetLog);
    }
  }, [mccbList, rooms, categories, saveToServer]);

  const changeMaxLogSize = useCallback(
    (size) => {
      const numSize = Number(size);
      const nextLogs = createUpdatedLogs(
        LOG_TYPES.SYSTEM,
        `ログ保持件数変更`,
        logs.slice(0, numSize),
        numSize,
      );
      saveToServer(mccbList, rooms, categories, nextLogs, {
        ...logSettings,
        maxSize: numSize,
      });
    },
    [mccbList, rooms, categories, logs, logSettings, saveToServer],
  );

  // --- 停電作業依頼 履歴データ制御 ---
  const clearRequestHistory = useCallback(() => {
    if (
      window.confirm(
        "過去の作業完了・解約の履歴データをすべて消去しますか？（元に戻せません）",
      )
    ) {
      const nextLogs = createUpdatedLogs(
        LOG_TYPES.SYSTEM,
        "停電作業の依頼履歴がすべてクリアされました。",
        logs,
        logSettings.maxSize,
      );
      saveToServer(
        mccbList,
        rooms,
        categories,
        nextLogs,
        logSettings,
        requests,
        deviceGroups,
        [],
      );
    }
  }, [
    mccbList,
    rooms,
    categories,
    logs,
    logSettings,
    requests,
    deviceGroups,
    saveToServer,
  ]);

  const changeMaxHistorySize = useCallback(
    (size) => {
      const newSize = Number(size);
      const nextHistory = requestHistory.slice(0, newSize);
      const nextLogs = createUpdatedLogs(
        LOG_TYPES.SYSTEM,
        `最大依頼履歴数が ${newSize} 件に変更されました。`,
        logs,
        logSettings.maxSize,
      );
      saveToServer(
        mccbList,
        rooms,
        categories,
        nextLogs,
        logSettings,
        requests,
        deviceGroups,
        nextHistory,
        { maxSize: newSize },
      );
    },
    [
      mccbList,
      rooms,
      categories,
      logs,
      logSettings,
      requests,
      deviceGroups,
      requestHistory,
      saveToServer,
    ],
  );

  // --- CSV一括インポートインジェクション ---
  const importFromCSV = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
          alert("インポート可能なデータ行が見つかりません。");
          return;
        }

        const parsedEntries = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const fields = line.split(",");
          if (fields.length >= 3) {
            parsedEntries.push({
              room: fields[0].trim(),
              category: fields[1].trim(),
              name: fields[2].trim(),
            });
          }
        }

        const roomSet = new Set(rooms);
        const categorySet = new Set(categories);
        const invalidEntries = parsedEntries
          .map((entry, index) => ({
            lineNumber: index + 2,
            roomValid: roomSet.has(entry.room),
            categoryValid: categorySet.has(entry.category),
            entry,
          }))
          .filter(
            ({ roomValid, categoryValid }) => !roomValid || !categoryValid,
          );

        if (invalidEntries.length > 0) {
          const invalidDetails = invalidEntries
            .slice(0, 10)
            .map(({ lineNumber, roomValid, categoryValid, entry }) => {
              const reasons = [];
              if (!roomValid)
                reasons.push(`電気室「${entry.room || "(空欄)"}」`);
              if (!categoryValid)
                reasons.push(`区分「${entry.category || "(空欄)"}」`);
              return `${lineNumber}行目: ${reasons.join(" / ")} がマスター未登録です。`;
            })
            .join("\n");
          const omittedCount =
            invalidEntries.length > 10
              ? `\n...ほか ${invalidEntries.length - 10} 件`
              : "";
          alert(
            `CSV取込を中止しました。電気室または区分がマスターと一致しない行があります。\n\n${invalidDetails}${omittedCount}`,
          );
          return;
        }

        if (parsedEntries.length > 0) {
          if (
            window.confirm(
              `⚠️ 注意 ⚠️\n現在登録されているすべての設備データを消去し、CSVの ${parsedEntries.length} 件で完全に【データ上書き】しますか？`,
            )
          ) {
            const newMccbList = parsedEntries.map((e, idx) => ({
              ...e,
              id: createMccbId(idx),
              isPowerOff: false,
              isFavorite: false,
              childCards: createDefaultChildCards(),
            }));
            const nextLogs = createUpdatedLogs(
              LOG_TYPES.MASTER_CREATE,
              `CSVから ${newMccbList.length} 件の設備データが一括上書きインポートされました。`,
              logs,
              logSettings.maxSize,
            );
            saveToServer(
              newMccbList,
              rooms,
              categories,
              nextLogs,
              logSettings,
              requests,
              deviceGroups,
            );
            alert(
              `CSVから ${newMccbList.length} 件のマスタデータを正常に上書き取り込みしました。`,
            );
          }
        } else {
          alert("有効なCSVデータが解析できませんでした。");
        }
      };
      reader.readAsText(file, "UTF-8");
    },
    [
      rooms,
      categories,
      logs,
      logSettings,
      requests,
      deviceGroups,
      saveToServer,
    ],
  );

  // --- 一括設備グループ制御マスター ---
  const addDeviceGroup = useCallback(
    (name) => {
      const newGroup = { id: `GROUP-${Date.now()}`, name, mccbIds: [] };
      const nextLogs = createUpdatedLogs(
        LOG_TYPES.MASTER_CREATE,
        `設備グループ「${name}」を新規作成しました。`,
        logs,
        logSettings.maxSize,
      );
      saveToServer(
        mccbList,
        rooms,
        categories,
        nextLogs,
        logSettings,
        requests,
        [...deviceGroups, newGroup],
      );
    },
    [
      mccbList,
      rooms,
      categories,
      logs,
      logSettings,
      requests,
      deviceGroups,
      saveToServer,
    ],
  );

  const updateDeviceGroup = useCallback(
    (id, updatedGroup) => {
      const nextGroups = deviceGroups.map((g) =>
        g.id === id ? updatedGroup : g,
      );
      saveToServer(
        mccbList,
        rooms,
        categories,
        logs,
        logSettings,
        requests,
        nextGroups,
      );
    },
    [
      mccbList,
      rooms,
      categories,
      logs,
      logSettings,
      requests,
      deviceGroups,
      saveToServer,
    ],
  );

  const deleteDeviceGroup = useCallback(
    (id) => {
      const groupToDelete = deviceGroups.find((g) => g.id === id);
      const nextLogs = createUpdatedLogs(
        LOG_TYPES.MASTER_DELETE,
        `設備グループ「${groupToDelete?.name}」を削除しました。`,
        logs,
        logSettings.maxSize,
      );
      const nextGroups = deviceGroups.filter((g) => g.id !== id);
      saveToServer(
        mccbList,
        rooms,
        categories,
        nextLogs,
        logSettings,
        requests,
        nextGroups,
      );
    },
    [
      mccbList,
      rooms,
      categories,
      logs,
      logSettings,
      requests,
      deviceGroups,
      saveToServer,
    ],
  );

  // --- ⚡ 停電作業依頼発行（自動スライド札割り当てシミュレーション） ---
  const addRequest = useCallback(
    (newRequest) => {
      runSyncTask(async () => {
        const res = await fetch(API_URL);
        const data = await res.json();
        const latest = parseServerData(data);

        // ローカルで競合を避けつつシミュレーションを行うため、現在のマスタ・依頼を基に状態を作る
        let currentMccbList = latest.mccbList.map((m) => ({
          ...m,
          childCards: m.childCards ? m.childCards.map((c) => ({ ...c })) : [],
        }));
        const currentRequests = latest.requests || [];

        // 既存依頼から実際に占有されている子札情報をインデックス化（actualMccbId -> Map(cardNo -> workerName)）
        const actualReservations = new Map();
        currentRequests.forEach((req) => {
          if (!req.reservedCards) return;
          Object.entries(req.reservedCards).forEach(([, resInfo]) => {
            if (!resInfo || !resInfo.actualMccbId) return;
            const actualId = resInfo.actualMccbId;
            if (!actualReservations.has(actualId))
              actualReservations.set(actualId, new Map());
            const cardMap = actualReservations.get(actualId);
            if (resInfo.cardNo != null)
              cardMap.set(resInfo.cardNo, req.workerName);
          });
        });

        // インデックスを反映して childCards の isBorrowed / workerName を更新
        currentMccbList = currentMccbList.map((mccb) => {
          const cardMap = actualReservations.get(mccb.id);
          const updatedCards = mccb.childCards.map((card) => {
            if (cardMap && cardMap.has(card.id)) {
              return {
                ...card,
                isBorrowed: true,
                workerName: cardMap.get(card.id) || "",
              };
            }
            return {
              ...card,
              isBorrowed: !!card.isBorrowed,
              workerName: card.workerName || "",
            };
          });
          return { ...mccb, childCards: updatedCards };
        });

        // 新規割当シミュレーション（簡略化版：childCards の isBorrowed 状態のみ参照して割当）
        const reservedCards = {};
        for (const targetId of newRequest.targetMccbIds) {
          const originalMccb = currentMccbList.find((m) => m.id === targetId);
          if (!originalMccb) {
            reservedCards[targetId] = {
              actualMccbId: null,
              cardNo: null,
              displayName: "空きなし",
              customDummyName: null,
            };
            continue;
          }

          const { finalMccb, availableIdx } = findAvailableCard(
            originalMccb,
            currentMccbList,
          );

          if (finalMccb && availableIdx !== -1) {
            // マップ上の childCards を更新して次のループで重複が起きないようにする
            currentMccbList = currentMccbList.map((mccb) => {
              if (mccb.id === finalMccb.id) {
                const updatedCards = [...mccb.childCards];
                updatedCards[availableIdx] = {
                  ...updatedCards[availableIdx],
                  isBorrowed: true,
                  workerName: newRequest.workerName,
                };
                return { ...mccb, childCards: updatedCards };
              }
              return mccb;
            });

            const assignedCardNo =
              finalMccb.childCards[availableIdx]?.id ?? availableIdx + 1;

            reservedCards[targetId] = {
              actualMccbId: finalMccb.id,
              cardNo: assignedCardNo,
              displayName: finalMccb.name,
              customDummyName: newRequest.dummyNames?.[targetId] || null,
            };
          } else {
            reservedCards[targetId] = {
              actualMccbId: null,
              cardNo: null,
              displayName: "空きなし",
              customDummyName: null,
            };
          }
        }

        const finalRequest = { ...newRequest, reservedCards };
        const nextRequests = [finalRequest, ...currentRequests];
        const nextLogs = createUpdatedLogs(
          LOG_TYPES.OPERATION,
          `👷 ${newRequest.workerName}氏の停電依頼を発行し\n子札を貸出予約しました。`,
          latest.logs,
          latest.logSettings.maxSize,
        );

        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...latest,
            mccbList: currentMccbList,
            requests: nextRequests,
            logs: nextLogs,
          }),
        });

        setMccbList(currentMccbList);
        setRequests(nextRequests);
        setLogs(nextLogs);
      });
    },
    [runSyncTask],
  );

  /** 停電作業依頼の解約・完了処理（使用札の解放） */
  const deleteRequest = useCallback(
    (id) => {
      // ローカル状態の先行切断
      setRequests((prev) => prev.filter((req) => req.id !== id));

      runSyncTask(async () => {
        const res = await fetch(API_URL);
        const data = await res.json();
        const latest = parseServerData(data);

        let currentMccbList = latest.mccbList;
        let currentRequests = latest.requests;
        let currentHistory = latest.requestHistory || [];

        const reqToDelete = currentRequests.find((r) => r.id === id);

        // 確保されていた子札・ダミー札の返却解放処理
        if (reqToDelete?.reservedCards) {
          Object.keys(reqToDelete.reservedCards).forEach((targetId) => {
            const resInfo = reqToDelete.reservedCards[targetId];
            if (resInfo?.actualMccbId && resInfo?.cardNo) {
              currentMccbList = currentMccbList.map((mccb) => {
                if (mccb.id === resInfo.actualMccbId && mccb.childCards) {
                  const cardIdx = mccb.childCards.findIndex(
                    (c) => c.id === resInfo.cardNo,
                  );
                  if (cardIdx !== -1) {
                    const card = mccb.childCards[cardIdx];
                    if (card.workerName === reqToDelete.workerName) {
                      const updatedCards = [...mccb.childCards];
                      updatedCards[cardIdx] = {
                        ...card,
                        isBorrowed: false,
                        workerName: "",
                      };
                      return { ...mccb, childCards: updatedCards };
                    }
                  }
                }
                return mccb;
              });
            }
          });
        }

        const completedRequest = reqToDelete
          ? { ...reqToDelete, completedTimestamp: getTimestamp() }
          : null;
        const nextRequests = currentRequests.filter((req) => req.id !== id);

        const maxSize = latest.historySettings?.maxSize || DEFAULT_MAX_SIZE;
        const nextHistory = completedRequest
          ? [completedRequest, ...currentHistory].slice(0, maxSize)
          : currentHistory;
        const completedWorkerName = reqToDelete?.workerName || "作業者";
        const nextLogs = createUpdatedLogs(
          LOG_TYPES.OPERATION,
          `👷 ${completedWorkerName}氏の作業完了に伴い\n子札が返却されました。`,
          latest.logs,
          latest.logSettings.maxSize,
        );

        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...latest,
            mccbList: currentMccbList,
            requests: nextRequests,
            requestHistory: nextHistory,
            logs: nextLogs,
          }),
        });

        setMccbList(currentMccbList);
        setRequests(nextRequests);
        setRequestHistory(nextHistory);
        setLogs(nextLogs);
      });
    },
    [runSyncTask],
  );

  return {
    mccbList,
    rooms,
    categories,
    logs,
    logSettings,
    requests,
    requestHistory,
    historySettings,
    deviceGroups,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
    updateMccb,
    saveMccbEntry,
    deleteMccb,
    importFromCSV,
    getBorrowedCount,
    addRoom,
    updateRoom,
    deleteRoom,
    addCategory,
    updateCategory,
    deleteCategory,
    changeMaxLogSize,
    clearAllLogs,
    addRequest,
    deleteRequest,
    clearRequestHistory,
    changeMaxHistorySize,
  };
}
