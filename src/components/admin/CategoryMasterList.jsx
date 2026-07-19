import {
  CATEGORY_COLOR_PRESETS,
  getCategoryBadgeClass,
  getCategoryColorKey,
} from "../../shared/categoryColorUtils";
import { UI_STYLES } from "./adminStyles";

// 区分マスター一覧の表示・表示色変更・追加・編集・削除。
export default function CategoryMasterList({
  categories,
  categoryColors,
  updateCategoryColor,
  handleEditCategoryPrompt,
  deleteCategory,
  newCategoryInput,
  setNewCategoryInput,
  handleAddCategory,
}) {
  return (
    <div className={UI_STYLES.subsectionContainer}>
      <h3 className={UI_STYLES.labelSubsection}>
        🏷️ 区分マスター一覧 ({categories.length})
      </h3>
      <div className={UI_STYLES.listContainer}>
        {categories.map((c) => (
          <div key={c} className={`${UI_STYLES.listItem} gap-2 flex-wrap`}>
            <span
              className={`text-[11px] border px-2 py-0.5 rounded font-black ${getCategoryBadgeClass(c, categoryColors)}`}
            >
              {c}
            </span>
            <div className="flex items-center gap-1.5 ml-auto">
              <span
                className={`h-5 w-5 rounded-full border shadow-inner ${CATEGORY_COLOR_PRESETS[getCategoryColorKey(c, categoryColors)].swatchClass}`}
                aria-hidden="true"
              />
              <select
                value={getCategoryColorKey(c, categoryColors)}
                onChange={(e) => updateCategoryColor(c, e.target.value)}
                className="border border-gray-200 rounded bg-white px-1.5 py-0.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                aria-label={`${c} の表示色`}
              >
                {Object.entries(CATEGORY_COLOR_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleEditCategoryPrompt(c)}
                className={UI_STYLES.btnTextSmall}
              >
                編集
              </button>
              <button
                onClick={() => deleteCategory(c)}
                className={UI_STYLES.btnDangerSmall}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className={UI_STYLES.formRow}>
        <input
          type="text"
          value={newCategoryInput}
          onChange={(e) => setNewCategoryInput(e.target.value)}
          placeholder="新しい区分名 (例: 7スト)"
          className={UI_STYLES.inputSmall}
        />
        <button onClick={handleAddCategory} className={UI_STYLES.btnSecondary}>
          ＋ 追加
        </button>
      </div>
    </div>
  );
}
