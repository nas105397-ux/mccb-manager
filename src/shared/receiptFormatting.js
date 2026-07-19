// 依頼表・レシート印刷で共通して使う発行日時・子札ラベルの整形。
export const getRequestIssueDate = (request) => {
  const timestampValue = Number(String(request?.id || "").replace("REQ-", ""));
  if (Number.isFinite(timestampValue) && timestampValue > 0) {
    return new Date(timestampValue);
  }
  return new Date();
};

// 依頼番号・レシートNo.用の日付コード（例: 260719）
export const getDateCode = (date) =>
  `${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

export const getReceiptCardLabel = (target) => {
  const reserveInfo = target.reserveInfo;
  if (!reserveInfo?.cardNo) return "札の空きなし";
  return target.isAllocatedFromDummy
    ? `代替:${reserveInfo.displayName} No.${reserveInfo.cardNo}`
    : `子札 No.${reserveInfo.cardNo}`;
};
