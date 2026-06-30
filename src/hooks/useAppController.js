import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMccbData } from "./useMccbData";
import {
  applyNameOverlaysToMccbs,
  createBorrowedCountMap,
  createRequestNameOverlayMap,
} from "../shared/mccbViewUtils";

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
    requestHistory,
    historySettings,
    addRequest,
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
    updateMccbPower,
  } = useMccbData();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("すべて");
  const [filterRoom, setFilterRoom] = useState("すべて");
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMccbId, setSelectedMccbId] = useState(null);
  const [selectedMccbCache, setSelectedMccbCache] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname;

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);

    return () => window.clearTimeout(timerId);
  }, [searchTerm]);

  const handleToggleAdmin = useCallback(() => {
    if (!isAdmin) {
      const password = window.prompt("管理者パスワードを入力してください：");
      if (password === "admin") {
        setIsAdmin(true);
        alert("🔓 管理者認証に成功しました。");
      } else if (password !== null) {
        alert("❌ パスワードが正しくありません。認証に失敗しました。");
      }
      return;
    }

    setIsAdmin(false);
  }, [isAdmin]);

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
    const nameOverlayMap = createRequestNameOverlayMap(requests, mccbList);
    return applyNameOverlaysToMccbs(mccbList, nameOverlayMap);
  }, [mccbList, requests]);

  const borrowedCountMap = useMemo(
    () => createBorrowedCountMap(mccbList),
    [mccbList],
  );

  const filteredMccbList = useMemo(() => {
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

    const found = mccbList.find((m) => m.id === selectedMccbId);
    if (found) {
      return found;
    }

    if (selectedMccbCache?.id === selectedMccbId) {
      return selectedMccbCache;
    }

    return null;
  }, [mccbList, selectedMccbId, selectedMccbCache]);

  const handleSelect = useCallback(
    (id) => {
      const selected = mccbList.find((m) => m.id === id) ?? null;
      setSelectedMccbCache(selected);
      setSelectedMccbId(id);
    },
    [mccbList],
  );

  const handleCloseModal = useCallback(() => {
    setSelectedMccbCache(null);
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

  const navItems = useMemo(
    () => [
      { path: "/", label: "🔖 札管理ダッシュボード" },
      { path: "/request", label: "🖨️ 停電作業 依頼発行・印刷" },
      {
        path: "/request-list",
        label: `📋 依頼一覧・進捗 (${requests.length})`,
      },
    ],
    [requests.length],
  );

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
    requestHistory,
    pagedRequestHistory,
    historyPageInfo,
    historySettings,
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
    // 新規追加: アクティブな MCCB ID の集合（MCCB カード再描画最適化に利用）
    activeMccbIds,
  };
}
