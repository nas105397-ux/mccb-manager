// 操作結果メッセージを画面端に一時表示する通知レール。
// success はエメラルド、それ以外（注意喚起メッセージ）はアンバーで表示する。
const TONE_STYLES = {
  success: {
    border: "border-emerald-100",
    header: "border-emerald-50 bg-emerald-50",
    eyebrow: "text-emerald-600",
    closeButton: "border-emerald-200 text-emerald-700 hover:bg-emerald-100",
    body: "text-emerald-900",
  },
  default: {
    border: "border-amber-100",
    header: "border-amber-50 bg-amber-50",
    eyebrow: "text-amber-600",
    closeButton: "border-amber-200 text-amber-700 hover:bg-amber-100",
    body: "text-amber-900",
  },
};

export default function StatusMessageRail({ message, onClose }) {
  if (!message) return null;

  const tone = TONE_STYLES[message.type] ?? TONE_STYLES.default;

  return (
    <aside className="pointer-events-none fixed left-4 top-24 z-[60] w-72 max-w-[calc(100vw-2rem)] print:hidden">
      <div
        className={`pointer-events-auto overflow-hidden rounded-xl border bg-white shadow-lg ${tone.border}`}
      >
        <div
          className={`flex items-center justify-between gap-3 border-b px-4 py-2 ${tone.header}`}
        >
          <div className="text-left">
            <p className={`text-[10px] font-black tracking-wide ${tone.eyebrow}`}>
              STATUS MESSAGE
            </p>
            <p className="text-sm font-black leading-tight text-gray-800">
              操作メモ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`grid h-7 w-7 place-items-center rounded-lg border bg-white text-xs font-black cursor-pointer ${tone.closeButton}`}
            aria-label="メッセージを閉じる"
            title="閉じる"
          >
            ×
          </button>
        </div>

        <div
          className={`px-4 py-3 text-left text-xs font-bold leading-relaxed ${tone.body}`}
        >
          {message.text}
        </div>
      </div>
    </aside>
  );
}
