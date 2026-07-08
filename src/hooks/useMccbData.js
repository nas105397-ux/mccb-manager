import { startTransition, useState, useEffect, useRef, useCallback } from "react";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MAX_SIZE,
  DEFAULT_ROOMS,
  LOG_TYPES,
} from "../shared/appConstants";
import { normalizeCategoryColors } from "../shared/categoryColorUtils";

const API_URL = "/api/mccb";
const CORE_API_URL = `${API_URL}?core=1`;
const VERSION_URL = `${API_URL}/version`;
const LOGS_PAGE_URL = "/api/logs";
const HISTORY_PAGE_URL = "/api/request-history";
const BACKUPS_URL = "/api/admin/backups";
const POLL_INTERVAL = 5000; // 3s -> 5s に緩和
const LOG_PAGE_SIZE = 50;
const HISTORY_PAGE_SIZE = 20;

// ==========================================
// 1. フック外の共通ユーティリティ関数群 (純粋関数)
// ==========================================

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

const mergeChildCardChanges = (currentMccb, changedMccb) => ({
  ...currentMccb,
  childCards: changedMccb.childCards || currentMccb.childCards,
});

/**
 * 停電作業依頼APIは、札の貸出状態が変わったMCCBだけを返す。
 * 一覧の表示名やお気に入り等のローカル表示情報は維持し、子札状態だけを差し替える。
 */
const mergeChangedMccbsByChildCards = (currentList, changedMccbs = []) => {
  const changedById = new Map(changedMccbs.map((mccb) => [mccb.id, mccb]));
  return currentList.map((mccb) => {
    const changedMccb = changedById.get(mccb.id);
    return changedMccb ? mergeChildCardChanges(mccb, changedMccb) : mccb;
  });
};

/** サーバー受信データのパース・デフォルト値マージ */
const parseServerData = (data) => {
  const source = data && typeof data === "object" ? data : {};
  const isArrayPayload = Array.isArray(data);

  return {
    mccbList: source.mccbList || (isArrayPayload ? data : []),
    rooms: source.rooms || DEFAULT_ROOMS,
    categories: source.categories || DEFAULT_CATEGORIES,
    categoryColors: normalizeCategoryColors(
      source.categories || DEFAULT_CATEGORIES,
      source.categoryColors || {},
    ),
    logs: Array.isArray(source.logs) ? source.logs : [],
    logSettings: source.logSettings || { maxSize: DEFAULT_MAX_SIZE },
    requests: source.requests || [],
    draftRequests: source.draftRequests || [],
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
  // サーバーデータの単一フロントキャッシュ。各画面はこの hook の状態と操作関数だけを参照する。
  const [mccbList, setMccbList] = useState([]);
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [categoryColors, setCategoryColors] = useState(() =>
    normalizeCategoryColors(DEFAULT_CATEGORIES),
  );
  const [logs, setLogs] = useState([]);
  const [pagedLogs, setPagedLogs] = useState([]);
  const [logPageInfo, setLogPageInfo] = useState(() =>
    createPageInfo(1, LOG_PAGE_SIZE),
  );
  const [logSettings, setLogSettings] = useState({ maxSize: DEFAULT_MAX_SIZE });
  const [requests, setRequests] = useState([]);
  const [draftRequests, setDraftRequests] = useState([]);
  const [deviceGroups, setDeviceGroups] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [pagedRequestHistory, setPagedRequestHistory] = useState([]);
  const [historyPageInfo, setHistoryPageInfo] = useState(() =>
    createPageInfo(1, HISTORY_PAGE_SIZE),
  );
  const [databaseBackups, setDatabaseBackups] = useState([]);
  const [historySettings, setHistorySettings] = useState({
    maxSize: DEFAULT_MAX_SIZE,
  });

  // 同期タスクキューおよびタイマー制御用のRef
  const syncQueue = useRef(Promise.resolve());
  const pauseTimer = useRef(0);
  const syncInProgress = useRef(false);
  const lastVersion = useRef(0);

  const applyLogs = useCallback((nextLogs) => {
    const safeLogs = Array.isArray(nextLogs) ? nextLogs : [];
    setLogs(safeLogs);
    const nextPageInfo = createPageInfo(
      1,
      LOG_PAGE_SIZE,
      safeLogs.length,
    );
    setLogPageInfo(nextPageInfo);
    setPagedLogs(getPageSlice(safeLogs, nextPageInfo));
  }, []);

  // ログ更新は再描画コストが高いため、即時操作の描画を妨げないよう transition 化する。
  const applyLogsInTransition = useCallback((nextLogs) => {
    startTransition(() => applyLogs(nextLogs));
  }, [applyLogs]);

  const applyChangedMccbs = useCallback((changedMccbs) => {
    if (!Array.isArray(changedMccbs)) return;
    setMccbList((prev) => mergeChangedMccbsByChildCards(prev, changedMccbs));
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

  const applyServerData = useCallback(
    (data) => {
      const parsed = parseServerData(data);
      applyVersion(parsed.version);
      setMccbList(parsed.mccbList);
      setRooms(parsed.rooms);
      setCategories(parsed.categories);
      setCategoryColors(parsed.categoryColors);
      // core 同期では肥大化しやすいログ/履歴を受け取らないため、既存ページ状態を維持する。
      if (!data?.core) {
        applyLogs(parsed.logs);
      }
      setLogSettings(parsed.logSettings);
      setRequests(parsed.requests);
      setDraftRequests(parsed.draftRequests);
      setDeviceGroups(parsed.deviceGroups);
      if (!data?.core) {
        applyRequestHistory(parsed.requestHistory);
      }
      setHistorySettings(parsed.historySettings);
    },
    [applyLogs, applyRequestHistory, applyVersion],
  );

  const fetchDatabaseBackups = useCallback(async () => {
    const res = await fetch(BACKUPS_URL);
    if (!res.ok) throw new Error(`DBバックアップ一覧の取得に失敗しました (${res.status})`);
    const result = await res.json();
    setDatabaseBackups(Array.isArray(result.backups) ? result.backups : []);
    return result.backups || [];
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
    return syncQueue.current;
  }, []);

  // --- 定期自動同期ポーリング設定 (useEffect) ---
  useEffect(() => {
    const fetchPageSnapshots = () => {
      // ログと依頼履歴はページ単位で同期し、通常巡回の payload を抑える。
      fetch(`${LOGS_PAGE_URL}?page=1&pageSize=${LOG_PAGE_SIZE}`)
        .then((res) => res.json())
        .then((result) => {
          setPagedLogs(Array.isArray(result.items) ? result.items : []);
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
          // version が進んだ時だけ全体同期し、複数端末運用時の無駄な再描画を避ける。
          if (nextVersion && nextVersion !== lastVersion.current) {
            return fetchFullData();
          }
          return null;
        })
        .catch((err) => console.error("自動同期エラー:", err));
    };

    fetchData();
    fetch(BACKUPS_URL)
      .then((res) => res.json())
      .then((result) => {
        setDatabaseBackups(Array.isArray(result.backups) ? result.backups : []);
      })
      .catch((err) => console.error("DBバックアップ一覧同期エラー:", err));
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [applyServerData]);

  const fetchLogsPage = useCallback(async (page = 1) => {
    const res = await fetch(
      `${LOGS_PAGE_URL}?page=${encodeURIComponent(page)}&pageSize=${LOG_PAGE_SIZE}`,
    );
    if (!res.ok) throw new Error(`ログページ取得に失敗しました (${res.status})`);
    const result = await res.json();
    setPagedLogs(Array.isArray(result.items) ? result.items : []);
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

  // --- 各種ビジネスロジック関数群 (useCallbackで完全キャッシュ化) ---

  /** 設備の個別新規マスタ登録 */
  const saveMccbEntry = useCallback(
    (entry) => {
      runSyncTask(async () => {
        const res = await fetch("/api/mccbs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mccb: entry }),
        });
        if (!res.ok) throw new Error(`設備登録に失敗しました (${res.status})`);
        const result = await res.json();
        if (result.mccb) {
          setMccbList((prev) => [...prev, result.mccb]);
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
        if (Array.isArray(result.logs)) applyLogsInTransition(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogsInTransition, applyVersion, runSyncTask],
  );

  /** 停電・送電状態だけを更新する軽量操作 */
  const updateMccbPower = useCallback(
    (id, isPowerOff) => {
      let previousMccb = null;
      setMccbList((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          previousMccb = item;
          return { ...item, isPowerOff };
        }),
      );

      runSyncTask(async () => {
        try {
          const res = await fetch(`${API_URL}/${encodeURIComponent(id)}/power`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPowerOff }),
          });

          const result = await res.json().catch(() => ({}));
          if (!res.ok) {
            const message =
              result?.error || `停電・送電状態の更新に失敗しました (${res.status})`;
            throw new Error(message);
          }

          if (result.mccb) {
            setMccbList((prev) =>
              prev.map((item) => (item.id === result.mccb.id ? result.mccb : item)),
            );
          }
          if (Array.isArray(result.logs)) applyLogsInTransition(result.logs);
          applyVersion(result.version);
        } catch (error) {
          if (previousMccb) {
            setMccbList((prev) =>
              prev.map((item) =>
                item.id === id && item.isPowerOff === isPowerOff
                  ? previousMccb
                  : item,
              ),
            );
          }
          window.alert(error.message || "停電・送電状態の更新に失敗しました。");
        }
      });
    },
    [applyLogsInTransition, applyVersion, runSyncTask],
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
        const nextCategoryColors = normalizeCategoryColors(nextCategories, {
          ...categoryColors,
        });
        setCategories(nextCategories);
        setCategoryColors(nextCategoryColors);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: nextCategories,
              categoryColors: nextCategoryColors,
              mccbList,
            }),
          });
          if (!res.ok) throw new Error(`区分追加に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (result.categoryColors) setCategoryColors(result.categoryColors);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, categoryColors, mccbList, runSyncTask],
  );

  const updateCategory = useCallback(
    (oldName, newName) => {
      const trimmed = newName.trim();
      if (trimmed && !categories.includes(trimmed)) {
        const nextList = mccbList.map((m) =>
          m.category === oldName ? { ...m, category: trimmed } : m,
        );
        const nextCats = categories.map((c) => (c === oldName ? trimmed : c));
        const nextCategoryColors = normalizeCategoryColors(nextCats, {
          ...categoryColors,
          [trimmed]: categoryColors[oldName],
        });
        setMccbList(nextList);
        setCategories(nextCats);
        setCategoryColors(nextCategoryColors);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: nextCats,
              categoryColors: nextCategoryColors,
              mccbList: nextList,
            }),
          });
          if (!res.ok) throw new Error(`区分編集に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (result.categoryColors) setCategoryColors(result.categoryColors);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, categoryColors, mccbList, runSyncTask],
  );

  const deleteCategory = useCallback(
    (categoryName) => {
      if (
        !mccbList.some((m) => m.category === categoryName) &&
        window.confirm(`削除しますか？`)
      ) {
        const nextCategories = categories.filter((c) => c !== categoryName);
        const nextCategoryColors = normalizeCategoryColors(
          nextCategories,
          categoryColors,
        );
        setCategories(nextCategories);
        setCategoryColors(nextCategoryColors);
        runSyncTask(async () => {
          const res = await fetch("/api/admin/categories", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: nextCategories,
              categoryColors: nextCategoryColors,
              mccbList,
            }),
          });
          if (!res.ok) throw new Error(`区分削除に失敗しました (${res.status})`);
          const result = await res.json();
          if (Array.isArray(result.categories)) setCategories(result.categories);
          if (result.categoryColors) setCategoryColors(result.categoryColors);
          if (Array.isArray(result.mccbList)) setMccbList(result.mccbList);
          applyVersion(result.version);
        });
      }
    },
    [applyVersion, categories, categoryColors, mccbList, runSyncTask],
  );

  const updateCategoryColor = useCallback(
    (categoryName, colorKey) => {
      if (!categories.includes(categoryName)) return;

      const nextCategoryColors = normalizeCategoryColors(categories, {
        ...categoryColors,
        [categoryName]: colorKey,
      });
      setCategoryColors(nextCategoryColors);

      runSyncTask(async () => {
        const res = await fetch("/api/admin/category-colors", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryColors: nextCategoryColors }),
        });
        if (!res.ok) throw new Error(`区分色変更に失敗しました (${res.status})`);
        const result = await res.json();
        if (result.categoryColors) setCategoryColors(result.categoryColors);
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, categories, categoryColors, runSyncTask],
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
            runSyncTask(async () => {
              const res = await fetch("/api/admin/mccb-import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries: parsedEntries }),
              });
              if (!res.ok) throw new Error(`CSV取込に失敗しました (${res.status})`);

              const result = await res.json();
              if (Array.isArray(result.mccbList)) {
                setMccbList(result.mccbList);
              }
              if (Array.isArray(result.deviceGroups)) {
                setDeviceGroups(result.deviceGroups);
              }
              if (Array.isArray(result.logs)) {
                applyLogs(result.logs);
              }
              applyVersion(result.version);
              alert(
                `CSVから ${parsedEntries.length} 件のマスタデータを正常に上書き取り込みしました。`,
              );
            });
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
      applyLogs,
      applyVersion,
      runSyncTask,
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
    (id, updatedGroup, options = {}) => {
      const nextGroups = deviceGroups.map((g) =>
        g.id === id ? updatedGroup : g,
      );
      setDeviceGroups(nextGroups);
      runSyncTask(async () => {
        const res = await fetch("/api/admin/device-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceGroups: nextGroups,
            logType: options.logType || LOG_TYPES.MASTER_UPDATE,
            logMessage: options.logMessage,
          }),
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
      const res = await fetch(BACKUPS_URL, { method: "POST" });
      if (!res.ok) throw new Error(`DBバックアップの作成に失敗しました (${res.status})`);

      const result = await res.json();
      if (Array.isArray(result.logs)) {
        applyLogs(result.logs);
      }
      applyVersion(result.version);
      await fetchDatabaseBackups();
      alert(`DBバックアップを作成しました。\n${result.backup?.fileName || ""}`);
    });
  }, [applyLogs, applyVersion, fetchDatabaseBackups, runSyncTask]);

  const restoreDatabaseBackup = useCallback((fileName) => {
    if (!fileName) {
      alert("復旧するバックアップを選択してください。");
      return;
    }

    if (
      !window.confirm(
        `現在のDBをバックアップ「${fileName}」の内容で復旧します。\n復旧前の現在DBも自動バックアップします。\n実行してもよろしいですか？`,
      )
    ) {
      return;
    }

    runSyncTask(async () => {
      const res = await fetch(`${BACKUPS_URL}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          result?.error || `DBバックアップからの復旧に失敗しました (${res.status})`;
        alert(message);
        throw new Error(message);
      }

      if (result.data) {
        applyServerData(result.data);
      }
      setDatabaseBackups(Array.isArray(result.backups) ? result.backups : []);
      alert(
        `DBをバックアップから復旧しました。\n復旧元: ${result.restoredFrom || fileName}\n復旧前バックアップ: ${result.rollbackBackup?.fileName || ""}`,
      );
    });
  }, [applyServerData, runSyncTask]);

  // --- ⚡ 停電作業依頼発行（自動スライド札割り当てシミュレーション） ---
  const addRequest = useCallback(
    async (newRequest) => {
      let createdRequest = null;
      await runSyncTask(async () => {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: newRequest }),
        });

        if (!res.ok) {
          throw new Error(`停電作業依頼の発行に失敗しました (${res.status})`);
        }

        const result = await res.json();
        createdRequest = result.request || null;
        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });

      if (!createdRequest) {
        throw new Error("停電作業依頼の発行結果を取得できませんでした。");
      }

      return createdRequest;
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
  );

  const addDraftRequest = useCallback(
    async (newRequest) => {
      let createdDraft = null;
      await runSyncTask(async () => {
        const res = await fetch("/api/draft-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: newRequest }),
        });

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `停電作業依頼の仮発行に失敗しました (${res.status})`,
          );
        }

        createdDraft = result.draftRequest || null;
        if (Array.isArray(result.draftRequests)) {
          setDraftRequests(result.draftRequests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });

      if (!createdDraft) {
        throw new Error("停電作業依頼の仮発行結果を取得できませんでした。");
      }

      return createdDraft;
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  const issueDraftRequest = useCallback(
    async (draftRequestId) => {
      let createdRequest = null;
      await runSyncTask(async () => {
        const res = await fetch(
          `/api/draft-requests/${encodeURIComponent(draftRequestId)}/issue`,
          { method: "POST" },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `仮発行依頼の本発行に失敗しました (${res.status})`,
          );
        }

        createdRequest = result.request || null;
        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.draftRequests)) {
          setDraftRequests(result.draftRequests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });

      if (!createdRequest) {
        throw new Error("仮発行依頼の本発行結果を取得できませんでした。");
      }

      return createdRequest;
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
  );

  const deleteDraftRequest = useCallback(
    (draftRequestId) => {
      setDraftRequests((prev) => prev.filter((req) => req.id !== draftRequestId));

      runSyncTask(async () => {
        const res = await fetch(
          `/api/draft-requests/${encodeURIComponent(draftRequestId)}`,
          { method: "DELETE" },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `仮発行依頼の削除に失敗しました (${res.status})`,
          );
        }

        if (Array.isArray(result.draftRequests)) {
          setDraftRequests(result.draftRequests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  const addTargetsToRequest = useCallback(
    (requestId, targetMccbIds, dummyNames = {}) => {
      runSyncTask(async () => {
        const res = await fetch(
          `/api/requests/${encodeURIComponent(requestId)}/targets`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetMccbIds, dummyNames }),
          },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `停電作業依頼への設備追加に失敗しました (${res.status})`,
          );
        }

        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
  );

  const updateRequestTargetCard = useCallback(
    (requestId, targetId, action) => {
      runSyncTask(async () => {
        const res = await fetch(
          `/api/requests/${encodeURIComponent(requestId)}/targets/${encodeURIComponent(targetId)}/card`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            result?.error || `停電作業依頼の子札操作に失敗しました (${res.status})`,
          );
        }

        applyChangedMccbs(result.changedMccbs);
        if (Array.isArray(result.requests)) {
          setRequests(result.requests);
        }
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
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
        applyChangedMccbs(result.changedMccbs);
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
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        applyVersion(result.version);
      });
    },
    [applyChangedMccbs, applyLogs, applyVersion, runSyncTask],
  );

  return {
    mccbList,
    rooms,
    categories,
    categoryColors,
    logs,
    pagedLogs,
    logPageInfo,
    logSettings,
    requests,
    draftRequests,
    requestHistory,
    pagedRequestHistory,
    historyPageInfo,
    historySettings,
    databaseBackups,
    deviceGroups,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
    createDatabaseBackup,
    restoreDatabaseBackup,
    updateMccb,
    updateMccbPower,
    saveMccbEntry,
    deleteMccb,
    importFromCSV,
    addRoom,
    updateRoom,
    deleteRoom,
    addCategory,
    updateCategory,
    deleteCategory,
    updateCategoryColor,
    changeMaxLogSize,
    clearAllLogs,
    fetchLogsPage,
    fetchRequestHistoryPage,
    addRequest,
    addDraftRequest,
    issueDraftRequest,
    deleteDraftRequest,
    addTargetsToRequest,
    updateRequestTargetCard,
    deleteRequest,
    clearRequestHistory,
    changeMaxHistorySize,
  };
}
