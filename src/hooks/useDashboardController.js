// 電気室モニター画面の定期同期、表示設定、停電中設備の集計を管理する。
import { useEffect, useMemo, useRef, useState } from "react";
import {
  countBorrowedCards,
  createRequestNameOverlayMap,
} from "../shared/mccbViewUtils";

const API_URL = "/api/mccb";
const CORE_API_URL = `${API_URL}?core=1`;
const VERSION_URL = `${API_URL}/version`;
const ACTIVITY_LOG_LIMIT = 20;
const STORAGE_KEYS = {
  DARK_MODE: "dashboard_is_dark_mode",
  COL_LAYOUT: "dashboard_col_layout",
};
const LOGS_PAGE_URL = `/api/logs?page=1&pageSize=${ACTIVITY_LOG_LIMIT}`;
export const POLL_INTERVAL = 15000;
const INITIAL_DATA = { mccbList: [], logs: [], requests: [], categoryColors: {} };

const getInitialDarkMode = () => {
  const savedMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
  return savedMode !== null ? savedMode === "true" : true;
};

const getInitialColLayout = () => localStorage.getItem(STORAGE_KEYS.COL_LAYOUT) || "auto";

export function useDashboardController() {
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);
  const [colLayout, setColLayout] = useState(getInitialColLayout);
  const lastVersion = useRef(0);

  // モニター画面は常時表示されるため、表示設定を端末ごとに保存する。
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COL_LAYOUT, colLayout);
  }, [colLayout]);

  useEffect(() => {
    let disposed = false;

    // version が変わった時だけ本体データを取り直し、通常時の通信量を抑える。
    const fetchFullData = async () => {
      try {
        const [coreRes, logsRes] = await Promise.all([
          fetch(CORE_API_URL),
          fetch(LOGS_PAGE_URL),
        ]);
        const latest = await coreRes.json();
        const logsPage = await logsRes.json();
        if (disposed || !latest) return;

        lastVersion.current = Number(latest.version || lastVersion.current);
        setData({
          mccbList: latest.mccbList || [],
          logs: logsPage.items || [],
          requests: latest.requests || [],
          categoryColors: latest.categoryColors || {},
        });
      } catch (err) {
        if (!disposed) {
          console.error("監視データ同期エラー:", err);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    const fetchData = async () => {
      if (lastVersion.current === 0) {
        await fetchFullData();
        return;
      }

      try {
        const res = await fetch(VERSION_URL);
        const latest = await res.json();
        if (disposed || !latest) return;

        const nextVersion = Number(latest.version || 0);
        if (nextVersion && nextVersion !== lastVersion.current) {
          await fetchFullData();
        }
      } catch (err) {
        if (!disposed) {
          console.error("監視データ同期エラー:", err);
        }
      }
    };

    fetchFullData();
    const timer = setInterval(fetchData, POLL_INTERVAL);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  // 停電中MCCBと統計値は同じ走査で作成し、監視画面の再計算を最小限にする。
  const { processedOffMccbs, stats } = useMemo(() => {
    const nameOverlayMap = createRequestNameOverlayMap(
      data.requests,
      data.mccbList,
    );

    let onCount = 0;
    let totalBorrowedCards = 0;
    const offMccbs = [];

    data.mccbList.forEach((mccb) => {
      const borrowedCount = countBorrowedCards(mccb);
      totalBorrowedCards += borrowedCount;

      if (mccb.isPowerOff) {
        const suffix = nameOverlayMap.get(mccb.id);
        offMccbs.push(suffix ? { ...mccb, name: `${mccb.name}${suffix}` } : mccb);
      } else {
        onCount++;
      }
    });

    return {
      processedOffMccbs: offMccbs,
      stats: {
        totalCount: data.mccbList.length,
        onCount,
        offCount: offMccbs.length,
        totalBorrowedCards,
      },
    };
  }, [data.mccbList, data.requests]);

  const recentLogs = useMemo(
    () => (Array.isArray(data.logs) ? data.logs.slice(0, ACTIVITY_LOG_LIMIT) : []),
    [data.logs],
  );

  return {
    data,
    loading,
    isDarkMode,
    setIsDarkMode,
    colLayout,
    setColLayout,
    processedOffMccbs,
    stats,
    recentLogs,
    categoryColors: data.categoryColors,
  };
}
