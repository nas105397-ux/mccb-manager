import { useState } from "react";
import { useRequestListController } from "../hooks/useRequestListController";
import { useRequestListPrintController } from "../hooks/useRequestListPrintController";
import { REQUEST_PRINT_MODES } from "../shared/printSettings";
import PrintableRequestForm from "./PrintableRequestForm";

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

const HISTORY = {
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

export default function RequestListPanel({
  requests = [],
  draftRequests = [],
  requestHistory = [],
  historyPageInfo = { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  mccbList = [],
  onDeleteRequest,
  onIssueDraftRequest = () => {},
  onDeleteDraftRequest = () => {},
  onAddTargetsToRequest = () => {},
  onUpdateRequestTargetCard = () => {},
  onChangeHistoryPage = () => {},
  requestPrintMode = REQUEST_PRINT_MODES.STAR_RECEIPT,
}) {
  const [activeView, setActiveView] = useState("active");
  const [addPanelRequestId, setAddPanelRequestId] = useState(null);
  const [addSearchTerm, setAddSearchTerm] = useState("");
  const [selectedAddIds, setSelectedAddIds] = useState([]);
  const { activeRequestViews, draftRequestViews, historyRequestViews, toggleExpand } =
    useRequestListController({
      requests,
      draftRequests,
      requestHistory,
      mccbList,
    });

  const {
    printRequest,
    starPrintRequestId,
    isPrintDisabledBySetting,
    handlePrintRequest,
  } = useRequestListPrintController({ requestPrintMode, mccbList });

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

  const handleIssueDraft = async (draftId) => {
    try {
      await onIssueDraftRequest(draftId);
      alert("仮発行依頼を発行しました。");
    } catch (error) {
      console.error(error);
      alert(error?.message || "仮発行依頼の発行に失敗しました。");
    }
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
          aria-selected={activeView === "draft"}
          onClick={() => setActiveView("draft")}
          className={`${UI.tabButton} ${
            activeView === "draft" ? UI.tabActive : UI.tabIdle
          }`}
        >
          仮発行 {draftRequestViews.length} 件
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
                  <div className={ACTIVE.summary}>
                    <div className={ACTIVE.metaRow}>
                      <span className={ACTIVE.timestamp}>
                        {req.timestamp} 発行
                      </span>
                      <span className={ACTIVE.requestNo}>
                        依頼番号: {req.id}
                      </span>
                      <span className={ACTIVE.workerMeta}>
                        作業者: {req.workerName || "未入力"}
                      </span>
                    </div>
                    <h3 className={ACTIVE.heading}>
                      <span aria-hidden="true">📌</span>
                      <span className={ACTIVE.headingText}>
                        {req.workContent || "作業内容未入力"}
                      </span>
                      {req.isAllPowerOff && (
                        <span className={ACTIVE.completionStamp}>
                          🔴 停電完了
                        </span>
                      )}
                    </h3>
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

      {activeView === "draft" &&
        (draftRequestViews.length === 0 ? (
          <div className={UI.empty}>
            現在、仮発行されている停電依頼はありません。
          </div>
        ) : (
          <div className="space-y-4">
            {draftRequestViews.map((req) => {
              const isExpanded = req.isExpanded;

              return (
                <div key={req.id} className={ACTIVE.card}>
                  <div className={ACTIVE.header}>
                    <div className={ACTIVE.summary}>
                      <div className={ACTIVE.metaRow}>
                        <span className={ACTIVE.timestamp}>
                          {req.timestamp} 仮発行
                        </span>
                        <span className={ACTIVE.requestNo}>
                          仮発行番号: {req.id}
                        </span>
                        <span className={ACTIVE.workerMeta}>
                          作業者: {req.workerName || "未入力"}
                        </span>
                      </div>
                      <h3 className={ACTIVE.heading}>
                        <span aria-hidden="true">📌</span>
                        <span className={ACTIVE.headingText}>
                          {req.workContent || "作業内容未入力"}
                        </span>
                      </h3>
                      <p className={ACTIVE.content}>
                        子札は未割当です。発行時点の空き札で計算します。
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleIssueDraft(req.id)}
                        className={`${ACTIVE.actionButtonBase} ${ACTIVE.printButton}`}
                      >
                        発行
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDraftRequest(req.id)}
                        className={`${ACTIVE.actionButtonBase} ${ACTIVE.deleteButton}`}
                      >
                        削除
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div
                      onClick={() => toggleExpand(req.id)}
                      className={ACTIVE.foldRow}
                      title={isExpanded ? "クリックで非表示" : "クリックで表示"}
                    >
                      <span>
                        {isExpanded ? "▼" : "▶"} 停電予定設備一覧 (
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
                        {req.targets.map((target) => (
                          <div key={target.id} className={ACTIVE.targetCard}>
                            <div className="flex items-center gap-2 truncate">
                              <span className={ACTIVE.roomTag}>{target.room}</span>
                              <span className={ACTIVE.targetName}>{target.name}</span>
                              <span className={ACTIVE.noReserveBadge}>
                                子札未割当
                              </span>
                            </div>
                          </div>
                        ))}
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
                    <div className={HISTORY.summary}>
                      <div className={HISTORY.stampRow}>
                        <span className={HISTORY.issueStamp}>
                          🛫 発行: {req.timestamp}
                        </span>
                        <span className={HISTORY.requestNoStamp}>
                          依頼番号: {req.id}
                        </span>
                        <span className={HISTORY.workerStamp}>
                          作業者: {req.workerName || "未入力"}
                        </span>
                        <span className={HISTORY.doneStamp}>
                          🛬 完了: {req.completedTimestamp}
                        </span>
                      </div>
                      <h4 className={HISTORY.heading}>
                        📌 {req.workContent || "作業内容未入力"}
                      </h4>
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
