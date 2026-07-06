import { useCallback, useMemo, useState } from 'react';

const DUMMY_LABEL = 'ダミー';

const isDummyMccb = (mccb) => mccb.isDummy || mccb.name?.includes(DUMMY_LABEL);

const getReservedCard = (actualMccb, reserveInfo) => {
  if (!reserveInfo?.cardNo) return null;
  return actualMccb?.childCards?.find((card) => card.id === reserveInfo.cardNo) ?? null;
};

const getDisplayName = ({ targetMccb, actualMccb, reserveInfo, isAllocatedFromDummy }) => {
  if (isDummyMccb(targetMccb) && reserveInfo?.customDummyName) {
    return `${targetMccb.name} (${reserveInfo.customDummyName})`;
  }
  if (isAllocatedFromDummy) {
    return `${actualMccb.name} (${targetMccb.name})`;
  }
  return targetMccb.name;
};

const buildRequestTargetView = (targetId, req, mccbMap) => {
  const targetMccb = mccbMap.get(targetId);
  if (!targetMccb) return null;

  const reserveInfo = req.reservedCards?.[targetId];
  const actualMccb = reserveInfo?.actualMccbId
    ? mccbMap.get(reserveInfo.actualMccbId)
    : null;
  const isAllocatedFromDummy = !!actualMccb && actualMccb.id !== targetMccb.id;
  const reservedCard = getReservedCard(actualMccb, reserveInfo);

  return {
    id: targetId,
    room: targetMccb.room,
    name: getDisplayName({
      targetMccb,
      actualMccb,
      reserveInfo,
      isAllocatedFromDummy,
    }),
    isPowerOff: targetMccb.isPowerOff,
    reserveInfo,
    isAllocatedFromDummy,
    isCardBorrowed: !!reservedCard?.isBorrowed,
    cardWorkerName: reservedCard?.workerName || '',
  };
};

export function useRequestListController({
  requests = [],
  draftRequests = [],
  requestHistory = [],
  mccbList = [],
}) {
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

  // 依頼に保存された targetMccbIds を、画面表示用の名称・札状態付きデータへ正規化する。
  const buildTargets = useCallback((req) => {
    return (req.targetMccbIds || [])
      .map((targetId) => buildRequestTargetView(targetId, req, mccbMap))
      .filter(Boolean);
  }, [mccbMap]);

  const activeRequestViews = useMemo(() => {
    return requests.map((req) => {
      const targets = buildTargets(req);
      const isAllPowerOff =
        targets.length > 0 && targets.every((target) => target.isPowerOff);

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

  const draftRequestViews = useMemo(() => {
    return draftRequests.map((req) => ({
      ...req,
      targets: buildTargets(req),
      isExpanded: !!expandedRequests[req.id],
    }));
  }, [draftRequests, expandedRequests, buildTargets]);

  return {
    activeRequestViews,
    draftRequestViews,
    historyRequestViews,
    toggleExpand,
  };
}
