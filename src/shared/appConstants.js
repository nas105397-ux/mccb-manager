export const DEFAULT_ROOMS = [
  "1階高圧電気室",
  "1階電気室",
  "2階電気室",
  "2次トーチ電気室",
  "LT-UT電気室",
  "水処理電気室",
];

export const DEFAULT_CATEGORIES = [
  "1スト",
  "2スト",
  "3スト",
  "4スト",
  "5スト",
  "6スト",
  "共通",
];

export const DEFAULT_MAX_SIZE = 500;
export const DEFAULT_CHILD_CARD_COUNT = 5;

export const LOG_TYPES = Object.freeze({
  OPERATION: "操作",
  CARD_LOAN: "札貸出",
  MASTER_CREATE: "マスタ登録",
  MASTER_UPDATE: "マスタ編集",
  MASTER_DELETE: "マスタ削除",
  SYSTEM: "システム",
});

const LOG_TYPE_VALUES = new Set(Object.values(LOG_TYPES));

export const normalizeLogType = (type) => {
  return LOG_TYPE_VALUES.has(type) ? type : LOG_TYPES.SYSTEM;
};

export const normalizeLogs = (logs) => {
  if (!Array.isArray(logs)) return [];
  return logs.map((log) => ({
    ...log,
    type: normalizeLogType(log.type),
  }));
};
