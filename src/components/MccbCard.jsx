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

  // 依頼発行中の設備かどうかを判定し、カード見た目の強調に使用
  const hasActiveRequest = React.useMemo(() => {
    if (!requests?.length) return false;

    return requests.some(({ reservedCards }) => {
      if (!reservedCards) return false;

      return Object.entries(reservedCards).some(([originalMccbId, resInfo]) => {
        if (!resInfo) return false;
        return originalMccbId === mccbId || resInfo.actualMccbId === mccbId;
      });
    });
  }, [mccbId, requests]);

  const badgeColor = CATEGORY_COLORS[category] || 'bg-gray-50 text-gray-600 border-gray-200';

  // キーボードでのエンターキー押下ハンドラ
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSelect) onSelect(mccbId);
  };

  return (
    <div
      onClick={() => onSelect && onSelect(mccbId)}
      className={`bg-white p-4 rounded-xl border shadow-sm relative flex flex-col justify-between min-h-[140px] transition-all duration-200 hover:shadow-md cursor-pointer will-change-transform ${
        isPowerOff
          ? 'border-red-500 bg-red-50/20 hover:border-red-500 ring-2 ring-red-200/70'
          : hasActiveRequest
            ? 'border-amber-500 bg-amber-50/20 hover:border-amber-500 ring-2 ring-amber-200/70'
            : 'border-gray-300 bg-gray-50/20 hover:border-gray-400 ring-2 ring-gray-200/70'
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
        ) : hasActiveRequest ? (
          <>
            <span className="text-amber-700 flex items-center gap-1 shrink-0">🟠 依頼発行中</span>
            <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 font-mono">
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
    prevProps?.requests === nextProps?.requests
  );
});