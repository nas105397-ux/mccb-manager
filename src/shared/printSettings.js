// 印刷方式とプリンター接続設定の localStorage キーをまとめる。
export const REQUEST_PRINT_MODE_STORAGE_KEY = "mccb-manager.requestPrintMode";
export const STAR_PRINTER_CONNECTION_STORAGE_KEY =
  "mccb-manager.starPrinterConnection";

export const REQUEST_PRINT_MODES = {
  STAR_RECEIPT: "starReceipt",
  BROWSER: "browser",
  NONE: "none",
};

export const REQUEST_PRINT_MODE_OPTIONS = [
  {
    value: REQUEST_PRINT_MODES.STAR_RECEIPT,
    label: "スター精密レシート印刷",
    description: "mC-Print3 / MCP31L に StarXpand SDK for Web で依頼表を印刷します。",
  },
  {
    value: REQUEST_PRINT_MODES.BROWSER,
    label: "ブラウザ印刷",
    description: "従来のブラウザ印刷ダイアログで依頼表を印刷します。",
  },
  {
    value: REQUEST_PRINT_MODES.NONE,
    label: "印刷なし",
    description: "依頼の登録のみ行い、依頼表は自動印刷しません。",
  },
];

export const DEFAULT_REQUEST_PRINT_MODE = REQUEST_PRINT_MODES.STAR_RECEIPT;

export const normalizeRequestPrintMode = (mode) => {
  if (Object.values(REQUEST_PRINT_MODES).includes(mode)) {
    return mode;
  }
  return DEFAULT_REQUEST_PRINT_MODE;
};
