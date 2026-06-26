import { useEffect, useMemo, useState } from 'react';

const API_URL = '/api/mccb';
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

  useEffect(() => {
    localStorage.setItem('dashboard_is_dark_mode', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('dashboard_col_layout', colLayout);
  }, [colLayout]);

  useEffect(() => {
    let disposed = false;

    const fetchData = async () => {
      try {
        const res = await fetch(API_URL);
        const latest = await res.json();
        if (disposed || !latest) return;

        setData({
          mccbList: latest.mccbList || [],
          logs: latest.logs || [],
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

    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  const { processedOffMccbs, stats } = useMemo(() => {
    const nameOverlayMap = new Map();
    const mccbById = new Map(data.mccbList.map((m) => [m.id, m]));

    if (Array.isArray(data.requests)) {
      data.requests.forEach((req) => {
        if (!req.reservedCards) return;

        Object.entries(req.reservedCards).forEach(([originalId, resInfo]) => {
          if (!resInfo || !resInfo.actualMccbId) return;

          if (originalId !== resInfo.actualMccbId) {
            const originalMccb = mccbById.get(originalId);
            if (originalMccb) {
              nameOverlayMap.set(resInfo.actualMccbId, ` (${originalMccb.name})`);
            }
          } else if (resInfo.customDummyName) {
            nameOverlayMap.set(resInfo.actualMccbId, ` (${resInfo.customDummyName})`);
          }
        });
      });
    }

    let onCount = 0;
    let totalBorrowedCards = 0;
    const offMccbs = [];

    data.mccbList.forEach((mccb) => {
      const borrowedCount = mccb.childCards?.reduce((count, card) => count + (card.isBorrowed ? 1 : 0), 0) || 0;
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
