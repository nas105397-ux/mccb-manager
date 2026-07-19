import { REQUEST_PRINT_MODE_OPTIONS } from "../../shared/printSettings";
import { UI_STYLES } from "./adminStyles";

// 依頼表の印刷方式（スター精密レシート／ブラウザ印刷／印刷なし）の選択。
export default function PrintModePanel({
  currentRequestPrintMode,
  onChangeRequestPrintMode,
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <h3 className={UI_STYLES.labelSubsection}>依頼表 印刷方式</h3>
      <div className="mt-3 space-y-2">
        {REQUEST_PRINT_MODE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex items-start gap-3 rounded-lg border p-3 text-xs cursor-pointer transition-all ${
              currentRequestPrintMode === option.value
                ? "border-blue-300 bg-blue-50/60 text-blue-900"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="requestPrintMode"
              value={option.value}
              checked={currentRequestPrintMode === option.value}
              onChange={() => onChangeRequestPrintMode(option.value)}
              className="mt-0.5 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block font-black">{option.label}</span>
              <span className="mt-1 block leading-relaxed text-gray-500">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-bold text-gray-400">
        この設定は使用中のブラウザに保存されます。端末ごとに印刷方式を切り替えできます。
      </p>
    </div>
  );
}
