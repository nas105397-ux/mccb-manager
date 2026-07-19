// RequestListPanel とその各セクションで共有する UI スタイル定数。
export const UI = {
  panel:
    "bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[60vh]",
  tabWrap:
    "mb-5 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 shadow-inner",
  tabButton:
    "px-4 py-2 rounded-md text-xs font-black transition-all cursor-pointer",
  tabActive: "bg-white text-blue-700 shadow-sm border border-gray-200",
  tabIdle: "text-gray-500 hover:text-gray-700",
  empty:
    "text-center py-16 text-gray-400 bg-gray-50 rounded-xl border border-dashed",
  sectionTitle:
    "text-base font-black text-gray-700 mb-4 flex items-center gap-2",
  sectionDivider: "mt-12 pt-6 border-t border-gray-300",
  countBadge:
    "text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border font-bold",
};

export const ACTIVE = {
  card: "border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-all",
  header:
    "flex flex-wrap justify-between items-start mb-3 border-b border-gray-200 pb-3 gap-2",
  summary: "min-w-0 flex-1",
  metaRow: "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold",
  timestamp: "text-gray-400",
  requestNo: "text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded",
  workerMeta: "text-gray-500",
  heading:
    "text-lg font-black text-blue-800 mt-1 flex items-start gap-2 text-left leading-snug min-w-0",
  headingText: "min-w-0 break-words",
  workerSuffix: "text-xs font-bold text-gray-500",
  content: "text-xs text-gray-500 mt-1 font-bold",
  actionButtonBase:
    "inline-flex min-h-9 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-black shadow-sm transition-all cursor-pointer whitespace-nowrap",
  addButton:
    "bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200",
  printButton:
    "bg-white hover:bg-blue-50 text-blue-700 border-blue-200",
  deleteButton:
    "bg-white hover:bg-red-50 text-red-700 border-red-200",
  addPanel:
    "mb-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2",
  addSearch:
    "w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500",
  addList:
    "max-h-48 overflow-y-auto rounded-lg border border-emerald-100 bg-white p-2 space-y-1.5",
  addItem:
    "flex items-center gap-2 rounded border border-gray-100 bg-gray-50 p-2 text-xs font-bold text-gray-700 cursor-pointer hover:bg-white",
  addSubmit:
    "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer whitespace-nowrap",
  addCancel:
    "bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap",
  foldRow:
    "flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer hover:text-gray-700 w-fit select-none",
  foldHint: "text-[10px] font-normal text-gray-400 opacity-80",
  targetGrid: "grid grid-cols-1 gap-2 transition-all duration-200",
  targetCard:
    "flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 text-xs font-bold shadow-sm",
  roomTag: "bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded border",
  targetName: "text-gray-800 truncate",
  reserveBadge:
    "bg-amber-100 text-amber-800 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-black shadow-sm ml-1",
  returnedBadge:
    "bg-sky-100 text-sky-800 border border-sky-200 text-[10px] px-1.5 py-0.5 rounded font-black shadow-sm ml-1",
  cardActionButton:
    "rounded border border-gray-200 bg-white px-2 py-1 font-black text-gray-600 shadow-sm hover:bg-gray-50 cursor-pointer whitespace-nowrap",
  noReserveBadge:
    "bg-gray-100 text-gray-400 border border-gray-200 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1",
  doneStatus:
    "bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-black border border-red-200 shadow-sm shrink-0",
  pendingStatus:
    "bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-black border border-green-200 shadow-sm animate-pulse shrink-0",
  completionStamp:
    "bg-red-600 text-white px-2 py-0.5 text-[11px] rounded-full font-black tracking-wider shadow-sm shrink-0 animate-pulse",
};

export const HISTORY = {
  empty:
    "text-center py-10 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed text-xs",
  list: "space-y-3 pr-1",
  card: "border border-gray-200 rounded-lg p-3.5 bg-white shadow-sm hover:border-gray-300 transition-colors",
  header:
    "flex flex-wrap justify-between items-start border-b border-gray-100 pb-2 mb-2 gap-2",
  summary: "min-w-0 flex-1",
  stampRow:
    "flex flex-wrap items-center gap-x-2 text-[10px] text-gray-400 font-bold",
  issueStamp: "bg-gray-100 px-1.5 py-0.5 rounded border",
  requestNoStamp:
    "text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100",
  workerStamp: "text-gray-500",
  doneStamp:
    "text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100",
  heading: "text-base font-black text-gray-700 mt-1.5 text-left leading-snug",
  workerSuffix: "text-xs font-bold text-gray-500",
  content: "text-xs text-gray-400 mt-0.5 font-bold",
  status:
    "bg-gray-50 border border-gray-200 text-gray-400 text-[10px] font-black tracking-wide px-2 py-1 rounded shadow-inner",
  foldRow:
    "flex items-center gap-1 text-[11px] font-bold text-gray-400 cursor-pointer hover:text-gray-600 w-fit select-none",
  targetGrid: "grid grid-cols-1 gap-1.5 mt-1.5 transition-all",
  targetCard:
    "flex items-center justify-between bg-gray-50/50 px-2 py-1.5 rounded border border-gray-150 text-[11px] font-bold",
  roomTag: "bg-white text-gray-400 text-[9px] px-1 rounded border",
  targetName: "text-gray-600 truncate",
  reserveBadge:
    "bg-white text-gray-400 border border-gray-200 text-[9px] px-1 rounded font-normal",
};
