const GUIDE_SECTIONS = [
  {
    title: "画面の見方",
    items: [
      "緑は通常送電、赤は操作禁止、青は子札返却済みで送電可能な状態です。",
      "黄色の枠は依頼発行中の設備です。作業依頼と紐づいている可能性があります。",
      "上部の件数表示で、登録数・送電中・停電中の全体状況を確認できます。",
    ],
  },
  {
    title: "設備を探す",
    items: [
      "設備名称で検索すると、入力から少し待って一覧が絞り込まれます。",
      "電気室、状態、お気に入りを組み合わせて対象を絞り込めます。",
      "星マークを押すと、お気に入り登録と解除を切り替えられます。",
    ],
  },
  {
    title: "操作禁止の切り替え",
    items: [
      "設備カードをクリックすると操作画面が開きます。",
      "操作禁止にする時は、対象設備と子札枚数を確認して登録します。",
      "解除する時は、子札返却状況を確認してから送電状態へ戻します。",
    ],
  },
  {
    title: "依頼発行との関係",
    items: [
      "依頼発行画面で作成した対象は、一覧上で依頼発行中として表示されます。",
      "依頼一覧・進捗では、発行済み依頼や下書き、履歴を確認できます。",
      "印刷設定や台帳整理は管理者画面から変更できます。",
    ],
  },
];

export default function OperationGuideSidebar({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-4 right-4 z-40 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-blue-100 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-blue-50 bg-blue-50 px-4 py-3">
        <div className="text-left">
          <p className="text-[11px] font-black text-blue-500 tracking-wide">
            OPERATION GUIDE
          </p>
          <h2 className="text-base font-black text-gray-850 leading-tight">
            操作説明
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
          操作前に対象設備名、電気室、状態を必ず確認してください。
        </div>

        <div className="mt-4 space-y-4">
          {GUIDE_SECTIONS.map((section, sectionIndex) => (
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
