// MCCB 一覧表示用の派生データを作る共有 utility。
export const countBorrowedCards = (mccb) =>
  mccb?.childCards?.reduce(
    (count, card) => count + (card.isBorrowed ? 1 : 0),
    0,
  ) || 0;

export const createBorrowedCountMap = (mccbList = []) => {
  // 一覧の各カードが同じ配列を繰り返し走査しないよう、ID単位で集計する。
  const map = {};
  mccbList.forEach((mccb) => {
    map[mccb.id] = countBorrowedCards(mccb);
  });
  return map;
};

export const createRequestNameOverlayMap = (requests = [], mccbList = []) => {
  // 依頼中だけ必要な代替設備名をマスター自体を書き換えずに保持する。
  const nameOverlayMap = new Map();
  const mccbById = new Map(mccbList.map((mccb) => [mccb.id, mccb]));

  requests.forEach((request) => {
    if (!request.reservedCards) return;

    Object.entries(request.reservedCards).forEach(([originalId, reserveInfo]) => {
      if (!reserveInfo || !reserveInfo.actualMccbId) return;

      if (originalId !== reserveInfo.actualMccbId) {
        // ダミーへ振り替えた場合は、実札側に元設備名を補足する。
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
        // ダミーを直接選択した場合は、依頼時に入力した用途名を補足する。
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
    // 補足がない要素は同じ参照を返し、React の不要な再描画を避ける。
    const suffix = nameOverlayMap.get(mccb.id);
    return suffix ? { ...mccb, name: `${mccb.name}${suffix}` } : mccb;
  });
