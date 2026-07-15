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

const DEFAULT_STATUS_SORT_ORDER = [
  "札返却済み",
  "依頼発行中",
  "停電中",
  "送電中",
];

const STATUS_SORT_ORDER_STORAGE_KEY = "mccb-manager.statusSortOrder";

const getInitialStatusSortOrder = () => {
  if (typeof window === "undefined") return DEFAULT_STATUS_SORT_ORDER;

  try {
    const savedOrder = JSON.parse(
      window.localStorage.getItem(STATUS_SORT_ORDER_STORAGE_KEY),
    );
    if (
      Array.isArray(savedOrder) &&
      savedOrder.length === DEFAULT_STATUS_SORT_ORDER.length &&
      DEFAULT_STATUS_SORT_ORDER.every((status) => savedOrder.includes(status))
    ) {
      return savedOrder;
    }
  } catch {
    // 不正な保存値は既定の順序で上書きする。
  }

  return DEFAULT_STATUS_SORT_ORDER;
};

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
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [statusSortOrder, setStatusSortOrderState] = useState(
    getInitialStatusSortOrder,
  );
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

  const setStatusSortOrder = useCallback((nextOrder) => {
    if (
      !Array.isArray(nextOrder) ||
      nextOrder.length !== DEFAULT_STATUS_SORT_ORDER.length ||
      !DEFAULT_STATUS_SORT_ORDER.every((status) => nextOrder.includes(status))
    ) {
      return;
    }

    setStatusSortOrderState(nextOrder);
    window.localStorage.setItem(
      STATUS_SORT_ORDER_STORAGE_KEY,
      JSON.stringify(nextOrder),
    );
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
    // 検索と選択電気室で対象を絞り込み、表示優先順で並び替える。
    const lowerSearch = debouncedSearchTerm.trim().toLowerCase();

    const getStatus = (mccb) => {
      const borrowedCount = borrowedCountMap[mccb.id] ?? 0;
      if (mccb.isPowerOff && borrowedCount === 0) return "札返却済み";
      if (mccb.isPowerOff) return "停電中";
      if (activeMccbIds.has(mccb.id)) return "依頼発行中";
      return "送電中";
    };

    const statusRank = new Map(
      statusSortOrder.map((status, index) => [status, index]),
    );
    const roomRank = new Map(
      rooms.map((roomName, index) => [roomName, index]),
    );
    const registrationRank = new Map(
      mccbList.map((mccb, index) => [mccb.id, index]),
    );

    return processedMccbList.filter((mccb) => {
      const matchesSearch =
        !lowerSearch || mccb.name.toLowerCase().includes(lowerSearch);
      const matchesRoom =
        selectedRooms.length === 0 || selectedRooms.includes(mccb.room);

      return matchesSearch && matchesRoom;
    }).sort((a, b) => {
      const statusDifference =
        (statusRank.get(getStatus(a)) ?? Number.MAX_SAFE_INTEGER) -
        (statusRank.get(getStatus(b)) ?? Number.MAX_SAFE_INTEGER);
      if (statusDifference !== 0) return statusDifference;

      const roomDifference =
        (roomRank.get(a.room) ?? Number.MAX_SAFE_INTEGER) -
        (roomRank.get(b.room) ?? Number.MAX_SAFE_INTEGER);
      if (roomDifference !== 0) return roomDifference;

      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return (
        (registrationRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (registrationRank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
    });
  }, [
    processedMccbList,
    debouncedSearchTerm,
    selectedRooms,
    statusSortOrder,
    rooms,
    mccbList,
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
    selectedRooms,
    setSelectedRooms,
    statusSortOrder,
    setStatusSortOrder,
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
