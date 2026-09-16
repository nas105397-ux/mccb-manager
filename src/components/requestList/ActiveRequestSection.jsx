import { formatWorkContent, formatWorkerName, matchesMccbSearch } from "../../shared/mccbViewUtils";
import FoldToggleRow from "./FoldToggleRow";
import { ACTIVE, UI } from "./requestListStyles";

const getReturnedCardLabel = (returnedInfo) =>
  returnedInfo?.cardNo
    ? `: ${returnedInfo.displayName} No.${returnedInfo.cardNo}`
    : "";

const getReserveCardLabel = (reserveInfo) =>
  `${reserveInfo.displayName} No.${reserveInfo.cardNo}`;

// 進行中の停電作業依頼一覧。設備追加・一部返却・印刷・解約と、対象設備の一時返却/再貸出を扱う。
export default function ActiveRequestSection({
  activeRequestViews,
  mccbList,
  toggleExpand,
  addPanelRequestId,
  openAddPanel,
  addSearchTerm,
  setAddSearchTerm,
  selectedAddIds,
  toggleAddTarget,
  handleAddTargets,
  returnPanelRequestId,
  openReturnPanel,
  selectedReturnIds,
  toggleReturnTarget,
  handleReturnTargets,
  handlePrintRequest,
  starPrintRequestId,
  isPrintDisabledBySetting,
  onDeleteRequest,
  handleRequestTargetCardAction,
}) {
  if (activeRequestViews.length === 0) {
    return (
      <div className={UI.empty}>現在、発行されている停電依頼はありません。</div>
    );
  }

  return (
    <div className="space-y-4">
      {activeRequestViews.map((req) => {
        const isExpanded = req.isExpanded;
        const isAddPanelOpen = addPanelRequestId === req.id;
        const isReturnPanelOpen = returnPanelRequestId === req.id;
        const returnableTargets = req.activeTargets || [];
        const returnedCount = req.targets.length - returnableTargets.length;
        // 返却済み設備は札を手放しているため、追加候補として選び直せるようにする。
        const currentTargetIds = new Set(
          returnableTargets.map((target) => target.id),
        );
        const addQuery = addSearchTerm.trim().toLowerCase();
        const addableMccbs = mccbList.filter((mccb) => {
          if (currentTargetIds.has(mccb.id)) return false;
          if (!addQuery) return true;
          return matchesMccbSearch(mccb, addQuery);
        });
        // 最後の1面まで返すと依頼が空になるため、その場合は解約・作業完了へ寄せる。
        const canReturnTargets = returnableTargets.length > 1;

        return (
          <div key={req.id} className={ACTIVE.card}>
            {/* 依頼の基本情報ヘッダー */}
            <div className={ACTIVE.header}>
              <div className={ACTIVE.summary}>
                <div className={ACTIVE.metaRow}>
                  <span className={ACTIVE.timestamp}>{req.timestamp} 発行</span>
                  <span className={ACTIVE.requestNo}>依頼番号: {req.id}</span>
                  <span className={ACTIVE.workerMeta}>
                    作業者: {formatWorkerName(req.workerName)}
                  </span>
                </div>
                <h3 className={ACTIVE.heading}>
                  <span aria-hidden="true">📌</span>
                  <span className={ACTIVE.headingText}>
                    {formatWorkContent(req.workContent)}
                  </span>
                  {req.isAllPowerOff && (
                    <span className={ACTIVE.completionStamp}>🔴 停電完了</span>
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
                {canReturnTargets && (
                  <button
                    type="button"
                    onClick={() => openReturnPanel(req.id)}
                    className={`${ACTIVE.actionButtonBase} ${ACTIVE.returnButton}`}
                  >
                    札を一部返却
                  </button>
                )}
                {!isPrintDisabledBySetting && (
                  <button
                    type="button"
                    onClick={() => handlePrintRequest(req)}
                    disabled={starPrintRequestId === req.id}
                    className={`${ACTIVE.actionButtonBase} ${ACTIVE.printButton} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {starPrintRequestId === req.id
                      ? "レシート送信中..."
                      : "依頼表を印刷"}
                  </button>
                )}
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

            {isReturnPanelOpen && (
              <div className={ACTIVE.returnPanel}>
                <p className={ACTIVE.returnNotice}>
                  ⚠️ 返却した設備は依頼の作業対象から外れ、札は他の作業者が使用できるようになります。
                  作業を一時中断するだけの場合は、設備ごとの「一時返却」を使用してください。
                </p>

                <div className={ACTIVE.returnList}>
                  {returnableTargets.map((target) => (
                    <label key={target.id} className={ACTIVE.returnItem}>
                      <input
                        type="checkbox"
                        checked={selectedReturnIds.includes(target.id)}
                        onChange={() => toggleReturnTarget(target.id)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className={ACTIVE.roomTag}>{target.room}</span>
                      <span className="truncate">{target.name}</span>
                      {target.reserveInfo?.cardNo ? (
                        <span
                          className={
                            target.isCardBorrowed
                              ? ACTIVE.reserveBadge
                              : ACTIVE.returnedBadge
                          }
                        >
                          {target.isCardBorrowed ? "🔖 貸出中" : "↩️ 一時返却中"}
                          : {getReserveCardLabel(target.reserveInfo)}
                        </span>
                      ) : (
                        <span className={ACTIVE.noReserveBadge}>札の空きなし</span>
                      )}
                      {target.isPowerOff && (
                        <span className={ACTIVE.noReserveBadge}>🔴 停電中</span>
                      )}
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openReturnPanel(req.id)}
                    className={ACTIVE.returnCancel}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReturnTargets(req.id)}
                    className={ACTIVE.returnSubmit}
                  >
                    選択設備を返却 ({selectedReturnIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* 紐付く設備リストトグルアコーディオン */}
            <div className="space-y-2">
              <FoldToggleRow
                isExpanded={isExpanded}
                onClick={() => toggleExpand(req.id)}
                label="停電対象設備一覧"
                count={req.targets.length}
                note={returnedCount > 0 ? `返却済み ${returnedCount}面` : null}
                noteClassName={ACTIVE.returnedFoldNote}
                className={ACTIVE.foldRow}
                hintClassName={ACTIVE.foldHint}
              />

              {isExpanded && (
                <div className={ACTIVE.targetGrid}>
                  {req.targets.map((target) => {
                    const reserveInfo = target.reserveInfo;
                    const returnedInfo = target.returnedInfo;

                    return (
                      <div
                        key={target.id}
                        className={
                          target.isReturned
                            ? ACTIVE.targetCardReturned
                            : ACTIVE.targetCard
                        }
                      >
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className={ACTIVE.roomTag}>{target.room}</span>
                          <span
                            className={
                              target.isReturned
                                ? ACTIVE.returnedTargetName
                                : ACTIVE.targetName
                            }
                          >
                            {target.name}
                          </span>

                          {target.isReturned ? (
                            <>
                              <span className={ACTIVE.returnedTargetBadge}>
                                ✅ 返却済み{getReturnedCardLabel(returnedInfo)}
                              </span>
                              {returnedInfo?.returnedTimestamp && (
                                <span className={ACTIVE.returnedTimestamp}>
                                  {returnedInfo.returnedTimestamp} 返却
                                </span>
                              )}
                            </>
                          ) : reserveInfo?.cardNo ? (
                            <span
                              className={
                                target.isCardBorrowed
                                  ? ACTIVE.reserveBadge
                                  : ACTIVE.returnedBadge
                              }
                            >
                              {target.isCardBorrowed ? "🔖 貸出中" : "↩️ 一時返却中"}
                              : {getReserveCardLabel(reserveInfo)}
                            </span>
                          ) : (
                            <span className={ACTIVE.noReserveBadge}>
                              札の空きなし
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                          {!target.isReturned && reserveInfo?.cardNo && (
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
                          {target.isReturned ? (
                            <span className={ACTIVE.returnedStatus}>
                              ✅ 札返却済み (依頼対象外)
                            </span>
                          ) : target.isPowerOff ? (
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
  );
}
