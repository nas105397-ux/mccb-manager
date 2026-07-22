import { formatWorkContent, formatWorkerName } from "../../shared/mccbViewUtils";
import FoldToggleRow from "./FoldToggleRow";
import { ACTIVE, UI } from "./requestListStyles";

// 仮発行の停電作業依頼一覧。正式発行または削除を行う。
export default function DraftRequestSection({
  draftRequestViews,
  toggleExpand,
  handleIssueDraft,
  onDeleteDraftRequest,
}) {
  if (draftRequestViews.length === 0) {
    return (
      <div className={UI.empty}>現在、仮発行されている停電依頼はありません。</div>
    );
  }

  return (
    <div className="space-y-4">
      {draftRequestViews.map((req) => {
        const isExpanded = req.isExpanded;

        return (
          <div key={req.id} className={ACTIVE.card}>
            <div className={ACTIVE.header}>
              <div className={ACTIVE.summary}>
                <div className={ACTIVE.metaRow}>
                  <span className={ACTIVE.timestamp}>{req.timestamp} 仮発行</span>
                  <span className={ACTIVE.requestNo}>仮発行番号: {req.id}</span>
                  <span className={ACTIVE.workerMeta}>
                    作業者: {formatWorkerName(req.workerName)}
                  </span>
                </div>
                <h3 className={ACTIVE.heading}>
                  <span aria-hidden="true">📌</span>
                  <span className={ACTIVE.headingText}>
                    {formatWorkContent(req.workContent)}
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
              <FoldToggleRow
                isExpanded={isExpanded}
                onClick={() => toggleExpand(req.id)}
                label="停電予定設備一覧"
                count={req.targets.length}
                className={ACTIVE.foldRow}
                hintClassName={ACTIVE.foldHint}
              />

              {isExpanded && (
                <div className={ACTIVE.targetGrid}>
                  {req.targets.map((target) => (
                    <div key={target.id} className={ACTIVE.targetCard}>
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className={ACTIVE.roomTag}>{target.room}</span>
                        <span className={ACTIVE.targetName}>{target.name}</span>
                        <span className={ACTIVE.noReserveBadge}>子札未割当</span>
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
  );
}
