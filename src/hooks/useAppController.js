// アプリ全体の画面状態と集約済み操作関数を App コンポーネントへ渡す controller hook。
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMccbData } from "./useMccbData";
import {
  applyNameOverlaysToMccbs,
  createBorrowedCountMap,
  createRequestNameOverlayMap,
} from "../shared/mccbViewUtils";
import {
  DEFAULT_REQUEST_PRINT_MODE,
  REQUEST_PRINT_MODE_STORAGE_KEY,
  normalizeRequestPrintMode,
} from "../shared/printSettings";

export function useAppController() {
  const {
    mccbList,
    rooms,
    categories,
    categoryColors,
    updateMccb,
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
    requests,
    draftRequests,
    requestHistory,
    historySettings,
    databaseBackups,
    addRequest,
    addDraftRequest,
    issueDraftRequest,
    deleteDraftRequest,
    addTargetsToRequest,
    updateRequestTargetCard,
    deleteRequest,
    clearRequestHistory,
    changeMaxHistorySize,
    logs,
    pagedLogs,
    logPageInfo,
    logSettings,
    changeMaxLogSize,
    clearAllLogs,
    fetchLogsPage,
    fetchRequestHistoryPage,
    pagedRequestHistory,
    historyPageInfo,
    deviceGroups,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
    createDatabaseBackup,
    restoreDatabaseBackup,
    updateMccbPower,
  } = useMccbData();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("すべて");
  const [filterRoom, setFilterRoom] = useState("すべて");
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMccbId, setSelectedMccbId] = useState(null);
  const [requestPrintMode, setRequestPrintModeState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_REQUEST_PRINT_MODE;
    return normalizeRequestPrintMode(
      window.localStorage.getItem(REQUEST_PRINT_MODE_STORAGE_KEY),
    );
  });

  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname;

  useEffect(() => {
    // 入力中の再計算回数を抑えるため、検索語だけを短時間遅延させる。
    const timerId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);

    return () => window.clearTimeout(timerId);
  }, [searchTerm]);

  const setRequestPrintMode = useCallback((mode) => {
    const normalizedMode = normalizeRequestPrintMode(mode);
    setRequestPrintModeState(normalizedMode);
    window.localStorage.setItem(REQUEST_PRINT_MODE_STORAGE_KEY, normalizedMode);
  }, []);

  const handleToggleAdmin = useCallback(() => {
    if (!isAdmin) {
      const password = window.prompt("管理者パスワードを入力してください：");
      if (password === "admin") {
        setIsAdmin(true);
        navigate("/admin");
      } else if (password !== null) {
        alert("❌ パスワードが正しくありません。認証に失敗しました。");
      }
      return;
    }

    setIsAdmin(false);
    if (location.pathname === "/admin") {
      navigate("/");
    }
  }, [isAdmin, location.pathname, navigate]);

  // --- 依頼で占有されている MCCB を事前計算（originalId と actualMccbId の両方を含める）
  const activeMccbIds = useMemo(() => {
    const set = new Set();
    requests.forEach((req) => {
      if (!req.reservedCards) return;
      Object.entries(req.reservedCards).forEach(([origId, resInfo]) => {
        set.add(origId);
        if (resInfo?.actualMccbId) set.add(resInfo.actualMccbId);
      });
    });
    return set;
  }, [requests]);

  const processedMccbList = useMemo(() => {
    // 依頼中の代替名は表示用コピーにだけ合成し、マスタ名称は保持する。
    const nameOverlayMap = createRequestNameOverlayMap(requests, mccbList);
    return applyNameOverlaysToMccbs(mccbList, nameOverlayMap);
  }, [mccbList, requests]);

  const borrowedCountMap = useMemo(
    () => createBorrowedCountMap(mccbList),
    [mccbList],
  );

  const filteredMccbList = useMemo(() => {
    // 検索・部屋・状態・お気に入りの全条件を一度の走査で適用する。
    const lowerSearch = debouncedSearchTerm.trim().toLowerCase();

    return processedMccbList.filter((mccb) => {
      const borrowedCount = borrowedCountMap[mccb.id] ?? 0;
      const matchesSearch =
        !lowerSearch || mccb.name.toLowerCase().includes(lowerSearch);
      const matchesRoom = filterRoom === "すべて" || mccb.room === filterRoom;
      const matchesStatus =
        filterStatus === "すべて" ||
        (filterStatus === "送電中" && !mccb.isPowerOff) ||
        (filterStatus === "停電中" && mccb.isPowerOff) ||
        (filterStatus === "札返却済み" && mccb.isPowerOff && borrowedCount === 0) ||
        (filterStatus === "依頼発行中" && activeMccbIds.has(mccb.id));
      const matchesFavorite = !filterFavorite || mccb.isFavorite;

      return matchesSearch && matchesRoom && matchesStatus && matchesFavorite;
    });
  }, [
    processedMccbList,
    debouncedSearchTerm,
    filterRoom,
    filterStatus,
    filterFavorite,
    activeMccbIds,
    borrowedCountMap,
  ]);

  const currentMccb = useMemo(() => {
    if (!selectedMccbId) {
      return null;
    }

    return mccbList.find((m) => m.id === selectedMccbId) ?? null;
  }, [mccbList, selectedMccbId]);

  const handleSelect = useCallback(
    (id) => {
      const selected = mccbList.find((m) => m.id === id) ?? null;
      if (!selected) return;
      setSelectedMccbId(id);
    },
    [mccbList],
  );

  const handleCloseModal = useCallback(() => {
    setSelectedMccbId(null);
  }, []);

  const handleToggleFavorite = useCallback(
    (id, current) => {
      const target = mccbList.find((m) => m.id === id);
      if (!target) return;
      updateMccb({ ...target, isFavorite: !current });
    },
    [mccbList, updateMccb],
  );

  const totalCount = mccbList.length;
  const offCount = useMemo(
    () => mccbList.filter((m) => m.isPowerOff).length,
    [mccbList],
  );
  const onCount = useMemo(
    () => mccbList.filter((m) => !m.isPowerOff).length,
    [mccbList],
  );

  const navItems = useMemo(() => {
    const items = [
      { path: "/", label: "🔖 禁止札操作画面" },
      { path: "/request", label: "🖨️ 依頼発行・印刷" },
      {
        path: "/request-list",
        label: `📋 依頼一覧 (${requests.length})`,
      },
    ];

    if (isAdmin) {
      items.push({ path: "/admin", label: "⚙️ 管理画面" });
    }

    return items;
  }, [isAdmin, requests.length]);

  const goTo = useCallback(
    (path) => {
      navigate(path);
    },
    [navigate],
  );

  return {
    mccbList,
    rooms,
    categories,
    categoryColors,
    requests,
    draftRequests,
    requestHistory,
    pagedRequestHistory,
    historyPageInfo,
    historySettings,
    databaseBackups,
    logs,
    pagedLogs,
    logPageInfo,
    logSettings,
    deviceGroups,
    filteredMccbList,
    borrowedCountMap,
    currentMccb,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filterRoom,
    setFilterRoom,
    filterFavorite,
    setFilterFavorite,
    isAdmin,
    setIsAdmin,
    requestPrintMode,
    setRequestPrintMode,
    activeTab,
    navItems,
    totalCount,
    offCount,
    onCount,
    handleToggleAdmin,
    handleSelect,
    handleCloseModal,
    handleToggleFavorite,
    goTo,
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
    addRequest,
    addDraftRequest,
    issueDraftRequest,
    deleteDraftRequest,
    addTargetsToRequest,
    updateRequestTargetCard,
    deleteRequest,
    clearRequestHistory,
    changeMaxHistorySize,
    changeMaxLogSize,
    clearAllLogs,
    fetchLogsPage,
    fetchRequestHistoryPage,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
    createDatabaseBackup,
    restoreDatabaseBackup,
    // MCCB カードの依頼中表示と再描画判定に利用するID集合。
    activeMccbIds,
  };
}
