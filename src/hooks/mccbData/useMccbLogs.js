// システムログ（全件・ページ表示）の状態と操作。
import { startTransition, useCallback, useState } from "react";
import { DEFAULT_MAX_SIZE } from "../../shared/appConstants";
import { LOGS_PAGE_URL, LOG_PAGE_SIZE } from "./constants";
import { createPageInfo, getPageSlice } from "./utils";

export function useMccbLogs({ runSyncTask, applyVersion }) {
  const [logs, setLogs] = useState([]);
  const [pagedLogs, setPagedLogs] = useState([]);
  const [logPageInfo, setLogPageInfo] = useState(() =>
    createPageInfo(1, LOG_PAGE_SIZE),
  );
  const [logSettings, setLogSettings] = useState({ maxSize: DEFAULT_MAX_SIZE });

  const applyLogs = useCallback((nextLogs) => {
    const safeLogs = Array.isArray(nextLogs) ? nextLogs : [];
    setLogs(safeLogs);
    const nextPageInfo = createPageInfo(1, LOG_PAGE_SIZE, safeLogs.length);
    setLogPageInfo(nextPageInfo);
    setPagedLogs(getPageSlice(safeLogs, nextPageInfo));
  }, []);

  // ログ更新は再描画コストが高いため、即時操作の描画を妨げないよう transition 化する。
  const applyLogsInTransition = useCallback(
    (nextLogs) => {
      startTransition(() => applyLogs(nextLogs));
    },
    [applyLogs],
  );

  const applyLogsPageSnapshot = useCallback((result) => {
    setPagedLogs(Array.isArray(result.items) ? result.items : []);
    setLogPageInfo(
      createPageInfo(
        result.page || 1,
        result.pageSize || LOG_PAGE_SIZE,
        result.total || 0,
      ),
    );
  }, []);

  // ログは自動巡回でもページ単位で同期し、通常巡回の payload を抑える。
  const fetchLogsPageSnapshot = useCallback(() => {
    return fetch(`${LOGS_PAGE_URL}?page=1&pageSize=${LOG_PAGE_SIZE}`)
      .then((res) => res.json())
      .then(applyLogsPageSnapshot)
      .catch((err) => console.error("ログページ同期エラー:", err));
  }, [applyLogsPageSnapshot]);

  const fetchLogsPage = useCallback(
    async (page = 1) => {
      const res = await fetch(
        `${LOGS_PAGE_URL}?page=${encodeURIComponent(page)}&pageSize=${LOG_PAGE_SIZE}`,
      );
      if (!res.ok) throw new Error(`ログページ取得に失敗しました (${res.status})`);
      const result = await res.json();
      applyLogsPageSnapshot(result);
    },
    [applyLogsPageSnapshot],
  );

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
        if (!res.ok)
          throw new Error(`ログ保持件数変更に失敗しました (${res.status})`);
        const result = await res.json();
        if (Array.isArray(result.logs)) applyLogs(result.logs);
        if (result.logSettings) setLogSettings(result.logSettings);
        applyVersion(result.version);
      });
    },
    [applyLogs, applyVersion, runSyncTask],
  );

  return {
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
  };
}
