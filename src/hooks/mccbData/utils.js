// useMccbData 系フックが共有する純粋関数群（状態やAPI通信を持たない）。
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MAX_SIZE,
  DEFAULT_ROOMS,
} from "../../shared/appConstants";
import { normalizeCategoryColors } from "../../shared/categoryColorUtils";

export const createPageInfo = (page = 1, pageSize = 50, total = 0) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

export const getPageSlice = (items, pageInfo) => {
  const safeItems = Array.isArray(items) ? items : [];
  const start = (pageInfo.page - 1) * pageInfo.pageSize;
  return safeItems.slice(start, start + pageInfo.pageSize);
};

const mergeChildCardChanges = (currentMccb, changedMccb) => ({
  ...currentMccb,
  childCards: changedMccb.childCards || currentMccb.childCards,
});

/**
 * 停電作業依頼APIは、札の貸出状態が変わったMCCBだけを返す。
 * 一覧の表示名やお気に入り等のローカル表示情報は維持し、子札状態だけを差し替える。
 */
export const mergeChangedMccbsByChildCards = (currentList, changedMccbs = []) => {
  const changedById = new Map(changedMccbs.map((mccb) => [mccb.id, mccb]));
  return currentList.map((mccb) => {
    const changedMccb = changedById.get(mccb.id);
    return changedMccb ? mergeChildCardChanges(mccb, changedMccb) : mccb;
  });
};

/** サーバー受信データのパース・デフォルト値マージ */
export const parseServerData = (data) => {
  const source = data && typeof data === "object" ? data : {};
  const isArrayPayload = Array.isArray(data);

  return {
    mccbList: source.mccbList || (isArrayPayload ? data : []),
    rooms: source.rooms || DEFAULT_ROOMS,
    categories: source.categories || DEFAULT_CATEGORIES,
    categoryColors: normalizeCategoryColors(
      source.categories || DEFAULT_CATEGORIES,
      source.categoryColors || {},
    ),
    logs: Array.isArray(source.logs) ? source.logs : [],
    logSettings: source.logSettings || { maxSize: DEFAULT_MAX_SIZE },
    requests: source.requests || [],
    draftRequests: source.draftRequests || [],
    deviceGroups: source.deviceGroups || [],
    requestHistory: source.requestHistory || [],
    historySettings: source.historySettings || { maxSize: DEFAULT_MAX_SIZE },
    version: Number(source.version || 0),
  };
};
