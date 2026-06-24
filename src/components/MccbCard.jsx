import React from 'react';

// ==========================================
// 1. コンポーネント外の定数定義 (メモリ節約)
// ==========================================
const CATEGORY_COLORS = {
  '1スト': 'bg-white text-gray-900 border-gray-350 shadow-sm',
  '2スト': 'bg-black text-white border-black',
  '3スト': 'bg-red-600 text-white border-red-600',
  '4スト': 'bg-blue-600 text-white border-blue-600',
  '5スト': 'bg-yellow-400 text-gray-900 border-yellow-400',
  '6スト': 'bg-green-600 text-white border-green-600',
  '共通': 'bg-gray-100 text-gray-700 border-gray-300',
};

// ==========================================
// 2. メインコンポーネント
// ==========================================
function MccbCard({ mccb, borrowedCount = 0, onSelect, onToggleFavorite, requests = [] }) {
  const { id: mccbId, isPowerOff, room, category, name, isFavorite } = mccb || {};

  // 💡 停電中でなければ作業者は存在しないため無駄な計算をせず早期リターン
  const activeWorkers = React.useMemo(() => {
    if (!isPowerOff || !requests?.length) return [];

    const workersMap = new Map();
    requests.forEach(({ reservedCards, workerName }) => {
      if (!reservedCards || !workerName) return;

      Object.entries(reservedCards).forEach(([originalMccbId, resInfo]) => {
        if (!resInfo) return;

        // 対象設備、または代替先として紐付いているかチェック
        if (originalMccbId === mccbId || resInfo.actualMccbId === mccbId) {
          workersMap.set(`${workerName}-${resInfo.cardNo}`, {
            id: resInfo.cardNo,
            workerName,
            isAlternative: resInfo.actualMccbId !== originalMccbId
          });
        }
      });
    });

    return Array.from(workersMap.values());
  }, [mccbId, isPowerOff, requests]);

  const badgeColor = CATEGORY_COLORS[category] || 'bg-gray-50 text-gray-600 border-gray-200';

  // キーボードでのエンターキー押下ハンドラ
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSelect) onSelect(mccbId);
  };

  return (
    <div
      onClick={() => onSelect && onSelect(mccbId)}
      className={`bg-white p-4 rounded-xl border shadow-sm relative flex flex-col justify-between min-h-[140px] transition-all duration-200 hover:shadow-md hover:border-gray-400 cursor-pointer will-change-transform ${
        isPowerOff ? 'border-red-500 bg-red-50/10' : 'border-gray-200'
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* ⭐ お気に入りトグルボタン */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite?.(mccbId, isFavorite);
        }}
        className={`absolute top-3 right-3 text-lg transition-transform duration-200 transform hover:scale-125 focus:outline-none will-change-transform cursor-pointer z-10 ${
          isFavorite ? 'text-amber-500 font-bold drop-shadow-sm' : 'text-gray-300 hover:text-amber-400'
        }`}
        title={isFavorite ? "お気に入り解除" : "お気に入り登録"}
        aria-label={isFavorite ? "お気に入りを外す" : "お気に入りに追加"}
      >
        {isFavorite ? '★' : '☆'}
      </button>

      {/* 📝 設置電気室・区分・設備名表示 */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded font-bold">
            {room}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-black ${badgeColor}`}>
            {category}
          </span>
        </div>
        <h3 className="text-sm font-black text-gray-800 leading-snug line-clamp-2 mb-2 pr-6">
          {name}
        </h3>
      </div>

      {/* ⚡ 下部ステータスバー */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs font-bold">
        {isPowerOff ? (
          <>
            <span className="text-red-600 flex items-center gap-1 shrink-0">🔴 操作禁止</span>
            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
              子札: {borrowedCount} 枚
            </span>
          </>
        ) : (
          <>
            <span className="text-green-600 flex items-center gap-1">🟢 通常送電</span>
            <span className="text-gray-400 font-normal">―</span>
          </>
        )}
      </div>

      {/* 🛠️ 現在現場で紐付いている作業者一覧 */}
      {activeWorkers.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200">
          <p className="text-[10px] text-gray-400 font-bold mb-1">🛠️ 現在の作業者:</p>
          <div className="flex flex-wrap gap-1">
            {activeWorkers.map((card, idx) => (
              <span
                key={`${card.workerName}-${card.id ?? idx}`}
                className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                  card.isAlternative 
                    ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                <span className="font-mono text-[9px] opacity-60">No.{card.id}</span>
                {card.workerName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. メモ化コンポーネントのエクスポート (差分レンダリング最適化)
// ==========================================
export default React.memo(MccbCard, (prevProps, nextProps) => {
  return (
    prevProps?.mccb?.id === nextProps?.mccb?.id &&
    prevProps?.mccb?.isPowerOff === nextProps?.mccb?.isPowerOff &&
    prevProps?.mccb?.isFavorite === nextProps?.mccb?.isFavorite &&
    prevProps?.mccb?.name === nextProps?.mccb?.name &&
    prevProps?.borrowedCount === nextProps?.borrowedCount &&
    (prevProps?.requests?.length ?? 0) === (nextProps?.requests?.length ?? 0)
  );
});