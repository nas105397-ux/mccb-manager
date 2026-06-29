import { usePrintPreviewController } from "../hooks/usePrintPreviewController";

// ==========================================
// メインコンポーネント
// ==========================================
export default function PrintPreviewForm({
  workerName,
  workContent,
  selectedMccbIds,
  dummyNames = {},
}) {
  const {
    now,
    dateCode,
    selectedMccbsWithAssignedCards,
    isPreviewLoading,
    previewError,
  } = usePrintPreviewController({
    workerName,
    workContent,
    selectedMccbIds,
    dummyNames,
  });

  return (
    <div className="w-full lg:w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 print:border-0 print:shadow-none print:p-0 print:w-[78mm] print:mx-auto">
      {/* レシート外枠：高コントラスト現場用デザイン */}
      <div className="border border-gray-300 p-4 space-y-4 text-black bg-white print:border-0 print:p-1 font-mono text-xs">
        {/* 🔝 レシートヘッダー */}
        <div className="text-center border-b-2 border-black pb-2 mb-2">
          <h1 className="text-base font-black tracking-tighter">
            操作禁止（停電）依頼表
          </h1>
          <p className="text-[9px] text-gray-500 print:text-black mt-0.5">
            ※作業終了後、管理室へ返却
          </p>
          <div className="flex justify-between text-[10px] mt-2 border-t border-dashed border-gray-400 pt-1">
            <span>
              日付: {now.getFullYear()}/{now.getMonth() + 1}/{now.getDate()}
            </span>
            <span>No: REQ-{dateCode}</span>
          </div>
        </div>

        {/* 👷 責任者・内容情報 */}
        <div className="space-y-1 bg-gray-50 p-2 rounded border print:bg-transparent print:border-black">
          <p className="text-[10px] font-bold text-gray-500">【作業責任者】</p>
          <p className="text-sm font-black pl-1">
            {workerName || "（未入力）"}
          </p>
          <p className="text-[10px] font-bold text-gray-500 mt-1">
            【作業内容】
          </p>
          <p className="text-xs pl-1 leading-tight whitespace-pre-wrap">
            {workContent || "（未入力）"}
          </p>
        </div>

        {/* 📊 停電対象設備サマリーリスト */}
        <div className="border-t border-black pt-2">
          <p className="text-[10px] font-black mb-1">▼ 停電対象設備一覧</p>
          <div className="space-y-1 border-b border-black pb-2">
            {isPreviewLoading ? (
              <p className="text-gray-400 text-center py-2">
                プレビュー作成中...
              </p>
            ) : previewError ? (
              <p className="text-red-500 text-center py-2">{previewError}</p>
            ) : selectedMccbsWithAssignedCards.length === 0 ? (
              <p className="text-gray-400 text-center py-2">
                設備が未選択です。
              </p>
            ) : (
              selectedMccbsWithAssignedCards.map((mccb, index) => (
                <div
                  key={`${mccb.id}-${index}`}
                  className="flex justify-between items-start text-[11px] py-0.5 border-b border-dashed border-gray-200 last:border-0"
                >
                  <span className="font-bold truncate max-w-[200px]">
                    {index + 1}. {mccb.name}
                  </span>
                  <span className="font-black shrink-0 text-right bg-gray-100 px-1 rounded print:bg-transparent">
                    {mccb.cardLabel.replace("代替:", "代替:")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
