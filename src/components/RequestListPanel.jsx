import { useEffect, useState } from "react";
import { useRequestListController } from "../hooks/useRequestListController";
import { REQUEST_PRINT_MODES } from "../shared/printSettings";

const UI = {
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

const ACTIVE = {
  card: "border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-all",
  header:
    "flex flex-wrap justify-between items-start mb-3 border-b border-gray-200 pb-3 gap-2",
  timestamp: "text-xs text-gray-400 font-bold",
  heading:
    "text-lg font-black text-blue-800 mt-1 flex items-center gap-2 flex-wrap text-left leading-snug",
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
    "bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider shadow-sm shrink-0 animate-pulse",
};

const HISTORY = {
  empty:
    "text-center py-10 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed text-xs",
  list: "space-y-3 pr-1",
  card: "border border-gray-200 rounded-lg p-3.5 bg-white shadow-sm hover:border-gray-300 transition-colors",
  header:
    "flex flex-wrap justify-between items-start border-b border-gray-100 pb-2 mb-2 gap-2",
  stampRow:
    "flex flex-wrap items-center gap-x-2 text-[10px] text-gray-400 font-bold",
  issueStamp: "bg-gray-100 px-1.5 py-0.5 rounded border",
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

const getIssueDate = (req) => {
  const timestampValue = Number(String(req.id || "").replace("REQ-", ""));
  if (Number.isFinite(timestampValue) && timestampValue > 0) {
    return new Date(timestampValue);
  }
  return new Date();
};

const getDateCode = (date) =>
  `${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

function PrintableRequestForm({ request }) {
  if (!request) return null;

  const issueDate = getIssueDate(request);
  const dateCode = getDateCode(issueDate);

  return (
    <div className="hidden print:block print:w-[78mm] print:mx-auto text-black bg-white font-mono text-xs">
      <div className="border-0 p-1 space-y-4">
        <div className="text-center border-b-2 border-black pb-2 mb-2">
          <h1 className="text-base font-black tracking-tighter">
            操作禁止（停電）依頼表
          </h1>
          <p className="text-[9px] text-black mt-0.5">
            ※作業終了後、管理室へ返却
          </p>
          <div className="flex justify-between text-[10px] mt-2 border-t border-dashed border-gray-400 pt-1">
            <span>
              日付: {issueDate.getFullYear()}/{issueDate.getMonth() + 1}/
              {issueDate.getDate()}
            </span>
            <span>No: REQ-{dateCode}</span>
          </div>
        </div>

        <div className="space-y-1 p-2 rounded border border-black">
          <p className="text-[10px] font-bold text-gray-500">【作業責任者】</p>
          <p className="text-sm font-black pl-1">
            {request.workerName || "（未入力）"}
          </p>
          <p className="text-[10px] font-bold text-gray-500 mt-1">
            【作業内容】
          </p>
          <p className="text-xs pl-1 leading-tight whitespace-pre-wrap">
            {request.workContent || "（未入力）"}
          </p>
        </div>

        <div className="border-t border-black pt-2">
          <p className="text-[10px] font-black mb-1">▼ 停電対象設備一覧</p>
          <div className="space-y-1 border-b border-black pb-2">
            {request.targets.map((target, index) => {
              const reserveInfo = target.reserveInfo;
              const cardLabel = reserveInfo?.cardNo
                ? target.isAllocatedFromDummy
                  ? `代替:${reserveInfo.displayName} No.${reserveInfo.cardNo}`
                  : `子札 No.${reserveInfo.cardNo}`
                : "札の空きなし";

              return (
                <div
                  key={`${target.id}-${index}`}
                  className="flex justify-between items-start text-[11px] py-0.5 border-b border-dashed border-gray-200 last:border-0"
                >
                  <span className="font-bold truncate max-w-[200px]">
                    {index + 1}. {target.name}
                  </span>
                  <span className="font-black shrink-0 text-right px-1 rounded">
                    {cardLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RequestListPanel({
  requests = [],
  requestHistory = [],
  historyPageInfo = { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  mccbList = [],
  onDeleteRequest,
  onAddTargetsToRequest = () => {},
  onUpdateRequestTargetCard = () => {},
  onChangeHistoryPage = () => {},
  requestPrintMode = REQUEST_PRINT_MODES.STAR_RECEIPT,
}) {
  const [activeView, setActiveView] = useState("active");
  const [printRequest, setPrintRequest] = useState(null);
  const [starPrintRequestId, setStarPrintRequestId] = useState(null);
  const [addPanelRequestId, setAddPanelRequestId] = useState(null);
  const [addSearchTerm, setAddSearchTerm] = useState("");
  const [selectedAddIds, setSelectedAddIds] = useState([]);
  const isPrintDisabledBySetting = requestPrintMode === REQUEST_PRINT_MODES.NONE;
  const { activeRequestViews, historyRequestViews, toggleExpand } =
    useRequestListController({
      requests,
      requestHistory,
      mccbList,
    });

  useEffect(() => {
    if (!printRequest) return undefined;

    const clearPrintRequest = () => setPrintRequest(null);
    window.addEventListener("afterprint", clearPrintRequest);
    const timerId = window.setTimeout(() => {
      window.print();
    }, 50);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("afterprint", clearPrintRequest);
    };
  }, [printRequest]);

  const handlePrintRequest = async (request) => {
    if (requestPrintMode === REQUEST_PRINT_MODES.NONE) {
      alert("管理者設定で依頼表の印刷は無効になっています。");
      return;
    }

    if (requestPrintMode === REQUEST_PRINT_MODES.BROWSER) {
      setPrintRequest(request);
      return;
    }

    if (starPrintRequestId) return;

    setStarPrintRequestId(request.id);
    try {
      const { printRequestReceipt } = await import("../shared/starReceiptPrinter");
      await printRequestReceipt(request, mccbList);
      alert("スター精密プリンターへ依頼表を送信しました。");
    } catch (error) {
      console.error(error);
      alert(`レシート印刷に失敗しました。プリンター接続とブラウザのWebUSB許可を確認してください。\n${error?.message || error}`);
    } finally {
      setStarPrintRequestId(null);
    }
  };

  const openAddPanel = (requestId) => {
    setAddPanelRequestId((currentId) => (currentId === requestId ? null : requestId));
    setAddSearchTerm("");
    setSelectedAddIds([]);
  };

  const toggleAddTarget = (mccbId) => {
    setSelectedAddIds((prev) =>
      prev.includes(mccbId)
        ? prev.filter((id) => id !== mccbId)
        : [...prev, mccbId],
    );
  };

  const handleAddTargets = (requestId) => {
    if (selectedAddIds.length === 0) {
      alert("追加する設備を選択してください。");
      return;
    }

    onAddTargetsToRequest(requestId, selectedAddIds);
    setAddPanelRequestId(null);
    setAddSearchTerm("");
    setSelectedAddIds([]);
    alert("選択した設備を依頼に追加しました。");
  };

  const handleRequestTargetCardAction = (requestId, target, action) => {
    const label = action === "return" ? "一時返却" : "再貸出";
    onUpdateRequestTargetCard(requestId, target.id, action);
    alert(`${target.name} の子札を${label}しました。`);
  };

  return (
    <>
    <div className={`${UI.panel} print:hidden`}>
      <div className={UI.tabWrap} role="tablist" aria-label="依頼一覧表示切替">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "active"}
          onClick={() => setActiveView("active")}
          className={`${UI.tabButton} ${
            activeView === "active" ? UI.tabActive : UI.tabIdle
          }`}
        >
          進行中 {activeRequestViews.length} 件
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "history"}
          onClick={() => setActiveView("history")}
          className={`${UI.tabButton} ${
            activeView === "history" ? UI.tabActive : UI.tabIdle
          }`}
        >
          履歴 {historyPageInfo.total || historyRequestViews.length} 件
        </button>
      </div>

      {/* ====================================================
          SECTION 1: 進行中の停電作業依頼一覧
          ==================================================== */}
      {activeView === "active" &&
        (activeRequestViews.length === 0 ? (
          <div className={UI.empty}>
            現在、発行されている停電依頼はありません。
          </div>
        ) : (
          <div className="space-y-4">
            {activeRequestViews.map((req) => {
              const isExpanded = req.isExpanded;
              const isAddPanelOpen = addPanelRequestId === req.id;
              const currentTargetIds = new Set(req.targetMccbIds || []);
              const addQuery = addSearchTerm.trim().toLowerCase();
              const addableMccbs = mccbList.filter((mccb) => {
                if (currentTargetIds.has(mccb.id)) return false;
                if (!addQuery) return true;
                return (
                  mccb.name?.toLowerCase().includes(addQuery) ||
                  mccb.room?.toLowerCase().includes(addQuery)
                );
              });

              return (
                <div key={req.id} className={ACTIVE.card}>
                {/* 依頼の基本情報ヘッダー */}
                <div className={ACTIVE.header}>
                  <div>
                    <span className={ACTIVE.timestamp}>
                      {req.timestamp} 発行
                    </span>
                    <h3 className={ACTIVE.heading}>
                      📌 {req.workContent || "作業内容未入力"}
                      {req.isAllPowerOff && (
                        <span className={ACTIVE.completionStamp}>
                          🔴 停電完了
                        </span>
                      )}
                    </h3>
                    <p className={ACTIVE.content}>
                      作業者: {req.workerName || "未入力"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAddPanel(req.id)}
                      className={`${ACTIVE.actionButtonBase} ${ACTIVE.addButton}`}
                    >
                      停電設備を追加
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintRequest(req)}
                      disabled={starPrintRequestId === req.id || isPrintDisabledBySetting}
                      className={`${ACTIVE.actionButtonBase} ${ACTIVE.printButton} disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {isPrintDisabledBySetting
                        ? "印刷なし"
                        : starPrintRequestId === req.id
                          ? "レシート送信中..."
                          : "依頼表を印刷"}
                    </button>
                    <button
                      onClick={() => onDeleteRequest(req.id)}
                      className={`${ACTIVE.actionButtonBase} ${ACTIVE.deleteButton}`}
                    >
                      解約・作業完了 (札解放)
                    </button>
                  </div>
                </div>

                {isAddPanelOpen && (
                  <div className={ACTIVE.addPanel}>
                    <input
                      type="text"
                      value={addSearchTerm}
                      onChange={(event) => setAddSearchTerm(event.target.value)}
                      placeholder="設備名・電気室で検索..."
                      className={ACTIVE.addSearch}
                    />

                    <div className={ACTIVE.addList}>
                      {addableMccbs.length === 0 ? (
                        <div className="py-6 text-center text-xs font-bold text-gray-400">
                          追加できる設備がありません。
                        </div>
                      ) : (
                        addableMccbs.map((mccb) => (
                          <label key={mccb.id} className={ACTIVE.addItem}>
                            <input
                              type="checkbox"
                              checked={selectedAddIds.includes(mccb.id)}
                              onChange={() => toggleAddTarget(mccb.id)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className={ACTIVE.roomTag}>{mccb.room}</span>
                            <span className="truncate">{mccb.name}</span>
                          </label>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openAddPanel(req.id)}
                        className={ACTIVE.addCancel}
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddTargets(req.id)}
                        className={ACTIVE.addSubmit}
                      >
                        選択設備を追加 ({selectedAddIds.length})
                      </button>
                    </div>
                  </div>
                )}

                {/* 紐付く設備リストトグルアコーディオン */}
                <div className="space-y-2">
                  <div
                    onClick={() => toggleExpand(req.id)}
                    className={ACTIVE.foldRow}
                    title={isExpanded ? "クリックで非表示" : "クリックで表示"}
                  >
                    <span>
                      {isExpanded ? "▼" : "▶"} 停電対象設備一覧 (
                      {req.targets.length}面)
                    </span>
                    <span className={ACTIVE.foldHint}>
                      {isExpanded
                        ? "[ クリックで折りたたむ ]"
                        : "[ クリックで展開する ]"}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className={ACTIVE.targetGrid}>
                      {req.targets.map((target) => {
                        const reserveInfo = target.reserveInfo;

                        return (
                          <div key={target.id} className={ACTIVE.targetCard}>
                            <div className="flex items-center gap-2 truncate">
                              <span className={ACTIVE.roomTag}>
                                {target.room}
                              </span>
                              <span className={ACTIVE.targetName}>
                                {target.name}
                              </span>

                              {reserveInfo?.cardNo ? (
                                <span
                                  className={
                                    target.isCardBorrowed
                                      ? ACTIVE.reserveBadge
                                      : ACTIVE.returnedBadge
                                  }
                                >
                                  {target.isCardBorrowed ? "🔖 貸出中" : "↩️ 一時返却中"}: {reserveInfo.displayName} No.
                                  {reserveInfo.cardNo}
                                </span>
                              ) : (
                                <span className={ACTIVE.noReserveBadge}>
                                  札の空きなし
                                </span>
                              )}
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                              {reserveInfo?.cardNo && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRequestTargetCardAction(
                                      req.id,
                                      target,
                                      target.isCardBorrowed ? "return" : "borrow",
                                    )
                                  }
                                  className={ACTIVE.cardActionButton}
                                >
                                  {target.isCardBorrowed ? "一時返却" : "再貸出"}
                                </button>
                              )}
                              {target.isPowerOff ? (
                                <span className={ACTIVE.doneStatus}>
                                  🔴 停電対応 完了
                                </span>
                              ) : (
                                <span className={ACTIVE.pendingStatus}>
                                  🟢 送電中 (未対応)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* ====================================================
          SECTION 2: 作業完了・解約の歴史を記録する履歴一覧
          ==================================================== */}
      {activeView === "history" && (
      <div className="pt-1">
        <h3 className={UI.sectionTitle}>
          📜 作業完了・解約 履歴一覧
          <span className={UI.countBadge}>
            {historyPageInfo.total || historyRequestViews.length} 件
          </span>
        </h3>

        {historyRequestViews.length === 0 ? (
          <div className={HISTORY.empty}>
            過去の完了および解約履歴はありません。
          </div>
        ) : (
          <div className={HISTORY.list}>
            {historyRequestViews.map((req) => {
              const isExpanded = req.isExpanded;

              return (
                <div key={req.id} className={HISTORY.card}>
                  {/* 過去ログヘッダースタンプ */}
                  <div className={HISTORY.header}>
                    <div>
                      <div className={HISTORY.stampRow}>
                        <span className={HISTORY.issueStamp}>
                          🛫 発行: {req.timestamp}
                        </span>
                        <span className={HISTORY.doneStamp}>
                          🛬 完了: {req.completedTimestamp}
                        </span>
                      </div>
                      <h4 className={HISTORY.heading}>
                        📌 {req.workContent || "作業内容未入力"}
                      </h4>
                      <p className={HISTORY.content}>
                        作業者: {req.workerName || "未入力"}
                      </p>
                    </div>
                    <span className={HISTORY.status}>✓ 対応済</span>
                  </div>

                  {/* 過去設備詳細トグル */}
                  <div className="space-y-1">
                    <div
                      onClick={() => toggleExpand(req.id)}
                      className={HISTORY.foldRow}
                    >
                      <span>
                        {isExpanded ? "▼" : "▶"} 当時の対象設備 (
                        {req.targets.length}面)
                      </span>
                    </div>

                    {isExpanded && (
                      <div className={HISTORY.targetGrid}>
                        {req.targets.map((target) => {
                          const reserveInfo = target.reserveInfo;
                          return (
                            <div key={target.id} className={HISTORY.targetCard}>
                              <div className="flex items-center gap-2 truncate">
                                <span className={HISTORY.roomTag}>
                                  {target.room}
                                </span>
                                <span className={HISTORY.targetName}>
                                  {target.name}
                                </span>
                                {reserveInfo?.cardNo && (
                                  <span className={HISTORY.reserveBadge}>
                                    🔖 使用札: {reserveInfo.displayName} No.
                                    {reserveInfo.cardNo}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 border-t border-gray-150 pt-3">
          <span>
            表示 {historyRequestViews.length} 件 / {historyPageInfo.total || 0} 件
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeHistoryPage(historyPageInfo.page - 1)}
              disabled={historyPageInfo.page <= 1}
              className="px-3 py-1 rounded border bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              前へ
            </button>
            <span className="font-black text-gray-600">
              {historyPageInfo.page || 1} / {historyPageInfo.totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => onChangeHistoryPage(historyPageInfo.page + 1)}
              disabled={historyPageInfo.page >= historyPageInfo.totalPages}
              className="px-3 py-1 rounded border bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              次へ
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
    <PrintableRequestForm request={printRequest} />
    </>
  );
}
