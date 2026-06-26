import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMccbData } from './useMccbData';

export function useAppController() {
  const {
    mccbList, rooms, categories, updateMccb, saveMccbEntry, deleteMccb,
    importFromCSV, addRoom, updateRoom, deleteRoom,
    addCategory, updateCategory, deleteCategory,
    requests, requestHistory, historySettings, addRequest, deleteRequest, clearRequestHistory, changeMaxHistorySize,
    logs, logSettings, changeMaxLogSize, clearAllLogs,
    deviceGroups, addDeviceGroup, updateDeviceGroup, deleteDeviceGroup
  } = useMccbData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('すべて');
  const [filterRoom, setFilterRoom] = useState('すべて');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMccbId, setSelectedMccbId] = useState(null);
  const [selectedMccbCache, setSelectedMccbCache] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname;

  const handleToggleAdmin = useCallback(() => {
    if (!isAdmin) {
      const password = window.prompt('管理者パスワードを入力してください：');
      if (password === 'admin') {
        setIsAdmin(true);
        alert('🔓 管理者認証に成功しました。');
      } else if (password !== null) {
        alert('❌ パスワードが正しくありません。認証に失敗しました。');
      }
      return;
    }

    setIsAdmin(false);
  }, [isAdmin]);

  const processedMccbList = useMemo(() => {
    const nameOverlayMap = new Map();

    requests.forEach((req) => {
      if (!req.reservedCards) return;

      Object.entries(req.reservedCards).forEach(([originalId, resInfo]) => {
        if (!resInfo || !resInfo.actualMccbId) return;

        if (originalId !== resInfo.actualMccbId) {
          const originalMccb = mccbList.find((m) => m.id === originalId);
          if (originalMccb) {
            nameOverlayMap.set(resInfo.actualMccbId, ` (${originalMccb.name})`);
          }
          return;
        }

        if (resInfo.customDummyName) {
          nameOverlayMap.set(resInfo.actualMccbId, ` (${resInfo.customDummyName})`);
        }
      });
    });

    return mccbList.map((mccb) => {
      const suffix = nameOverlayMap.get(mccb.id);
      return suffix ? { ...mccb, name: `${mccb.name}${suffix}` } : mccb;
    });
  }, [mccbList, requests]);

  const deferredSearch = useDeferredValue(searchTerm);

  const filteredMccbList = useMemo(() => {
    const lowerSearch = deferredSearch.toLowerCase();

    return processedMccbList.filter((mccb) => {
      const matchesSearch = mccb.name.toLowerCase().includes(lowerSearch);
      const matchesRoom = filterRoom === 'すべて' || mccb.room === filterRoom;
      const matchesStatus =
        filterStatus === 'すべて' ||
        (filterStatus === '送電中' && !mccb.isPowerOff) ||
        (filterStatus === '停電中' && mccb.isPowerOff);
      const matchesFavorite = !filterFavorite || mccb.isFavorite;

      return matchesSearch && matchesRoom && matchesStatus && matchesFavorite;
    });
  }, [processedMccbList, deferredSearch, filterRoom, filterStatus, filterFavorite]);

  const borrowedCountMap = useMemo(() => {
    const map = {};
    mccbList.forEach((m) => {
      map[m.id] = m.childCards ? m.childCards.filter((c) => c.isBorrowed).length : 0;
    });
    return map;
  }, [mccbList]);

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

  const handleSelect = useCallback((id) => {
    const selected = mccbList.find((m) => m.id === id) ?? null;
    setSelectedMccbCache(selected);
    setSelectedMccbId(id);
  }, [mccbList]);

  const handleCloseModal = useCallback(() => {
    setSelectedMccbCache(null);
    setSelectedMccbId(null);
  }, []);

  const handleToggleFavorite = useCallback((id, current) => {
    const target = mccbList.find((m) => m.id === id);
    if (!target) return;
    updateMccb({ ...target, isFavorite: !current });
  }, [mccbList, updateMccb]);

  const totalCount = mccbList.length;
  const offCount = useMemo(() => mccbList.filter((m) => m.isPowerOff).length, [mccbList]);
  const onCount = useMemo(() => mccbList.filter((m) => !m.isPowerOff).length, [mccbList]);

  const navItems = useMemo(() => ([
    { path: '/', label: '🔖 札管理ダッシュボード' },
    { path: '/request', label: '🖨️ 停電作業 依頼発行・印刷' },
    { path: '/request-list', label: `📋 依頼一覧・進捗 (${requests.length})` }
  ]), [requests.length]);

  const goTo = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  return {
    mccbList,
    rooms,
    categories,
    requests,
    requestHistory,
    historySettings,
    logs,
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
    saveMccbEntry,
    deleteMccb,
    importFromCSV,
    addRoom,
    updateRoom,
    deleteRoom,
    addCategory,
    updateCategory,
    deleteCategory,
    addRequest,
    deleteRequest,
    clearRequestHistory,
    changeMaxHistorySize,
    changeMaxLogSize,
    clearAllLogs,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup
  };
}
