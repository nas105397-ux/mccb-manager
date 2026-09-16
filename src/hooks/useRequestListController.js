// 依頼一覧の展開状態と、対象設備ごとの表示名・札状態の組み立てを担当する。
import { useCallback, useMemo, useState } from "react";
import { isDummyMccb } from "../shared/mccbViewUtils";

const getReservedCard = (actualMccb, reserveInfo) => {
  if (!reserveInfo?.cardNo) return null;
  return actualMccb?.childCards?.find((card) => card.id === reserveInfo.cardNo) ?? null;
};

const getDisplayName = ({ targetMccb, actualMccb, cardInfo, isAllocatedFromDummy }) => {
  if (isDummyMccb(targetMccb) && cardInfo?.customDummyName) {
    return `${targetMccb.name} (${cardInfo.customDummyName})`;
  }
  if (isAllocatedFromDummy) {
    return `${actualMccb.name} (${targetMccb.name})`;
  }
  return targetMccb.name;
};

const buildRequestTargetView = (targetId, req, mccbMap) => {
  const targetMccb = mccbMap.get(targetId);
  if (!targetMccb) return null;

  const returnedInfo = req.returnedCards?.[targetId];
  const reserveInfo = req.reservedCards?.[targetId];
  // 一部返却済みでも、どの札で作業していたかを表示名に残すため返却情報を引き継ぐ。
  const cardInfo = reserveInfo || returnedInfo || null;
  const actualMccb = cardInfo?.actualMccbId
    ? mccbMap.get(cardInfo.actualMccbId)
    : null;
  const isAllocatedFromDummy = !!actualMccb && actualMccb.id !== targetMccb.id;
  const reservedCard = getReservedCard(actualMccb, reserveInfo);

  return {
    id: targetId,
    room: targetMccb.room,
    name: getDisplayName({
      targetMccb,
      actualMccb,
      cardInfo,
      isAllocatedFromDummy,
    }),
    isPowerOff: targetMccb.isPowerOff,
    reserveInfo,
    returnedInfo,
    isReturned: !!returnedInfo,
    isAllocatedFromDummy,
    isCardBorrowed: !!reservedCard?.isBorrowed,
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
      // 返却済みの設備は依頼の作業対象から外れているため、停電完了の判定に含めない。
      const activeTargets = targets.filter((target) => !target.isReturned);
      const isAllPowerOff =
        activeTargets.length > 0 &&
        activeTargets.every((target) => target.isPowerOff);

      return {
        ...req,
        targets,
        activeTargets,
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
