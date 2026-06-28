import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "/api/mccb";
const CORE_API_URL = `${API_URL}?core=1`;
const VERSION_URL = `${API_URL}/version`;
const LOGS_PAGE_URL = "/api/logs";
const HISTORY_PAGE_URL = "/api/request-history";
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
const LOG_PAGE_SIZE = 50;
const HISTORY_PAGE_SIZE = 20;
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

const createPageInfo = (page = 1, pageSize = 50, total = 0) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

const getPageSlice = (items, pageInfo) => {
  const safeItems = Array.isArray(items) ? items : [];
  const start = (pageInfo.page - 1) * pageInfo.pageSize;
  return safeItems.slice(start, start + pageInfo.pageSize);
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
    version: Number(source.version || 0),
  };
};

// ==========================================
// 2. カスタムフック定義
// ==========================================
export function useMccbData() {
  const [mccbList, setMccbList] = useState([]);
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [logs, setLogs] = useState([]);
  const [pagedLogs, setPagedLogs] = useState([]);
  const [logPageInfo, setLogPageInfo] = useState(() =>
    createPageInfo(1, LOG_PAGE_SIZE),
  );
  const [logSettings, setLogSettings] = useState({ maxSize: DEFAULT_MAX_SIZE });
  const [requests, setRequests] = useState([]);
  const [deviceGroups, setDeviceGroups] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [pagedRequestHistory, setPagedRequestHistory] = useState([]);
  const [historyPageInfo, setHistoryPageInfo] = useState(() =>
    createPageInfo(1, HISTORY_PAGE_SIZE),
  );
  const [historySettings, setHistorySettings] = useState({
    maxSize: DEFAULT_MAX_SIZE,
  });

  // 同期タスクキューおよびタイマー制御用のRef
  const syncQueue = useRef(Promise.resolve());
  const pauseTimer = useRef(0);
  const syncInProgress = useRef(false);
  const lastVersion = useRef(0);

  const applyLogs = useCallback((nextLogs) => {
    const normalizedLogs = normalizeLogs(nextLogs);
    setLogs(normalizedLogs);
    const nextPageInfo = createPageInfo(
      1,
      LOG_PAGE_SIZE,
      normalizedLogs.length,
    );
    setLogPageInfo(nextPageInfo);
    setPagedLogs(getPageSlice(normalizedLogs, nextPageInfo));
  }, []);

  const applyRequestHistory = useCallback((nextHistory) => {
    const normalizedHistory = Array.isArray(nextHistory) ? nextHistory : [];
    setRequestHistory(normalizedHistory);
    const nextPageInfo = createPageInfo(
      1,
      HISTORY_PAGE_SIZE,
      normalizedHistory.length,
    );
    setHistoryPageInfo(nextPageInfo);
    setPagedRequestHistory(getPageSlice(normalizedHistory, nextPageInfo));
  }, []);

  const applyVersion = useCallback((version) => {
    if (version) {
      lastVersion.current = Number(version);
    }
  }, []);

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
    const applyLogsPageFromArray = (nextLogs) => {
      const nextPageInfo = createPageInfo(1, LOG_PAGE_SIZE, nextLogs.length);
      setLogPageInfo(nextPageInfo);
      setPagedLogs(getPageSlice(nextLogs, nextPageInfo));
    };

    const applyHistoryPageFromArray = (nextHistory) => {
      const nextPageInfo = createPageInfo(
        1,
        HISTORY_PAGE_SIZE,
        nextHistory.length,
      );
      setHistoryPageInfo(nextPageInfo);
      setPagedRequestHistory(getPageSlice(nextHistory, nextPageInfo));
    };

    const applyServerData = (data) => {
      const parsed = parseServerData(data);
      lastVersion.current = parsed.version || lastVersion.current;
      setMccbList(parsed.mccbList);
      setRooms(parsed.rooms);
      setCategories(parsed.categories);
      if (!data.core) {
        setLogs(parsed.logs);
        applyLogsPageFromArray(parsed.logs);
      }
      setLogSettings(parsed.logSettings);
      setRequests(parsed.requests);
      setDeviceGroups(parsed.deviceGroups);
      if (!data.core) {
        setRequestHistory(parsed.requestHistory);
        applyHistoryPageFromArray(parsed.requestHistory);
      }
      setHistorySettings(parsed.historySettings);
    };

    const fetchPageSnapshots = () => {
      fetch(`${LOGS_PAGE_URL}?page=1&pageSize=${LOG_PAGE_SIZE}`)
        .then((res) => res.json())
        .then((result) => {
          setPagedLogs(normalizeLogs(result.items || []));
          setLogPageInfo(
            createPageInfo(
              result.page || 1,
              result.pageSize || LOG_PAGE_SIZE,
              result.total || 0,
            ),
          );
        })
        .catch((err) => console.error("ログページ同期エラー:", err));

      fetch(`${HISTORY_PAGE_URL}?page=1&pageSize=${HISTORY_PAGE_SIZE}`)
        .then((res) => res.json())
        .then((result) => {
          setPagedRequestHistory(result.items || []);
          setHistoryPageInfo(
            createPageInfo(
              result.page || 1,
              result.pageSize || HISTORY_PAGE_SIZE,
              result.total || 0,
            ),
          );
        })
        .catch((err) => console.error("依頼履歴ページ同期エラー:", err));
    };

    const fetchFullData = () =>
      fetch(CORE_API_URL)
        .then((res) => res.json())
        .then((data) => {
          applyServerData(data);
          fetchPageSnapshots();
        });

    const fetchData = () => {
      if (Date.now() < pauseTimer.current || syncInProgress.current) return;

      if (lastVersion.current === 0) {
        fetchFullData().catch((err) => console.error("自動同期エラー:", err));
        return;
      }

      fetch(VERSION_URL)
        .then((res) => res.json())
        .then((data) => {
          const nextVersion = Number(data.version || 0);
          if (nextVersion && nextVersion !== lastVersion.current) {
            return fetchFullData();
          }
          return null;
        })
        .catch((err) => console.error("自動同期エラー:", err));
    };

    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const fetchLogsPage = useCallback(async (page = 1) => {
    const res = await fetch(
      `${LOGS_PAGE_URL}?page=${encodeURIComponent(page)}&pageSize=${LOG_PAGE_SIZE}`,
    );
    if (!res.ok) throw new Error(`ログページ取得に失敗しました (${res.status})`);
    const result = await res.json();
    setPagedLogs(normalizeLogs(result.items || []));
    setLogPageInfo(
      createPageInfo(
        result.page || 1,
        result.pageSize || LOG_PAGE_SIZE,
        result.total || 0,
      ),
    );
  }, []);

  const fetchRequestHistoryPage = useCallback(async (page = 1) => {
    const res = await fetch(
      `${HISTORY_PAGE_URL}?page=${encodeURIComponent(page)}&pageSize=${HISTORY_PAGE_SIZE}`,
    );
    if (!res.ok) throw new Error(`依頼履歴ページ取得に失敗しました (${res.status})`);
    const result = await res.json();
    setPagedRequestHistory(result.items || []);
    setHistoryPageInfo(
      createPageInfo(
        result.page || 1,
        result.pageSize || HISTORY_PAGE_SIZE,
        result.total || 0,
      ),
    );
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
      const nextLogPageInfo = createPageInfo(1, LOG_PAGE_SIZE, nextLogs.length);
      setLogPageInfo(nextLogPageInfo);
      setPagedLogs(getPageSlice(nextLogs, nextLogPageInfo));
      setLogSettings(nextSettings);
      setRequests(nextRequests);
      setDeviceGroups(nextDeviceGroups);
      setRequestHistory(nextHistory);
      const nextHistoryPageInfo = createPageInfo(
        1,
        HISTORY_PAGE_SIZE,
        nextHistory.length,
      );
      setHistoryPageInfo(nextHistoryPageInfo);
      setPagedRequestHistory(getPageSlice(nextHistory, nextHistoryPageInfo));
      setHistorySettings(nextHistorySettings);

      runSyncTask(async () => {
        const res = await fetch(API_URL, {
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
        const result = await res.json();
        if (result.version) {
          lastVersion.current = Number(result.version);
        }
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

      setMccbList((prev) => [...prev, newMccb]);
      runSyncTask(async () => {
        const res = await fetch("/api/mccbs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mccb: newMccb }),
        });
        if (!res.ok) throw new Error(`設備登録に失敗しました (${res.status})`);
        const result = await res.json();
        if (result.mccb) {
          setMccbList((prev) =>
            prev.map((mccb) => (mccb.id === result.mccb.id ? result.mccb : mccb)),
          );
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, runSyncTask],
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
          const nextLogs = normalizeLogs(result.logs);
          setLogs(nextLogs);
          const nextPageInfo = createPageInfo(1, LOG_PAGE_SIZE, nextLogs.length);
          setLogPageInfo(nextPageInfo);
          setPagedLogs(getPageSlice(nextLogs, nextPageInfo));
        }
        if (result.version) {
          lastVersion.current = Number(result.version);
        }
      });
    },
    [runSyncTask],
  );

  /** 設備マスタの完全削除 */
  const deleteMccb = useCallback(
    (id) => {
      if (window.confirm(`完全に削除してもよろしいですか？`)) {
        setMccbList((prev) => prev.filter((item) => item.id !== id));
        runSyncTask(async () => {
          const res = await fetch(`/api/mccbs/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error(`設備削除に失敗しました (${res.status})`);
          const result = await res.json();
          if (result.deletedId) {
            setMccbList((prev) =>
              prev.filter((item) => item.id !== result.deletedId),
            );
          }
          if (Array.isArray(result.logs)) applyLogs(result.logs);
          applyVersion(result.version);
        });
      }
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  // --- マスター項目（電気室・区分）制御 ---
  const addRoom = useCallback(
    (roomName) => {
      const trimmed = roomName.trim();
      if (trimmed && !rooms.includes(trimmed)) {
        const nextRooms = [...rooms, trimmed];
        setRooms(nextRooms);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/rooms", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rooms: nextRooms, mccbList }),
          });
          if (!res.ok) throw new Error(`電気室追加に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.rooms)) setRooms(result.rooms);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, mccbList, rooms, runSyncTask],
  );

  const updateRoom = useCallback(
    (oldName, newName) => {
      const trimmed = newName.trim();
      if (trimmed && !rooms.includes(trimmed)) {
        const nextList = mccbList.map((m) =>
          m.room === oldName ? { ...m, room: trimmed } : m,
        );
        const nextRooms = rooms.map((r) => (r === oldName ? trimmed : r));
        setMccbList(nextList);
        setRooms(nextRooms);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/rooms", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rooms: nextRooms, mccbList: nextList }),
          });
          if (!res.ok) throw new Error(`電気室編集に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.rooms)) setRooms(result.rooms);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, mccbList, rooms, runSyncTask],
  );

  const deleteRoom = useCallback(
    (roomName) => {
      if (
        !mccbList.some((m) => m.room === roomName) &&
        window.confirm(`削除しますか？`)
      ) {
        const nextRooms = rooms.filter((r) => r !== roomName);
        setRooms(nextRooms);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/rooms", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rooms: nextRooms, mccbList }),
          });
          if (!res.ok) throw new Error(`電気室削除に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.rooms)) setRooms(result.rooms);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, mccbList, rooms, runSyncTask],
  );

  const addCategory = useCallback(
    (categoryName) => {
      const trimmed = categoryName.trim();
      if (trimmed && !categories.includes(trimmed)) {
        const nextCategories = [...categories, trimmed];
        setCategories(nextCategories);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categories: nextCategories, mccbList }),
          });
          if (!res.ok) throw new Error(`区分追加に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, mccbList, runSyncTask],
  );

  const updateCategory = useCallback(
    (oldName, newName) => {
      const trimmed = newName.trim();
      if (trimmed && !categories.includes(trimmed)) {
        const nextList = mccbList.map((m) =>
          m.category === oldName ? { ...m, category: trimmed } : m,
        );
        const nextCats = categories.map((c) => (c === oldName ? trimmed : c));
        setMccbList(nextList);
        setCategories(nextCats);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categories: nextCats, mccbList: nextList }),
          });
          if (!res.ok) throw new Error(`区分編集に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, mccbList, runSyncTask],
  );

  const deleteCategory = useCallback(
    (categoryName) => {
      if (
        !mccbList.some((m) => m.category === categoryName) &&
        window.confirm(`削除しますか？`)
      ) {
        const nextCategories = categories.filter((c) => c !== categoryName);
        setCategories(nextCategories);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categories: nextCategories, mccbList }),
          });
          if (!res.ok) throw new Error(`区分削除に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, mccbList, runSyncTask],
  );

  // --- システムログ制御 ---
  const clearAllLogs = useCallback(() => {
    if (window.confirm("ログ履歴をクリアしますか？")) {
      runSyncTask(async () => {
        const res = await fetch("/api/admin/logs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear" }),
        });
        if (!res.ok) throw new Error(`ログクリアに失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        if (result.logSettings) setLogSettings(result.logSettings);
        applyVersion(result.version);
      });
    }
  }, [applyLogs, applyVersion, runSyncTask]);

  const changeMaxLogSize = useCallback(
    (size) => {
      const numSize = Number(size);
      setLogSettings((prev) => ({ ...prev, maxSize: numSize }));
      runSyncTask(async () => {
        const res = await fetch("/api/admin/logs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setMaxSize", maxSize: numSize }),
        });
        if (!res.ok) throw new Error(`ログ保持件数変更に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        if (result.logSettings) setLogSettings(result.logSettings);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  // --- 停電作業依頼 履歴データ制御 ---
  const clearRequestHistory = useCallback(() => {
    if (
      window.confirm(
        "過去の作業完了・解約の履歴データをすべて消去しますか？（元に戻せません）",
      )
    ) {
      applyRequestHistory([]);
      runSyncTask(async () => {
        const res = await fetch("/api/admin/request-history", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear" }),
        });
        if (!res.ok) throw new Error(`依頼履歴クリアに失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.requestHistory)) {
          applyRequestHistory(result.requestHistory);
        }
        if (result.historySettings) setHistorySettings(result.historySettings);
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    }
  }, [applyLogs, applyRequestHistory, applyVersion, runSyncTask]);

  const changeMaxHistorySize = useCallback(
    (size) => {
      const newSize = Number(size);
      setHistorySettings({ maxSize: newSize });
      applyRequestHistory(requestHistory.slice(0, newSize));
      runSyncTask(async () => {
        const res = await fetch("/api/admin/request-history", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setMaxSize", maxSize: newSize }),
        });
        if (!res.ok) throw new Error(`依頼履歴保持件数変更に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.requestHistory)) {
          applyRequestHistory(result.requestHistory);
        }
        if (result.historySettings) setHistorySettings(result.historySettings);
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyRequestHistory, applyVersion, requestHistory, runSyncTask],
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
      const nextGroups = [...deviceGroups, newGroup];
      setDeviceGroups(nextGroups);
      runSyncTask(async () => {
        const res = await fetch("/api/admin/device-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceGroups: nextGroups,
            logType: LOG_TYPES.MASTER_CREATE,
            logMessage: `設備グループ「${name}」を新規作成しました。`,
          }),
        });
        if (!res.ok) throw new Error(`設備グループ作成に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.deviceGroups)) {
          setDeviceGroups(result.deviceGroups);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, deviceGroups, runSyncTask],
  );

  const updateDeviceGroup = useCallback(
    (id, updatedGroup) => {
      const nextGroups = deviceGroups.map((g) =>
        g.id === id ? updatedGroup : g,
      );
      setDeviceGroups(nextGroups);
      runSyncTask(async () => {
        const res = await fetch("/api/admin/device-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceGroups: nextGroups }),
        });
        if (!res.ok) throw new Error(`設備グループ更新に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.deviceGroups)) {
          setDeviceGroups(result.deviceGroups);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, deviceGroups, runSyncTask],
  );

  const deleteDeviceGroup = useCallback(
    (id) => {
      const groupToDelete = deviceGroups.find((g) => g.id === id);
      const nextGroups = deviceGroups.filter((g) => g.id !== id);
      setDeviceGroups(nextGroups);
      runSyncTask(async () => {
        const res = await fetch("/api/admin/device-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceGroups: nextGroups,
            logType: LOG_TYPES.MASTER_DELETE,
            logMessage: `設備グループ「${groupToDelete?.name}」を削除しました。`,
          }),
        });
        if (!res.ok) throw new Error(`設備グループ削除に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.deviceGroups)) {
          setDeviceGroups(result.deviceGroups);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, deviceGroups, runSyncTask],
  );

  const createDatabaseBackup = useCallback(() => {
    runSyncTask(async () => {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      if (!res.ok) throw new Error(`DBバックアップの作成に失敗しました (${res.status})`);

      const result = await res.json();
      if (Array.isArray(result.logs)) {
        applyLogs(result.logs);
      }
      applyVersion(result.version);
      alert(`DBバックアップを作成しました。\n${result.backup?.fileName || ""}`);
    });
  }, [applyLogs, applyVersion, runSyncTask]);

  // --- ⚡ 停電作業依頼発行（自動スライド札割り当てシミュレーション） ---
  const addRequest = useCallback(
    (newRequest) => {
      runSyncTask(async () => {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: newRequest }),
        });

        if (!res.ok) {
          throw new Error(`停電作業依頼の発行に失敗しました (${res.status})`);
        }

        const result = await res.json();
        if (Array.isArray(result.changedMccbs)) {
          setMccbList((prev) => {
            const changedById = new Map(
              result.changedMccbs.map((mccb) => [mccb.id, mccb]),
            );
            return prev.map((mccb) => changedById.get(mccb.id) || mccb);
          });
        }
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.logs)) {
          const nextLogs = normalizeLogs(result.logs);
          setLogs(nextLogs);
          const nextPageInfo = createPageInfo(1, LOG_PAGE_SIZE, nextLogs.length);
          setLogPageInfo(nextPageInfo);
          setPagedLogs(getPageSlice(nextLogs, nextPageInfo));
        }
        if (result.version) {
          lastVersion.current = Number(result.version);
        }
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
        const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          throw new Error(`停電作業依頼の完了処理に失敗しました (${res.status})`);
        }

        const result = await res.json();
        if (Array.isArray(result.changedMccbs)) {
          setMccbList((prev) => {
            const changedById = new Map(
              result.changedMccbs.map((mccb) => [mccb.id, mccb]),
            );
            return prev.map((mccb) => changedById.get(mccb.id) || mccb);
          });
        }
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.requestHistory)) {
          setRequestHistory(result.requestHistory);
          const nextHistoryPageInfo = createPageInfo(
            1,
            HISTORY_PAGE_SIZE,
            result.requestHistory.length,
          );
          setHistoryPageInfo(nextHistoryPageInfo);
          setPagedRequestHistory(
            getPageSlice(result.requestHistory, nextHistoryPageInfo),
          );
        }
        if (Array.isArray(result.logs)) {
          const nextLogs = normalizeLogs(result.logs);
          setLogs(nextLogs);
          const nextPageInfo = createPageInfo(1, LOG_PAGE_SIZE, nextLogs.length);
          setLogPageInfo(nextPageInfo);
          setPagedLogs(getPageSlice(nextLogs, nextPageInfo));
        }
        if (result.version) {
          lastVersion.current = Number(result.version);
        }
      });
    },
    [runSyncTask],
  );

  return {
    mccbList,
    rooms,
    categories,
    logs,
    pagedLogs,
    logPageInfo,
    logSettings,
    requests,
    requestHistory,
    pagedRequestHistory,
    historyPageInfo,
    historySettings,
    deviceGroups,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
    createDatabaseBackup,
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
    fetchLogsPage,
    fetchRequestHistoryPage,
    addRequest,
    deleteRequest,
    clearRequestHistory,
    changeMaxHistorySize,
  };
}
