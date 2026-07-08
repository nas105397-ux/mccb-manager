// MCCB 一覧表示用の派生データを作る共有 utility。
export const countBorrowedCards = (mccb) =>
  mccb?.childCards?.reduce(
    (count, card) => count + (card.isBorrowed ? 1 : 0),
    0,
  ) || 0;

export const createBorrowedCountMap = (mccbList = []) => {
  const map = {};
  mccbList.forEach((mccb) => {
    map[mccb.id] = countBorrowedCards(mccb);
  });
  return map;
};

export const createRequestNameOverlayMap = (requests = [], mccbList = []) => {
  const nameOverlayMap = new Map();
  const mccbById = new Map(mccbList.map((mccb) => [mccb.id, mccb]));

  requests.forEach((request) => {
    if (!request.reservedCards) return;

    Object.entries(request.reservedCards).forEach(([originalId, reserveInfo]) => {
      if (!reserveInfo || !reserveInfo.actualMccbId) return;

      if (originalId !== reserveInfo.actualMccbId) {
        const originalMccb = mccbById.get(originalId);
        if (originalMccb) {
          nameOverlayMap.set(
            reserveInfo.actualMccbId,
            ` (${originalMccb.name})`,
          );
        }
        return;
      }

      if (reserveInfo.customDummyName) {
        nameOverlayMap.set(
          reserveInfo.actualMccbId,
          ` (${reserveInfo.customDummyName})`,
        );
      }
    });
  });

  return nameOverlayMap;
};

export const applyNameOverlaysToMccbs = (mccbList = [], nameOverlayMap) =>
  mccbList.map((mccb) => {
    const suffix = nameOverlayMap.get(mccb.id);
    return suffix ? { ...mccb, name: `${mccb.name}${suffix}` } : mccb;
  });
