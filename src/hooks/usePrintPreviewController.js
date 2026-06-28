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

const isDummyMccb = (mccb) =>
  mccb?.isDummy || mccb?.name?.includes('ダミー') || mccb?.id?.includes('DUMMY');

const hasBorrowedChildCard = (mccb) =>
  mccb?.childCards?.some((card) => card.isBorrowed) ?? false;

const compareMccbNameNumeric = (a, b) =>
  (a.name || '').localeCompare(b.name || '', 'ja', { numeric: true });

const getAvailableDummyCandidates = (targetMccb, mccbList) => {
  const availableDummies = mccbList.filter(
    (mccb) => isDummyMccb(mccb) && !hasBorrowedChildCard(mccb)
  );
  const sameRoom = availableDummies
    .filter((mccb) => mccb.room === targetMccb.room)
    .sort(compareMccbNameNumeric);
  const otherRooms = availableDummies
    .filter((mccb) => mccb.room !== targetMccb.room)
    .sort((a, b) => {
      if (a.name === 'ダミー0' && b.name !== 'ダミー0') return -1;
      if (a.name !== 'ダミー0' && b.name === 'ダミー0') return 1;
      return compareMccbNameNumeric(a, b);
    });

  return [...sameRoom, ...otherRooms];
};

const findExistingDummyAssignment = (targetId, requests, localReserved, mccbList) => {
  const candidates = [
    localReserved[targetId],
    ...requests.map((req) => req.reservedCards?.[targetId]).filter(Boolean),
  ].filter(Boolean);

  for (const reservedInfo of candidates) {
    if (!reservedInfo?.actualMccbId || reservedInfo.actualMccbId === targetId) {
      continue;
    }

    const assignedMccb = mccbList.find(
      (mccb) => mccb.id === reservedInfo.actualMccbId
    );
    if (!isDummyMccb(assignedMccb)) {
      continue;
    }

    const availableIdx = assignedMccb.childCards?.findIndex((card) => !card.isBorrowed) ?? -1;
    if (availableIdx !== -1) {
      return { finalTargetMccb: assignedMccb, availableIdx };
    }
  }

  return null;
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

  // ③ ダミー代替は親札単位で使用するため、子札が1枚でも使用中なら占有扱い
  return hasBorrowedChildCard(dummy);
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

        const isOriginalDummy = isDummyMccb(originalMccb);

        if (!isOriginalDummy) {
          const existingDummy = findExistingDummyAssignment(
            id,
            requests,
            localReserved,
            simulatedMccbList,
          );

          if (existingDummy) {
            finalTargetMccb = existingDummy.finalTargetMccb;
            availableIdx = existingDummy.availableIdx;
            isAllocatedFromDummy = true;
          }
        }

        // 通常設備で空き札がない場合のみダミースライド探索を実行
        if (availableIdx === -1 && !isOriginalDummy) {
          let foundDummy   = null;
          let dummyCardIdx = -1;

          for (const dummy of getAvailableDummyCandidates(originalMccb, simulatedMccbList)) {
            if (isDummyOccupiedForSim(dummy, id, requests, localReserved)) continue;
            const idx = dummy.childCards?.findIndex((c) => !c.isBorrowed) ?? -1;
            if (idx !== -1) { foundDummy = dummy; dummyCardIdx = idx; break; }
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
