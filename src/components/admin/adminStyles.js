// 管理画面の各セクションで共有する UI スタイル定数とフォーマッタ。
export const UI_STYLES = {
  // ボタン
  btnPrimary:
    "bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-sm shadow-sm transition-all whitespace-nowrap cursor-pointer",
  btnSecondary:
    "bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer shrink-0",
  btnCsvAction:
    "bg-gray-600 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer",
  btnClearAction:
    "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap",
  btnDangerSmall:
    "text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded font-bold cursor-pointer",
  btnTextSmall:
    "text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded font-bold cursor-pointer",
  // 実行不可（ブロック状態）と処理中（待機状態）で disabled の見た目を使い分ける
  btnDisabledBlocked: "disabled:opacity-50 disabled:cursor-not-allowed",
  btnDisabledBusy: "disabled:opacity-60 disabled:cursor-wait",

  // 入力フォーム
  input:
    "border p-2 rounded text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-blue-400",
  inputSmall:
    "border p-1.5 rounded text-xs flex-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400",
  select:
    "border p-2 rounded text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-blue-400",
  selectMaxSize:
    "bg-transparent text-gray-700 font-black focus:outline-none cursor-pointer",

  // セクション
  sectionContainer: "pt-5 border-t border-gray-150",
  sectionTitle:
    "text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 border-b pb-1.5",
  subsectionContainer:
    "bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3",

  // リスト
  listContainer:
    "max-h-40 overflow-y-auto border border-gray-200 bg-white rounded-lg p-2 space-y-2",
  listContainerTall:
    "max-h-56 overflow-y-auto border border-gray-200 bg-white rounded-lg p-2 space-y-2",
  listItem:
    "flex items-center justify-between text-xs p-1.5 bg-gray-50 rounded border border-gray-100 mb-px",
  listItemText: "font-semibold text-gray-800",

  // ラベル
  label: "block text-xs text-gray-500 mb-1",
  labelSubsection: "text-xs font-bold text-gray-600",

  // フォーム行
  formRow: "flex gap-1.5",
};

export const getLogBadgeClass = (type) => {
  switch (type) {
    case "操作":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "札貸出":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "マスタ登録":
      return "bg-green-100 text-green-800 border border-green-200";
    case "マスタ編集":
      return "bg-purple-100 text-purple-800 border border-purple-200";
    case "マスタ削除":
      return "bg-red-100 text-red-800 border border-red-200";
    case "システム":
      return "bg-gray-100 text-gray-700 border border-gray-300";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
};

export const formatBackupDate = (createdAt) => {
  if (!createdAt) return "日時不明";
  return new Date(createdAt).toLocaleString("ja-JP");
};

export const formatBackupSize = (size) => {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
