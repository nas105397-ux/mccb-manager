// 画面別の操作ガイドを右側に表示する補助パネル。
import { GUIDE_CONTENT } from "../shared/operationGuideContent";

export default function OperationGuideSidebar({ isOpen, onClose, guideType = "operation" }) {
  if (!isOpen) return null;

  const guide = GUIDE_CONTENT[guideType] || GUIDE_CONTENT.operation;

  return (
    <aside className="fixed inset-y-4 right-4 z-40 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-blue-100 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-blue-50 bg-blue-50 px-4 py-3">
        <div className="text-left">
          <p className="text-[11px] font-black text-blue-500 tracking-wide">
            {guide.eyebrow}
          </p>
          <h2 className="text-base font-black text-gray-900 leading-tight">
            {guide.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg border border-blue-200 bg-white text-sm font-black text-blue-700 cursor-pointer hover:bg-blue-100"
          aria-label="操作説明を閉じる"
          title="閉じる"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 text-left">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-900">
          {guide.notice}
        </div>

        <div className="mt-4 space-y-4">
          {guide.sections.map((section, sectionIndex) => (
            <section key={section.title} className="border-b border-gray-100 pb-4 last:border-b-0">
              <h3 className="flex items-center gap-2 text-sm font-black text-gray-800">
                <span className="grid h-6 w-6 place-items-center rounded bg-gray-900 text-[11px] text-white">
                  {sectionIndex + 1}
                </span>
                {section.title}
              </h3>
              <ul className="mt-2 space-y-2 text-xs font-bold leading-relaxed text-gray-600">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
