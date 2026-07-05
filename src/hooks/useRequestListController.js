import { useCallback, useMemo, useState } from 'react';

export function useRequestListController({ requests = [], requestHistory = [], mccbList = [] }) {
  const [expandedRequests, setExpandedRequests] = useState({});

  const mccbMap = useMemo(() => {
    return new Map(mccbList.map((mccb) => [mccb.id, mccb]));
  }, [mccbList]);

  const toggleExpand = useCallback((id) => {
    setExpandedRequests((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const buildTargets = useCallback((req) => {
    return (req.targetMccbIds || [])
      .map((targetId) => {
        const targetMccb = mccbMap.get(targetId);
        if (!targetMccb) return null;

        const reserveInfo = req.reservedCards?.[targetId];
        const actualMccb = reserveInfo?.actualMccbId
          ? mccbMap.get(reserveInfo.actualMccbId)
          : null;
        const isOriginalDummy =
          targetMccb.isDummy || targetMccb.name?.includes("ダミー");
        const isAllocatedFromDummy =
          !!actualMccb && actualMccb.id !== targetMccb.id;

        let mccbDisplayName = targetMccb.name;
        if (isOriginalDummy && reserveInfo?.customDummyName) {
          mccbDisplayName = `${targetMccb.name} (${reserveInfo.customDummyName})`;
        } else if (isAllocatedFromDummy) {
          mccbDisplayName = `${actualMccb.name} (${targetMccb.name})`;
        }

        const reservedCard = reserveInfo?.cardNo
          ? actualMccb?.childCards?.find((card) => card.id === reserveInfo.cardNo)
          : null;

        return {
          id: targetId,
          room: targetMccb.room,
          name: mccbDisplayName,
          isPowerOff: targetMccb.isPowerOff,
          reserveInfo,
          isAllocatedFromDummy,
          isCardBorrowed: !!reservedCard?.isBorrowed,
          cardWorkerName: reservedCard?.workerName || "",
        };
      })
      .filter(Boolean);
  }, [mccbMap]);

  const activeRequestViews = useMemo(() => {
    return requests.map((req) => {
      const targets = buildTargets(req);
      const isAllPowerOff = targets.length > 0 && targets.every((target) => target.isPowerOff);

      return {
        ...req,
        targets,
        isExpanded: !!expandedRequests[req.id],
        isAllPowerOff,
      };
    });
  }, [requests, expandedRequests, buildTargets]);

  const historyRequestViews = useMemo(() => {
    return requestHistory.map((req) => ({
      ...req,
      targets: buildTargets(req),
      isExpanded: !!expandedRequests[req.id],
    }));
  }, [requestHistory, expandedRequests, buildTargets]);

  return {
    activeRequestViews,
    historyRequestViews,
    toggleExpand,
  };
}
