import React from 'react';

function MccbCard({ mccb, borrowedCount, onSelect, onToggleFavorite, requests = [] }) {
  
  // 💡 負荷対策: 停電中でなければ作業者は絶対に存在しないため、
  // 3秒ごとの同期や画面切り替え時に、この重い多重ループ計算を即座にスキップしてCPUを解放！
  const activeWorkers = React.useMemo(() => {
    if (!mccb.isPowerOff || !requests || requests.length === 0) return [];

    const workersMap = new Map();
    requests.forEach(req => {
      if (!req.reservedCards) return;
      
      Object.keys(req.reservedCards).forEach(originalMccbId => {
        const resInfo = req.reservedCards[originalMccbId];
        if (!resInfo) return;

        if (originalMccbId === mccb.id || resInfo.actualMccbId === mccb.id) {
          if (req.workerName) {
            workersMap.set(`${req.workerName}-${resInfo.cardNo}`, {
              id: resInfo.cardNo,
              workerName: req.workerName,
              isAlternative: resInfo.actualMccbId !== originalMccbId
            });
          }
        }
      });
    });

    return Array.from(workersMap.values());
  }, [mccb.id, mccb.isPowerOff, requests]); // 💡 依存配列に mccb.isPowerOff を追加

  const categoryColors = {
    '1スト': 'bg-white text-gray-900 border-gray-350 shadow-sm',
    '2スト': 'bg-black text-white border-black',
    '3スト': 'bg-red-600 text-white border-red-600',
    '4スト': 'bg-blue-600 text-white border-blue-600',
    '5スト': 'bg-yellow-400 text-gray-900 border-yellow-400',
    '6スト': 'bg-green-600 text-white border-green-600',
    '共通': 'bg-gray-100 text-gray-700 border-gray-300',
  };

  const badgeColor = categoryColors[mccb.category] || 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div
      onClick={onSelect}
      className={`bg-white p-4 rounded-xl border shadow-sm relative flex flex-col justify-between min-h-[140px] transition-all duration-200 hover:shadow-md hover:border-gray-400 cursor-pointer will-change-transform ${
        mccb.isPowerOff ? 'border-red-500 bg-red-50/10' : 'border-gray-200'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation(); 
          onToggleFavorite();
        }}
        className={`absolute top-3 right-3 text-lg transition-transform duration-200 transform hover:scale-125 focus:outline-none will-change-transform cursor-pointer z-10 ${
          mccb.isFavorite ? 'text-amber-500 font-bold drop-shadow-sm' : 'text-gray-300 hover:text-amber-400'
        }`}
        title={mccb.isFavorite ? "お気に入り解除" : "お気に入り登録"}
      >
        {mccb.isFavorite ? '★' : '☆'}
      </button>

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded font-bold">
            {mccb.room}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-black ${badgeColor}`}>
            {mccb.category}
          </span>
        </div>
        <h3 className="text-sm font-black text-gray-800 leading-snug line-clamp-2 mb-2 pr-6">
          {mccb.name}
        </h3>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs font-bold">
        {mccb.isPowerOff ? (
          <>
            <span className="text-red-600 flex items-center gap-1 shrink-0">🛑 操作禁止</span>
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

      {activeWorkers.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200">
          <p className="text-[10px] text-gray-400 font-bold mb-1">🛠️ 現在の作業者:</p>
          <div className="flex flex-wrap gap-1">
            {activeWorkers.map((card, idx) => (
              <span
                key={`${card.workerName}-${idx}`}
                className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                  card.isAlternative ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
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

// 💡 【重要】React.memoでラップし、データに変動がないカードは画面切り替え時の再計算を100%スキップ！
export default React.memo(MccbCard, (prevProps, nextProps) => {
  return (
    prevProps.mccb.id === nextProps.mccb.id &&
    prevProps.mccb.isPowerOff === nextProps.mccb.isPowerOff &&
    prevProps.mccb.isFavorite === nextProps.mccb.isFavorite &&
    prevProps.mccb.name === nextProps.mccb.name &&
    prevProps.borrowedCount === nextProps.borrowedCount &&
    prevProps.requests.length === nextProps.requests.length
  );
});