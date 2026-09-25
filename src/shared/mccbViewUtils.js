// MCCB 一覧表示用の派生データを作る共有 utility。
export const REQUEST_ID_PREFIX = "REQ-";
const DUMMY_LABEL = "ダミー";

export const isDummyMccb = (mccb) =>
  mccb?.isDummy || mccb?.name?.includes(DUMMY_LABEL);

export const matchesMccbSearch = (mccb, query) =>
  mccb.name?.toLowerCase().includes(query) ||
  mccb.room?.toLowerCase().includes(query);

export const formatWorkerName = (workerName) => workerName || "未入力";
export const formatWorkContent = (workContent) =>
  workContent || "作業内容未入力";

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

// ダミーを直接指定した依頼は入力された用途名が実体を表すので、補足表示はそれを優先する。
export const resolveRequestSourceName = (originalMccb, cardInfo) =>
  (isDummyMccb(originalMccb) && cardInfo?.customDummyName) ||
  originalMccb?.name ||
  "";

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
        const sourceName = resolveRequestSourceName(
          mccbById.get(originalId),
          reserveInfo,
        );
        if (sourceName) {
          nameOverlayMap.set(reserveInfo.actualMccbId, ` (${sourceName})`);
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

// 発行中の依頼がどのダミー札をどの設備に掛けているかを集計する（依頼発行画面の注記用）。
export const createActiveDummyUsageMap = (requests = [], mccbList = []) => {
  const mccbById = new Map(mccbList.map((mccb) => [mccb.id, mccb]));
  const deviceNamesByDummy = new Map();
  const sharableNameByDummy = new Map();

  requests.forEach((request) => {
    Object.entries(request.reservedCards || {}).forEach(([targetId, reserveInfo]) => {
      const dummyId = reserveInfo?.actualMccbId;
      if (!dummyId || !isDummyMccb(mccbById.get(dummyId))) return;

      const originalMccb = mccbById.get(targetId);
      // 元がダミーなら直接指定。別ダミーへ振り替えられていても実設備は入力された代替名。
      const isDirectSelection = isDummyMccb(originalMccb);
      const deviceName = isDirectSelection
        ? reserveInfo.customDummyName || ""
        : originalMccb?.name || "";

      // 代替名が未入力でも札は使用中なので、設備名なしで登録して注記自体は残す。
      const deviceNames = deviceNamesByDummy.get(dummyId) || [];
      if (deviceName && !deviceNames.includes(deviceName)) {
        deviceNames.push(deviceName);
      }
      deviceNamesByDummy.set(dummyId, deviceNames);
      // 代替名を手入力した依頼だけは、同じ名称を引き継げば同じ親札の子札を確保できる。
      if (isDirectSelection && deviceName && !sharableNameByDummy.has(dummyId)) {
        sharableNameByDummy.set(dummyId, deviceName);
      }
    });
  });

  return new Map(
    [...deviceNamesByDummy].map(([dummyId, deviceNames]) => [
      dummyId,
      {
        label: deviceNames.join("、") || "名称未入力",
        sharableName: sharableNameByDummy.get(dummyId) || "",
      },
    ]),
  );
};

export const applyNameOverlaysToMccbs = (mccbList = [], nameOverlayMap) =>
  mccbList.map((mccb) => {
    // 補足がない要素は同じ参照を返し、React の不要な再描画を避ける。
    const suffix = nameOverlayMap.get(mccb.id);
    return suffix ? { ...mccb, name: `${mccb.name}${suffix}` } : mccb;
  });
