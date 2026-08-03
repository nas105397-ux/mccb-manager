// API通信、定期同期、楽観的更新をまとめ、画面間で共有するMCCBデータを管理する。
// 実体はドメインごとの小さなフック（mccbData/ 以下）を合成するファサード。
import { useCallback, useEffect } from "react";
import { CORE_API_URL, VERSION_URL, BACKUPS_URL, POLL_INTERVAL } from "./mccbData/constants";
import { parseServerData } from "./mccbData/utils";
import { useSyncEngine } from "./mccbData/useSyncEngine";
import { useMccbLogs } from "./mccbData/useMccbLogs";
import { useRequestHistory } from "./mccbData/useRequestHistory";
import { useMccbCore } from "./mccbData/useMccbCore";
import { useDeviceGroups } from "./mccbData/useDeviceGroups";
import { useMccbRequests } from "./mccbData/useMccbRequests";
import { useDatabaseBackups } from "./mccbData/useDatabaseBackups";

export function useMccbData() {
  const { runSyncTask, applyVersion, getLastVersion, shouldSkipPoll } =
    useSyncEngine();

  const {
    logs,
    pagedLogs,
    logPageInfo,
    logSettings,
    setLogSettings,
    applyLogs,
    applyLogsInTransition,
    fetchLogsPageSnapshot,
    fetchLogsPage,
    clearAllLogs,
    changeMaxLogSize,
  } = useMccbLogs({ runSyncTask, applyVersion });

  const {
    requestHistory,
    pagedRequestHistory,
    historyPageInfo,
    historySettings,
    setHistorySettings,
    applyRequestHistory,
    fetchHistoryPageSnapshot,
    fetchRequestHistoryPage,
    clearRequestHistory,
    changeMaxHistorySize,
  } = useRequestHistory({ runSyncTask, applyVersion, applyLogs });

  const {
    deviceGroups,
    setDeviceGroups,
    addDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
  } = useDeviceGroups({ runSyncTask, applyVersion, applyLogs });

  const {
    mccbList,
    setMccbList,
    rooms,
    setRooms,
    categories,
    setCategories,
    categoryColors,
    setCategoryColors,
    applyChangedMccbs,
    saveMccbEntry,
    updateMccb,
    updateMccbPower,
    deleteMccb,
    importFromCSV,
    addRoom,
    updateRoom,
    deleteRoom,
    addCategory,
    updateCategory,
    deleteCategory,
    updateCategoryColor,
  } = useMccbCore({
    runSyncTask,
    applyVersion,
    applyLogs,
    applyLogsInTransition,
    setDeviceGroups,
  });

  const {
    requests,
    setRequests,
    draftRequests,
    setDraftRequests,
    addRequest,
    addDraftRequest,
    updateDraftRequest,
    issueDraftRequest,
    deleteDraftRequest,
    addTargetsToRequest,
    updateRequestTargetCard,
    deleteRequest,
  } = useMccbRequests({
    runSyncTask,
    applyVersion,
    applyLogs,
    applyChangedMccbs,
    applyRequestHistory,
  });

  // サーバー全体スナップショットを各ドメインへ反映する。
  // core同期（自動巡回）では肥大化しやすいログ/履歴を受け取らないため、既存ページ状態を維持する。
  const applyServerData = useCallback(
    (data) => {
      const parsed = parseServerData(data);
      applyVersion(parsed.version);
      setMccbList(parsed.mccbList);
      setRooms(parsed.rooms);
      setCategories(parsed.categories);
      setCategoryColors(parsed.categoryColors);
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
    [
      applyLogs,
      applyRequestHistory,
      applyVersion,
      setCategories,
      setCategoryColors,
      setDeviceGroups,
      setDraftRequests,
      setHistorySettings,
      setLogSettings,
      setMccbList,
      setRequests,
      setRooms,
    ],
  );

  const {
    databaseBackups,
    setDatabaseBackups,
    fetchDatabaseBackups,
    createDatabaseBackup,
    restoreDatabaseBackup,
  } = useDatabaseBackups({ runSyncTask, applyVersion, applyLogs, applyServerData });

  // --- 定期自動同期ポーリング設定 (useEffect) ---
  useEffect(() => {
    const fetchFullData = () =>
      fetch(CORE_API_URL)
        .then((res) => res.json())
        .then((data) => {
          applyServerData(data);
          // ログと依頼履歴はページ単位で同期し、通常巡回の payload を抑える。
          fetchLogsPageSnapshot();
          fetchHistoryPageSnapshot();
        });

    const fetchData = () => {
      if (shouldSkipPoll()) return;

      if (getLastVersion() === 0) {
        fetchFullData().catch((err) => console.error("自動同期エラー:", err));
        return;
      }

      fetch(VERSION_URL)
        .then((res) => res.json())
        .then((data) => {
          const nextVersion = Number(data.version || 0);
          // version が進んだ時だけ全体同期し、複数端末運用時の無駄な再描画を避ける。
          if (nextVersion && nextVersion !== getLastVersion()) {
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
  }, [
    applyServerData,
    fetchHistoryPageSnapshot,
    fetchLogsPageSnapshot,
    getLastVersion,
    setDatabaseBackups,
    shouldSkipPoll,
  ]);

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
    deviceGroups,
    requestHistory,
    pagedRequestHistory,
    historyPageInfo,
    historySettings,
    databaseBackups,
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
    updateDraftRequest,
    issueDraftRequest,
    deleteDraftRequest,
    addTargetsToRequest,
    updateRequestTargetCard,
    deleteRequest,
    clearRequestHistory,
    changeMaxHistorySize,
    fetchDatabaseBackups,
  };
}
