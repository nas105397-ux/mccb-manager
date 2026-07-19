import { UI_STYLES } from "./adminStyles";

// 停電作業依頼の履歴保持件数設定と、履歴の全クリア。
export default function RequestHistorySettingsPanel({
  historySettings,
  onChangeMaxHistorySize,
  onClearRequestHistory,
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <h3 className={UI_STYLES.labelSubsection}>停電作業依頼 履歴管理設定</h3>
      <div className="space-y-4 text-xs font-bold">
        <div className="text-gray-500 font-medium">
          完了した依頼の履歴件数を設定し、必要時に履歴を全削除できます。
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">
            <span className="text-gray-500 font-black">最大保持件数:</span>
            <select
              value={historySettings?.maxSize || 500}
              onChange={(e) => onChangeMaxHistorySize(Number(e.target.value))}
              className={UI_STYLES.selectMaxSize}
            >
              <option value="50">50 件</option>
              <option value="100">100 件</option>
              <option value="300">300 件</option>
              <option value="500">500 件</option>
            </select>
          </div>
          <button
            onClick={onClearRequestHistory}
            className={UI_STYLES.btnClearAction}
          >
            🗑️ 依頼履歴全クリア
          </button>
        </div>
      </div>
    </div>
  );
}
