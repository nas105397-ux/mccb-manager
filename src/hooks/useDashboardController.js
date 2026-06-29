import { useEffect, useMemo, useRef, useState } from 'react';
import {
  countBorrowedCards,
  createRequestNameOverlayMap,
} from '../shared/mccbViewUtils';

const API_URL = '/api/mccb';
const CORE_API_URL = `${API_URL}?core=1`;
const VERSION_URL = `${API_URL}/version`;
const LOGS_PAGE_URL = '/api/logs?page=1&pageSize=40';
export const POLL_INTERVAL = 15000;
const INITIAL_DATA = { mccbList: [], logs: [], requests: [] };

const getInitialDarkMode = () => {
  const savedMode = localStorage.getItem('dashboard_is_dark_mode');
  return savedMode !== null ? savedMode === 'true' : true;
};

const getInitialColLayout = () => localStorage.getItem('dashboard_col_layout') || 'auto';

export function useDashboardController() {
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);
  const [colLayout, setColLayout] = useState(getInitialColLayout);
  const lastVersion = useRef(0);

  useEffect(() => {
    localStorage.setItem('dashboard_is_dark_mode', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('dashboard_col_layout', colLayout);
  }, [colLayout]);

  useEffect(() => {
    let disposed = false;

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
        });
      } catch (err) {
        if (!disposed) {
          console.error('監視データ同期エラー:', err);
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
          console.error('監視データ同期エラー:', err);
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

  const recentLogs = useMemo(() => (Array.isArray(data.logs) ? data.logs.slice(0, 40) : []), [data.logs]);

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
  };
}
