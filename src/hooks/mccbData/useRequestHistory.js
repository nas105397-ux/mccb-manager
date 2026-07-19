// 停電作業依頼の完了・解約履歴（全件・ページ表示）の状態と操作。
import { useCallback, useState } from "react";
import { DEFAULT_MAX_SIZE } from "../../shared/appConstants";
import { HISTORY_PAGE_URL, HISTORY_PAGE_SIZE } from "./constants";
import { createPageInfo, getPageSlice } from "./utils";

export function useRequestHistory({ runSyncTask, applyVersion, applyLogs }) {
  const [requestHistory, setRequestHistory] = useState([]);
  const [pagedRequestHistory, setPagedRequestHistory] = useState([]);
  const [historyPageInfo, setHistoryPageInfo] = useState(() =>
    createPageInfo(1, HISTORY_PAGE_SIZE),
  );
  const [historySettings, setHistorySettings] = useState({
    maxSize: DEFAULT_MAX_SIZE,
  });

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

  const applyHistoryPageSnapshot = useCallback((result) => {
    setPagedRequestHistory(result.items || []);
    setHistoryPageInfo(
      createPageInfo(
        result.page || 1,
        result.pageSize || HISTORY_PAGE_SIZE,
        result.total || 0,
      ),
    );
  }, []);

  // 依頼履歴は自動巡回でもページ単位で同期し、通常巡回の payload を抑える。
  const fetchHistoryPageSnapshot = useCallback(() => {
    return fetch(`${HISTORY_PAGE_URL}?page=1&pageSize=${HISTORY_PAGE_SIZE}`)
      .then((res) => res.json())
      .then(applyHistoryPageSnapshot)
      .catch((err) => console.error("依頼履歴ページ同期エラー:", err));
  }, [applyHistoryPageSnapshot]);

  const fetchRequestHistoryPage = useCallback(
    async (page = 1) => {
      const res = await fetch(
        `${HISTORY_PAGE_URL}?page=${encodeURIComponent(page)}&pageSize=${HISTORY_PAGE_SIZE}`,
      );
      if (!res.ok)
        throw new Error(`依頼履歴取得に失敗しました (${res.status})`);
      const result = await res.json();
      applyHistoryPageSnapshot(result);
    },
    [applyHistoryPageSnapshot],
  );

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
        if (!res.ok)
          throw new Error(`依頼履歴クリアに失敗しました (${res.status})`);
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
        if (!res.ok)
          throw new Error(`依頼履歴保持件数変更に失敗しました (${res.status})`);
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

  return {
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
  };
}
