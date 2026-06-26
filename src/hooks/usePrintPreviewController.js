import { useMemo } from 'react';

// ==========================================
// シミュレーションヘルパー関数（純粋関数）
// ==========================================

/** 過去の確定リクエスト情報から、現在のすべての札の貸出状態をマージ同期する */
const syncPastRequests = (mccbList, requests) => {
  const cloned = JSON.parse(JSON.stringify(mccbList));
  return cloned.map((mccb) => {
    const updatedCards = mccb.childCards?.map((card) => {
      let isBorrowed = card.isBorrowed;
      let workerName = card.workerName;

      requests.forEach((req) => {
        if (!req.reservedCards) return;
        Object.values(req.reservedCards).forEach((resInfo) => {
          if (resInfo?.actualMccbId === mccb.id && resInfo.cardNo === card.id) {
            isBorrowed = true;
            workerName = req.workerName;
          }
        });
      });

      return { ...card, isBorrowed, workerName };
    }) || [];

    return { ...mccb, childCards: updatedCards };
  });
};

/** 対象のダミー設備カードが、他の依頼や手動操作によって占有されているかを厳密に検証する */
const isDummyOccupiedForSim = (dummy, targetId, requests, localReserved) => {
  // ① 過去の確定リクエストからの逆引き検証
  for (const req of requests) {
    if (!req.reservedCards) continue;
    for (const [origId, resInfo] of Object.entries(req.reservedCards)) {
      if (resInfo?.actualMccbId === dummy.id && origId !== targetId) return true;
    }
  }

  // ② 今回のプレビューループ内で既に他の設備に割り当て済みか検証
  for (const [origId, resInfo] of Object.entries(localReserved)) {
    if (resInfo?.actualMccbId === dummy.id && origId !== targetId) return true;
  }

  // ③ 依頼履歴にない完全手動貸出で使用中のダミー札を検知
  return (
    dummy.childCards?.some((card) => {
      if (!card.isBorrowed) return false;
      return !requests.some(
        (req) =>
          req.reservedCards?.[targetId]?.actualMccbId === dummy.id &&
          req.reservedCards[targetId].cardNo === card.id
      );
    }) ?? false
  );
};

// ==========================================
// カスタムフック
// ==========================================

export function usePrintPreviewController({ selectedMccbIds, mccbList, requests, dummyNames }) {
  const { now, dateCode } = useMemo(() => {
    const currentDate = new Date();
    const code = `${currentDate.getFullYear().toString().slice(-2)}${(currentDate.getMonth() + 1).toString().padStart(2, '0')}${currentDate.getDate().toString().padStart(2, '0')}`;
    return { now: currentDate, dateCode: code };
  }, []);

  const selectedMccbsWithAssignedCards = useMemo(() => {
    const simulatedMccbList = syncPastRequests(mccbList, requests);
    const localReserved = {};

    return selectedMccbIds
      .map((id) => {
        const originalMccb = simulatedMccbList.find((m) => m.id === id);
        if (!originalMccb) return null;

        let availableIdx    = originalMccb.childCards?.findIndex((c) => !c.isBorrowed) ?? -1;
        let finalTargetMccb = originalMccb;
        let isAllocatedFromDummy = false;

        const isOriginalDummy = originalMccb.isDummy || originalMccb.name?.includes('ダミー');

        // 通常設備で空き札がない場合のみダミースライド探索を実行
        if (availableIdx === -1 && !isOriginalDummy) {
          const makeCandidates = (list) =>
            list.filter((m) => m.name?.includes('ダミー') || m.id?.includes('DUMMY') || m.isDummy);

          // 段階 1: 同室ダミー優先でソートして探索
          const samePrioritized = makeCandidates(simulatedMccbList).sort((a, b) => {
            const aSame = a.room === originalMccb.room ? 1 : 0;
            const bSame = b.room === originalMccb.room ? 1 : 0;
            if (aSame !== bSame) return bSame - aSame;
            return (a.name || '').localeCompare(b.name || '', 'ja');
          });

          let foundDummy   = null;
          let dummyCardIdx = -1;

          for (const dummy of samePrioritized) {
            if (isDummyOccupiedForSim(dummy, id, requests, localReserved)) continue;
            const idx = dummy.childCards?.findIndex((c) => !c.isBorrowed) ?? -1;
            if (idx !== -1) { foundDummy = dummy; dummyCardIdx = idx; break; }
          }

          // 段階 2: 全エリア・ダミー0最優先のフォールバック
          if (!foundDummy) {
            const allSorted = makeCandidates(simulatedMccbList).sort((a, b) => {
              if (a.name === 'ダミー0' && b.name !== 'ダミー0') return -1;
              if (a.name !== 'ダミー0' && b.name === 'ダミー0') return 1;
              return (a.name || '').localeCompare(b.name || '', 'ja');
            });

            for (const dummy of allSorted) {
              if (isDummyOccupiedForSim(dummy, id, requests, localReserved)) continue;
              const idx = dummy.childCards?.findIndex((c) => !c.isBorrowed) ?? -1;
              if (idx !== -1) { foundDummy = dummy; dummyCardIdx = idx; break; }
            }
          }

          if (foundDummy) {
            finalTargetMccb  = foundDummy;
            availableIdx     = dummyCardIdx;
            isAllocatedFromDummy = true;
          }
        }

        // シミュレーション上の仮確保を確定ロック
        let finalCardNo = 1;
        if (availableIdx !== -1 && finalTargetMccb.childCards) {
          finalTargetMccb.childCards[availableIdx].isBorrowed = true;
          finalCardNo = finalTargetMccb.childCards[availableIdx].id;
          localReserved[id] = { actualMccbId: finalTargetMccb.id, cardNo: finalCardNo };
        }

        // 名称の結合処理
        let finalName = originalMccb.name;
        if (isOriginalDummy) {
          if (dummyNames[id]) finalName = `${originalMccb.name} (${dummyNames[id]})`;
        } else if (isAllocatedFromDummy) {
          finalName = `${finalTargetMccb.name} (${originalMccb.name})`;
        }

        const cardLabel = isAllocatedFromDummy
          ? `代替:${finalTargetMccb.name} No.${finalCardNo}`
          : `子札 No.${finalCardNo}`;

        const generatedCardNo = `${dateCode}-${finalTargetMccb.id.slice(-4)}-${finalCardNo}`;

        return {
          ...originalMccb,
          name: finalName,
          cardLabel,
          generatedCardNo,
          isDummy: isAllocatedFromDummy || isOriginalDummy,
          allocatedDummyName: finalTargetMccb.name,
        };
      })
      .filter(Boolean);
  }, [selectedMccbIds, mccbList, requests, dateCode, dummyNames]);

  return { now, dateCode, selectedMccbsWithAssignedCards };
}
