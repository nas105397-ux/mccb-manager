export default function StatusMessageRail({ message, onClose }) {
  if (!message) return null;

  const isSuccess = message.type === "success";

  return (
    <aside className="pointer-events-none fixed left-4 top-24 z-[60] w-72 max-w-[calc(100vw-2rem)] print:hidden">
      <div
        className={`pointer-events-auto overflow-hidden rounded-xl border bg-white shadow-lg ${
          isSuccess ? "border-emerald-100" : "border-amber-100"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 border-b px-4 py-2 ${
            isSuccess
              ? "border-emerald-50 bg-emerald-50"
              : "border-amber-50 bg-amber-50"
          }`}
        >
          <div className="text-left">
            <p
              className={`text-[10px] font-black tracking-wide ${
                isSuccess ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              STATUS MESSAGE
            </p>
            <p className="text-sm font-black leading-tight text-gray-800">
              操作メモ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`grid h-7 w-7 place-items-center rounded-lg border bg-white text-xs font-black cursor-pointer ${
              isSuccess
                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "border-amber-200 text-amber-700 hover:bg-amber-100"
            }`}
            aria-label="メッセージを閉じる"
            title="閉じる"
          >
            ×
          </button>
        </div>

        <div
          className={`px-4 py-3 text-left text-xs font-bold leading-relaxed ${
            isSuccess ? "text-emerald-900" : "text-amber-900"
          }`}
        >
          {message.text}
        </div>
      </div>
    </aside>
  );
}
