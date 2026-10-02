import { useState } from "react";
import { isDummyMccb, matchesMccbSearch } from "../../shared/mccbViewUtils";
import { ACTIVE } from "./requestListStyles";

// 仮発行・発行中の依頼で共通の編集パネル。作業者・作業内容・停電対象設備を編集する。
export default function RequestEditPanel({
  req,
  mccbList = [],
  initialSelectedIds = [],
  // 発行中の依頼は札を確保済みで代替名を変えても割当に反映されないため、既存分の入力を固定する。
  lockInitialDummyNames = false,
  onSave,
  onCancel,
}) {
  const [workerName, setWorkerName] = useState(req.workerName || "");
  const [workContent, setWorkContent] = useState(req.workContent || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [dummyNames, setDummyNames] = useState(req.dummyNames || {});

  const toggleTarget = (mccbId) => {
    setSelectedIds((prev) =>
      prev.includes(mccbId)
        ? prev.filter((id) => id !== mccbId)
        : [...prev, mccbId],
    );
  };

  const handleSave = () => {
    if (!workerName.trim()) {
      alert("作業者名を入力してください。");
      return;
    }
    if (selectedIds.length === 0) {
      alert("停電対象設備を1件以上選択してください。");
      return;
    }

    onSave({
      workerName,
      workContent,
      targetMccbIds: selectedIds,
      dummyNames,
    });
  };

  const query = searchTerm.trim().toLowerCase();
  const filteredMccbs = mccbList
    .filter((mccb) => !query || matchesMccbSearch(mccb, query))
    // お気に入り設備を先頭に寄せる。それ以外の並びは元の登録順を維持する（安定ソート）。
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return 0;
    });

  return (
    <div className={ACTIVE.editPanel}>
      <div>
        <label className={ACTIVE.editLabel}>作業責任者名</label>
        <input
          type="text"
          value={workerName}
          onChange={(e) => setWorkerName(e.target.value)}
          placeholder="例: 山田 太郎"
          className={ACTIVE.editInput}
        />
      </div>
      <div>
        <label className={ACTIVE.editLabel}>作業内容・目的</label>
        <input
          type="text"
          value={workContent}
          onChange={(e) => setWorkContent(e.target.value)}
          placeholder="例: ○○ポンプ定期点検作業"
          className={ACTIVE.editInput}
        />
      </div>

      <div>
        <label className={ACTIVE.editLabel}>停電対象設備（複数選択可）</label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="設備名・電気室で検索..."
          className={`${ACTIVE.editInput} mb-2`}
        />

        <div className={ACTIVE.editList}>
          {filteredMccbs.length === 0 ? (
            <div className="py-6 text-center text-xs font-bold text-gray-400">
              該当する設備がありません。
            </div>
          ) : (
            filteredMccbs.map((mccb) => {
              const isSelected = selectedIds.includes(mccb.id);
              return (
                <div key={mccb.id} className={ACTIVE.editItem}>
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTarget(mccb.id)}
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    <span className={ACTIVE.roomTag}>{mccb.room}</span>
                    <span className="truncate">{mccb.name}</span>
                  </label>

                  {isSelected && isDummyMccb(mccb) && (
                    <input
                      type="text"
                      value={dummyNames[mccb.id] || ""}
                      onChange={(e) =>
                        setDummyNames((prev) => ({
                          ...prev,
                          [mccb.id]: e.target.value,
                        }))
                      }
                      disabled={
                        lockInitialDummyNames &&
                        initialSelectedIds.includes(mccb.id)
                      }
                      placeholder="✏️ 代替する実際の設備名称を入力"
                      className={`${ACTIVE.editDummyInput} disabled:bg-gray-100 disabled:text-gray-400`}
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
        <button type="button" onClick={onCancel} className={ACTIVE.addCancel}>
          キャンセル
        </button>
        <button type="button" onClick={handleSave} className={ACTIVE.editSubmit}>
          保存する ({selectedIds.length}件)
        </button>
      </div>
    </div>
  );
}
