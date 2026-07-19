import { getCategoryBadgeClass } from "../../shared/categoryColorUtils";
import { UI_STYLES } from "./adminStyles";

// 設備グループ（一括選択ショートカット）の一覧・作成・編集と、所属設備の紐付け編集。
export default function DeviceGroupSection({
  deviceGroups,
  selectedGroupId,
  setSelectedGroupId,
  handleEditGroupPrompt,
  handleDeleteGroup,
  newGroupName,
  setNewGroupName,
  handleCreateGroup,
  currentGroup,
  mccbList,
  categoryColors,
  handleToggleDeviceInGroup,
}) {
  return (
    <div className={UI_STYLES.sectionContainer}>
      <h2 className={UI_STYLES.sectionTitle}>
        👥 設備グループ一括選択マスター設定
      </h2>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左側：グループ一覧 */}
        <div className="w-full lg:w-1/3 space-y-4">
          <div className={UI_STYLES.subsectionContainer}>
            <h3 className={UI_STYLES.labelSubsection}>
              📁 グループ一覧 ({deviceGroups.length})
            </h3>
            <div className={UI_STYLES.listContainerTall}>
              {deviceGroups.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-4">
                  グループがありません
                </div>
              ) : (
                deviceGroups.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    className={`flex items-center justify-between text-xs p-2 rounded border cursor-pointer transition-all ${selectedGroupId === g.id ? "bg-blue-50 border-blue-400 text-blue-800 shadow-sm" : "bg-white border-gray-100 text-gray-700 hover:bg-gray-50"} mb-px`}
                  >
                    <span className="font-semibold truncate">
                      {g.name} ({g.mccbIds?.length || 0})
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={(e) => handleEditGroupPrompt(g, e)}
                        className={UI_STYLES.btnTextSmall}
                      >
                        編集
                      </button>
                      <button
                        onClick={(e) => handleDeleteGroup(g, e)}
                        className={UI_STYLES.btnDangerSmall}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={UI_STYLES.formRow}>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="新しいグループ名 (例: A系統一括)"
                className={UI_STYLES.inputSmall}
              />
              <button
                onClick={handleCreateGroup}
                className={UI_STYLES.btnPrimary}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                }}
              >
                作成
              </button>
            </div>
          </div>
        </div>

        {/* 右側：所属設備編集 */}
        <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col min-h-[300px]">
          {currentGroup ? (
            <>
              <h3 className="text-xs font-bold text-gray-600 mb-3 flex justify-between items-center border-b border-gray-200 pb-2">
                <span>
                  📦 所属設備の紐付け:{" "}
                  <span className="text-blue-700 ml-1">
                    {currentGroup.name}
                  </span>
                </span>
                <span>選択中: {currentGroup.mccbIds?.length || 0} 面</span>
              </h3>
              <div className="flex-1 overflow-y-auto max-h-[350px] bg-white border border-gray-200 rounded-lg p-2 grid grid-cols-1 md:grid-cols-2 gap-x-2 gap-y-2 content-start">
                {mccbList.map((mccb) => {
                  const isChecked = currentGroup.mccbIds?.includes(mccb.id);
                  const badgeColor = getCategoryBadgeClass(
                    mccb.category,
                    categoryColors,
                  );
                  return (
                    <label
                      key={mccb.id}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                        isChecked
                          ? "border-blue-300 bg-blue-50/30 text-blue-900 shadow-sm"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleDeviceInGroup(mccb.id)}
                        className="rounded text-blue-600"
                      />
                      <div className="truncate flex-1">
                        <span
                          className={`text-[11px] border px-1 py-0.5 rounded mr-1 ${badgeColor}`}
                        >
                          {mccb.category}
                        </span>
                        {mccb.name}
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-lg bg-white">
              👈
              左側の一覧からグループを選択すると、ここに所属設備の紐付け編集パネルが表示されます
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
