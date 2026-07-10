// 依頼発行時の子札割当ルールを API ルートから分離した純粋寄りのサービス。
// 通常MCCBの空き札を優先し、不足時だけ同室 -> 他室のダミー札へ退避する。
const DUMMY_LABEL = "ダミー";
const DUMMY_ID_FRAGMENT = "DUMMY";
const NO_AVAILABLE_CARD_LABEL = "空きなし";

const isDummyMccb = (mccb) =>
  mccb?.isDummy ||
  mccb?.name?.includes(DUMMY_LABEL) ||
  mccb?.id?.includes(DUMMY_ID_FRAGMENT);

export const hasBorrowedChildCard = (mccb) =>
  mccb?.childCards?.some((card) => card.isBorrowed) ?? false;

const findFirstFreeChildCardIndex = (mccb) =>
  mccb?.childCards?.findIndex((card) => !card.isBorrowed) ?? -1;

const compareMccbNameNumeric = (a, b) =>
  (a.name || "").localeCompare(b.name || "", "ja", { numeric: true });

const getDateCode = (date = new Date()) =>
  `${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

export const cloneMccbListForMutation = (mccbList) =>
  // 割当シミュレーションがストア由来オブジェクトを直接変更しないよう深い部分も複製する。
  mccbList.map((mccb) => ({
    ...mccb,
    childCards: Array.isArray(mccb.childCards)
      ? mccb.childCards.map((card) => ({ ...card }))
      : [],
  }));

const dedupeMccbs = (mccbList) =>
  [...new Map(mccbList.map((mccb) => [mccb.id, mccb])).values()];

export const getChangedMccbs = (beforeList, afterList) => {
  // API応答とDB保存を小さくするため、子札が変化した設備だけを抽出する。
  const beforeById = new Map(beforeList.map((mccb) => [mccb.id, mccb]));
  return afterList.filter((mccb) => {
    const before = beforeById.get(mccb.id);
    return JSON.stringify(before?.childCards || []) !== JSON.stringify(mccb.childCards || []);
  });
};

export const preservePowerStateForRequestChanges = (beforeList, changedMccbs) => {
  // 依頼処理は子札だけの責務なので、並行して変わり得る停送電状態を上書きしない。
  const beforeById = new Map(beforeList.map((mccb) => [mccb.id, mccb]));
  return changedMccbs.map((mccb) => ({
    ...mccb,
    isPowerOff: beforeById.get(mccb.id)?.isPowerOff ?? mccb.isPowerOff,
  }));
};

const createUnavailableReservation = () => ({
  actualMccbId: null,
  cardNo: null,
  displayName: NO_AVAILABLE_CARD_LABEL,
  customDummyName: null,
});

const collectActualReservations = (currentRequests) => {
  const actualReservations = new Map();
  currentRequests.forEach((request) => {
    if (!request.reservedCards) return;
    Object.entries(request.reservedCards).forEach(([, resInfo]) => {
      if (!resInfo?.actualMccbId || resInfo.cardNo == null) return;

      if (!actualReservations.has(resInfo.actualMccbId)) {
        actualReservations.set(resInfo.actualMccbId, new Map());
      }
      actualReservations
        .get(resInfo.actualMccbId)
        .set(resInfo.cardNo, request.workerName);
    });
  });
  return actualReservations;
};

// 現在発行中の依頼を先に反映し、同じ子札を二重予約しないようにする。
const applyExistingReservationsToMccbs = (mccbList, actualReservations) =>
  mccbList.map((mccb) => {
    const cardMap = actualReservations.get(mccb.id);
    const updatedCards = mccb.childCards.map((card) => {
      if (cardMap?.has(card.id)) {
        return {
          ...card,
          isBorrowed: true,
          workerName: cardMap.get(card.id) || "",
        };
      }
      return {
        ...card,
        isBorrowed: !!card.isBorrowed,
        workerName: card.workerName || "",
      };
    });
    return { ...mccb, childCards: updatedCards };
  });

const markCardAsBorrowed = (mccbList, finalMccb, availableIdx, workerName) =>
  mccbList.map((mccb) => {
    if (mccb.id !== finalMccb.id) return mccb;

    const updatedCards = [...mccb.childCards];
    updatedCards[availableIdx] = {
      ...updatedCards[availableIdx],
      isBorrowed: true,
      workerName,
    };
    return { ...mccb, childCards: updatedCards };
  });

function getAvailableDummyCandidates(targetMccb, currentMccbList) {
  const availableDummies = currentMccbList.filter(
    (mccb) => isDummyMccb(mccb) && !hasBorrowedChildCard(mccb),
  );
  // 現場で探しやすいよう、同じ電気室のダミーを優先する。
  const sameRoom = availableDummies
    .filter((mccb) => mccb.room === targetMccb.room)
    .sort(compareMccbNameNumeric);
  const otherRooms = availableDummies
    .filter((mccb) => mccb.room !== targetMccb.room)
    .sort((a, b) => {
      if (a.name === "ダミー0" && b.name !== "ダミー0") return -1;
      if (a.name !== "ダミー0" && b.name === "ダミー0") return 1;
      return compareMccbNameNumeric(a, b);
    });

  return [...sameRoom, ...otherRooms];
}

function findExistingDummyAssignment(targetId, currentRequests, currentMccbList) {
  // 同じ対象設備が既にダミーへ割り当て済みなら、そのダミーの空き札を継続利用する。
  for (const request of currentRequests) {
    const reservedInfo = request.reservedCards?.[targetId];
    if (!reservedInfo?.actualMccbId || reservedInfo.actualMccbId === targetId) {
      continue;
    }

    const assignedMccb = currentMccbList.find(
      (mccb) => mccb.id === reservedInfo.actualMccbId,
    );
    if (!isDummyMccb(assignedMccb)) {
      continue;
    }

    const availableIdx = findFirstFreeChildCardIndex(assignedMccb);
    if (availableIdx !== -1) {
      return { finalMccb: assignedMccb, availableIdx };
    }
  }

  return null;
}

function findAvailableCard(targetId, targetMccb, currentMccbList, currentRequests) {
  const isOriginalDummy = isDummyMccb(targetMccb);

  if (!isOriginalDummy) {
    const existingDummy = findExistingDummyAssignment(
      targetId,
      currentRequests,
      currentMccbList,
    );
    if (existingDummy) {
      return existingDummy;
    }
  }

  const ownCardIdx = findFirstFreeChildCardIndex(targetMccb);
  if (ownCardIdx !== -1) {
    return { finalMccb: targetMccb, availableIdx: ownCardIdx };
  }
  if (isOriginalDummy) {
    return { finalMccb: null, availableIdx: -1 };
  }

  for (const dummy of getAvailableDummyCandidates(targetMccb, currentMccbList)) {
    const idx = findFirstFreeChildCardIndex(dummy);
    if (idx !== -1) {
      return { finalMccb: dummy, availableIdx: idx };
    }
  }

  return { finalMccb: null, availableIdx: -1 };
}

export function createRequestAssignmentService({ store }) {
  function buildRequestAssignment(newRequest) {
    // 既存予約を反映した作業用コピー上で順番に札を確保し、割当結果を確定する。
    const currentRequests = store.readCollection("requests") || [];
    const targetMccbs = store.readMccbsByIds(newRequest.targetMccbIds);
    const dummyMccbs = store.readDummyMccbs();
    const beforeMccbList = dedupeMccbs([...targetMccbs, ...dummyMccbs]);
    const actualReservations = collectActualReservations(currentRequests);
    let currentMccbList = applyExistingReservationsToMccbs(
      cloneMccbListForMutation(beforeMccbList),
      actualReservations,
    );

    const reservedCards = {};
    for (const targetId of newRequest.targetMccbIds) {
      const originalMccb = currentMccbList.find((mccb) => mccb.id === targetId);
      if (!originalMccb) {
        reservedCards[targetId] = createUnavailableReservation();
        continue;
      }

      const { finalMccb, availableIdx } = findAvailableCard(
        targetId,
        originalMccb,
        currentMccbList,
        currentRequests,
      );

      if (finalMccb && availableIdx !== -1) {
        // ここで作業用コピーも貸出済みにし、同じ依頼内での二重割当を防止する。
        currentMccbList = markCardAsBorrowed(
          currentMccbList,
          finalMccb,
          availableIdx,
          newRequest.workerName,
        );

        const assignedCardNo =
          finalMccb.childCards[availableIdx]?.id ?? availableIdx + 1;

        reservedCards[targetId] = {
          actualMccbId: finalMccb.id,
          cardNo: assignedCardNo,
          displayName: finalMccb.name,
          customDummyName: newRequest.dummyNames?.[targetId] || null,
        };
      } else {
        reservedCards[targetId] = createUnavailableReservation();
      }
    }

    return {
      currentRequests,
      beforeMccbList,
      currentMccbList,
      finalRequest: { ...newRequest, reservedCards },
    };
  }

  function buildRequestTargetAddition(targetRequest, targetMccbIds, dummyNames = {}) {
    // 既存依頼への追加時は、重複選択を除外して追加分だけを割当シミュレーションする。
    const existingTargetIds = new Set(targetRequest.targetMccbIds || []);
    const additionalTargetIds = [...new Set(targetMccbIds)].filter(
      (id) => id && !existingTargetIds.has(id),
    );

    if (additionalTargetIds.length === 0) {
      return null;
    }

    const previewRequest = {
      ...targetRequest,
      targetMccbIds: additionalTargetIds,
      dummyNames,
    };
    const { beforeMccbList, currentMccbList, finalRequest } =
      buildRequestAssignment(previewRequest);

    return {
      beforeMccbList,
      currentMccbList,
      additionalTargetIds,
      updatedRequest: {
        ...targetRequest,
        targetMccbIds: [
          ...(targetRequest.targetMccbIds || []),
          ...additionalTargetIds,
        ],
        reservedCards: {
          ...(targetRequest.reservedCards || {}),
          ...(finalRequest.reservedCards || {}),
        },
        dummyNames: {
          ...(targetRequest.dummyNames || {}),
          ...dummyNames,
        },
      },
    };
  }

  function buildRequestPreviewItems(finalRequest, assignmentMccbList) {
    // 印刷・画面プレビュー用に、元設備名と実際に貸し出す札の表示名をここで確定する。
    const mccbById = new Map(assignmentMccbList.map((mccb) => [mccb.id, mccb]));
    const dateCode = getDateCode();

    return (finalRequest.targetMccbIds || [])
      .map((targetId) => {
        const originalMccb = mccbById.get(targetId);
        const reserveInfo = finalRequest.reservedCards?.[targetId];
        const actualMccb = reserveInfo?.actualMccbId
          ? mccbById.get(reserveInfo.actualMccbId)
          : null;

        if (!originalMccb && !reserveInfo) return null;

        const finalMccb = actualMccb || originalMccb;
        const isOriginalDummy = isDummyMccb(originalMccb);
        const isAllocatedFromDummy =
          !!actualMccb && !!originalMccb && actualMccb.id !== originalMccb.id;
        const cardNo = reserveInfo?.cardNo ?? 1;

        let name = originalMccb?.name || reserveInfo?.displayName || NO_AVAILABLE_CARD_LABEL;
        if (isOriginalDummy && reserveInfo?.customDummyName) {
          name = `${originalMccb.name} (${reserveInfo.customDummyName})`;
        } else if (isAllocatedFromDummy) {
          name = `${actualMccb.name} (${originalMccb.name})`;
        }

        const cardLabel = isAllocatedFromDummy
          ? `代替:${actualMccb.name} No.${cardNo}`
          : `子札 No.${cardNo}`;
        const generatedCardNo = finalMccb
          ? `${dateCode}-${finalMccb.id.slice(-4)}-${cardNo}`
          : `${dateCode}-NONE-${cardNo}`;

        return {
          ...(originalMccb || {}),
          id: targetId,
          room: originalMccb?.room || finalMccb?.room || "",
          name,
          cardLabel,
          generatedCardNo,
          isDummy: isAllocatedFromDummy || isOriginalDummy,
          allocatedDummyName: actualMccb?.name || null,
          reserveInfo,
        };
      })
      .filter(Boolean);
  }

  return {
    buildRequestAssignment,
    buildRequestTargetAddition,
    buildRequestPreviewItems,
  };
}
