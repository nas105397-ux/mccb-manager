import { formatWorkContent, formatWorkerName } from "../../shared/mccbViewUtils";
import FoldToggleRow from "./FoldToggleRow";
import { HISTORY, UI } from "./requestListStyles";

// 作業完了・解約の履歴一覧。ページ送りと、当時の対象設備の表示を扱う。
export default function HistoryRequestSection({
  historyRequestViews,
  historyPageInfo,
  toggleExpand,
  onChangeHistoryPage,
}) {
  return (
    <div className="pt-1">
      <h3 className={UI.sectionTitle}>
        📜 作業完了・解約 履歴一覧
        <span className={UI.countBadge}>
          {historyPageInfo.total || historyRequestViews.length} 件
        </span>
      </h3>

      {historyRequestViews.length === 0 ? (
        <div className={HISTORY.empty}>過去の完了および解約履歴はありません。</div>
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
                        作業者: {formatWorkerName(req.workerName)}
                      </span>
                      <span className={HISTORY.doneStamp}>
                        🛬 完了: {req.completedTimestamp}
                      </span>
                    </div>
                    <h4 className={HISTORY.heading}>
                      📌 {formatWorkContent(req.workContent)}
                    </h4>
                  </div>
                  <span className={HISTORY.status}>✓ 対応済</span>
                </div>

                {/* 過去設備詳細トグル */}
                <div className="space-y-1">
                  <FoldToggleRow
                    isExpanded={isExpanded}
                    onClick={() => toggleExpand(req.id)}
                    label="当時の対象設備"
                    count={req.targets.length}
                    className={HISTORY.foldRow}
                  />

                  {isExpanded && (
                    <div className={HISTORY.targetGrid}>
                      {req.targets.map((target) => {
                        const reserveInfo = target.reserveInfo;
                        return (
                          <div key={target.id} className={HISTORY.targetCard}>
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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
            className="px-3 py-2 rounded border bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
            className="px-3 py-2 rounded border bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
