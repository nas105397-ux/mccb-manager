import { useState } from "react";
import {
  formatWorkContent,
  formatWorkerName,
  isDummyMccb,
  matchesMccbSearch,
} from "../../shared/mccbViewUtils";
import FoldToggleRow from "./FoldToggleRow";
import { ACTIVE, UI } from "./requestListStyles";

// 仮発行の停電作業依頼一覧。編集、正式発行、削除を行う。
export default function DraftRequestSection({
  draftRequestViews,
  mccbList = [],
  toggleExpand,
  handleIssueDraft,
  onDeleteDraftRequest,
  onUpdateDraft,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editWorkerName, setEditWorkerName] = useState("");
  const [editWorkContent, setEditWorkContent] = useState("");
  const [editSearchTerm, setEditSearchTerm] = useState("");
  const [editSelectedIds, setEditSelectedIds] = useState([]);
  const [editDummyNames, setEditDummyNames] = useState({});

  if (draftRequestViews.length === 0) {
    return (
      <div className={UI.empty}>現在、仮発行されている停電依頼はありません。</div>
    );
  }

  const openEdit = (req) => {
    setEditingId((currentId) => (currentId === req.id ? null : req.id));
    setEditWorkerName(req.workerName || "");
    setEditWorkContent(req.workContent || "");
    setEditSelectedIds(req.targetMccbIds || []);
    setEditDummyNames(req.dummyNames || {});
    setEditSearchTerm("");
  };

  const toggleEditTarget = (mccbId) => {
    setEditSelectedIds((prev) =>
      prev.includes(mccbId)
        ? prev.filter((id) => id !== mccbId)
        : [...prev, mccbId],
    );
  };

  const handleEditDummyNameChange = (mccbId, value) => {
    setEditDummyNames((prev) => ({ ...prev, [mccbId]: value }));
  };

  const handleSaveEdit = async (req) => {
    if (!editWorkerName.trim()) {
      alert("作業者名を入力してください。");
      return;
    }
    if (editSelectedIds.length === 0) {
      alert("停電対象設備を1件以上選択してください。");
      return;
    }

    await onUpdateDraft(req.id, {
      workerName: editWorkerName,
      workContent: editWorkContent,
      targetMccbIds: editSelectedIds,
      dummyNames: editDummyNames,
    });
    setEditingId(null);
  };

  const editQuery = editSearchTerm.trim().toLowerCase();
  const filteredEditMccbs = mccbList
    .filter((mccb) => !editQuery || matchesMccbSearch(mccb, editQuery))
    // お気に入り設備を先頭に寄せる。それ以外の並びは元の登録順を維持する（安定ソート）。
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return 0;
    });

  return (
    <div className="space-y-4">
      {draftRequestViews.map((req) => {
        const isExpanded = req.isExpanded;
        const isEditing = editingId === req.id;

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
                  onClick={() => openEdit(req)}
                  className={`${ACTIVE.actionButtonBase} ${ACTIVE.editButton}`}
                >
                  編集
                </button>
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

            {isEditing && (
              <div className={ACTIVE.editPanel}>
                <div>
                  <label className={ACTIVE.editLabel}>作業責任者名</label>
                  <input
                    type="text"
                    value={editWorkerName}
                    onChange={(e) => setEditWorkerName(e.target.value)}
                    placeholder="例: 山田 太郎"
                    className={ACTIVE.editInput}
                  />
                </div>
                <div>
                  <label className={ACTIVE.editLabel}>作業内容・目的</label>
                  <input
                    type="text"
                    value={editWorkContent}
                    onChange={(e) => setEditWorkContent(e.target.value)}
                    placeholder="例: ○○ポンプ定期点検作業"
                    className={ACTIVE.editInput}
                  />
                </div>

                <div>
                  <label className={ACTIVE.editLabel}>
                    停電対象設備（複数選択可）
                  </label>
                  <input
                    type="text"
                    value={editSearchTerm}
                    onChange={(e) => setEditSearchTerm(e.target.value)}
                    placeholder="設備名・電気室で検索..."
                    className={`${ACTIVE.editInput} mb-2`}
                  />

                  <div className={ACTIVE.editList}>
                    {filteredEditMccbs.length === 0 ? (
                      <div className="py-6 text-center text-xs font-bold text-gray-400">
                        該当する設備がありません。
                      </div>
                    ) : (
                      filteredEditMccbs.map((mccb) => {
                        const isSelected = editSelectedIds.includes(mccb.id);
                        return (
                          <div key={mccb.id} className={ACTIVE.editItem}>
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleEditTarget(mccb.id)}
                                className="rounded text-sky-600 focus:ring-sky-500"
                              />
                              <span className={ACTIVE.roomTag}>{mccb.room}</span>
                              <span className="truncate">{mccb.name}</span>
                            </label>

                            {isSelected && isDummyMccb(mccb) && (
                              <input
                                type="text"
                                value={editDummyNames[mccb.id] || ""}
                                onChange={(e) =>
                                  handleEditDummyNameChange(mccb.id, e.target.value)
                                }
                                placeholder="✏️ 代替する実際の設備名称を入力"
                                className={ACTIVE.editDummyInput}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className={ACTIVE.addCancel}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(req)}
                    className={ACTIVE.editSubmit}
                  >
                    保存する ({editSelectedIds.length}件)
                  </button>
                </div>
              </div>
            )}

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
