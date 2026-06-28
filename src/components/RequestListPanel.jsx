import { useState } from "react";
import { useRequestListController } from "../hooks/useRequestListController";

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
    "text-base font-black text-blue-800 mt-1 flex items-center gap-2 flex-wrap",
  workerSuffix: "text-xs font-normal text-gray-600",
  content: "text-xs text-gray-500 mt-1 font-medium",
  deleteButton:
    "bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap",
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
  heading: "text-sm font-black text-gray-700 mt-1.5",
  workerSuffix: "text-xs font-normal text-gray-500",
  content: "text-xs text-gray-400 mt-0.5 font-medium",
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
  requestHistory = [],
  historyPageInfo = { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  mccbList = [],
  onDeleteRequest,
  onChangeHistoryPage = () => {},
}) {
  const [activeView, setActiveView] = useState("active");
  const { activeRequestViews, historyRequestViews, toggleExpand } =
    useRequestListController({
      requests,
      requestHistory,
      mccbList,
    });

  return (
    <div className={UI.panel}>
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

              return (
                <div key={req.id} className={ACTIVE.card}>
                {/* 依頼の基本情報ヘッダー */}
                <div className={ACTIVE.header}>
                  <div>
                    <span className={ACTIVE.timestamp}>
                      {req.timestamp} 発行
                    </span>
                    <h3 className={ACTIVE.heading}>
                      👷 {req.workerName}{" "}
                      <span className={ACTIVE.workerSuffix}>氏からの依頼</span>
                      {req.isAllPowerOff && (
                        <span className={ACTIVE.completionStamp}>
                          🔴 停電完了
                        </span>
                      )}
                    </h3>
                    {req.workContent && (
                      <p className={ACTIVE.content}>内容: {req.workContent}</p>
                    )}
                  </div>

                  <button
                    onClick={() => onDeleteRequest(req.id)}
                    className={ACTIVE.deleteButton}
                  >
                    解約・作業完了 (札解放)
                  </button>
                </div>

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
                                <span className={ACTIVE.reserveBadge}>
                                  🔖 確保札: {reserveInfo.displayName} No.
                                  {reserveInfo.cardNo}
                                </span>
                              ) : (
                                <span className={ACTIVE.noReserveBadge}>
                                  札の空きなし
                                </span>
                              )}
                            </div>

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
                        作業完了 👷 {req.workerName}{" "}
                        <span className={HISTORY.workerSuffix}>
                          氏の作業履歴
                        </span>
                      </h4>
                      {req.workContent && (
                        <p className={HISTORY.content}>
                          内容: {req.workContent}
                        </p>
                      )}
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
  );
}
