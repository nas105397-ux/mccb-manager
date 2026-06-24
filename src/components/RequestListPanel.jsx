import { useState, useMemo, useCallback } from 'react';

export default function RequestListPanel({ requests = [], requestHistory = [], mccbList = [], onDeleteRequest }) {
  // 各依頼カードの展開状況を管理 { [reqId]: boolean }
  const [expandedRequests, setExpandedRequests] = useState({});

  // 💡 【高速化の核心】設備IDから設備オブジェクトをO(1)で即時引きせるMapを事前構築
  // これにより、ネストされた大ループ内での mccbList.find(...) による性能低下を完全に防ぎます
  const mccbMap = useMemo(() => {
    return new Map(mccbList.map(mccb => [mccb.id, mccb]));
  }, [mccbList]);

  // 💡 ハンドラの再生成を防止
  const toggleExpand = useCallback((id) => {
    setExpandedRequests((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[60vh]">
      <h2 className="text-lg font-black text-gray-800 border-b pb-3 mb-4">
        📋 停電依頼 一覧・進捗状況
      </h2>
      
      {/* ====================================================
          SECTION 1: 進行中の停電作業依頼一覧
          ==================================================== */}
      {requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-xl border border-dashed">
          現在、発行されている停電依頼はありません。
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            // MapからO(1)で状態チェック
            const isAllPowerOff = req.targetMccbIds.length > 0 && req.targetMccbIds.every((id) => {
              const targetMccb = mccbMap.get(id);
              return targetMccb ? targetMccb.isPowerOff : false;
            });

            const isExpanded = !!expandedRequests[req.id];

            return (
              <div key={req.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-all">
                
                {/* 依頼の基本情報ヘッダー */}
                <div className="flex flex-wrap justify-between items-start mb-3 border-b border-gray-200 pb-3 gap-2">
                  <div>
                    <span className="text-xs text-gray-400 font-bold">{req.timestamp} 発行</span>
                    <h3 className="text-base font-black text-blue-800 mt-1 flex items-center gap-2 flex-wrap">
                      👷 {req.workerName} <span className="text-xs font-normal text-gray-600">氏からの依頼</span>
                      
                      {isAllPowerOff && (
                        <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider shadow-sm shrink-0 animate-pulse">
                          🔴 停電完了
                        </span>
                      )}
                    </h3>
                    {req.workContent && (
                      <p className="text-xs text-gray-500 mt-1 font-medium">内容: {req.workContent}</p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => onDeleteRequest(req.id)}
                    className="bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  >
                    解約・作業完了 (札解放)
                  </button>
                </div>

                {/* 紐付く設備リストトグルアコーディオン */}
                <div className="space-y-2">
                  <div 
                    onClick={() => toggleExpand(req.id)}
                    className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer hover:text-gray-700 w-fit select-none"
                    title={isExpanded ? "クリックで非表示" : "クリックで表示"}
                  >
                    <span>{isExpanded ? '▼' : '▶'} 停電対象設備一覧 ({req.targetMccbIds.length}面)</span>
                    <span className="text-[10px] font-normal text-gray-400 opacity-80">
                      {isExpanded ? '[ クリックで折りたたむ ]' : '[ クリックで展開する ]'}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="grid grid-cols-1 gap-2 transition-all duration-200">
                      {req.targetMccbIds.map((targetId) => {
                        const targetMccb = mccbMap.get(targetId);
                        if (!targetMccb) return null;
                        
                        const reserveInfo = req.reservedCards?.[targetId];
                        const mccbDisplayName = reserveInfo?.customDummyName
                          ? `${targetMccb.name} (${reserveInfo.customDummyName})`
                          : targetMccb.name;

                        return (
                          <div key={targetId} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 text-xs font-bold shadow-sm">
                            <div className="flex items-center gap-2 truncate">
                              <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded border">{targetMccb.room}</span>
                              <span className="text-gray-800 truncate">{mccbDisplayName}</span>
                              
                              {reserveInfo?.cardNo ? (
                                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-black shadow-sm ml-1">
                                  🔖 確保札: {reserveInfo.displayName} No.{reserveInfo.cardNo}
                                </span>
                              ) : (
                                <span className="bg-gray-100 text-gray-400 border border-gray-200 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1">
                                  札の空きなし
                                </span>
                              )}
                            </div>

                            {targetMccb.isPowerOff ? (
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-black border border-red-200 shadow-sm shrink-0">
                                🔴 停電対応 完了
                              </span>
                            ) : (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-black border border-green-200 shadow-sm animate-pulse shrink-0">
                                🟢 送電中 (未対応)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================
          SECTION 2: 作業完了・解約の歴史を記録する履歴一覧
          ==================================================== */}
      <div className="mt-12 pt-6 border-t border-gray-300">
        <h3 className="text-base font-black text-gray-700 mb-4 flex items-center gap-2">
          📜 作業完了・解約 履歴一覧 
          <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border font-bold">
            {requestHistory.length} 件
          </span>
        </h3>

        {requestHistory.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed text-xs">
            過去の完了および解約履歴はありません。
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {requestHistory.map((req) => {
              const isExpanded = !!expandedRequests[req.id];

              return (
                <div key={req.id} className="border border-gray-200 rounded-lg p-3.5 bg-white shadow-sm hover:border-gray-300 transition-colors">
                  
                  {/* 過去ログヘッダースタンプ */}
                  <div className="flex flex-wrap justify-between items-start border-b border-gray-100 pb-2 mb-2 gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-gray-400 font-bold">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded border">🛫 発行: {req.timestamp}</span>
                        <span className="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                          🛬 完了: {req.completedTimestamp}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-gray-700 mt-1.5">
                        Constructed by 👷 {req.workerName} <span className="text-xs font-normal text-gray-500">氏の作業履歴</span>
                      </h4>
                      {req.workContent && (
                        <p className="text-xs text-gray-400 mt-0.5 font-medium">内容: {req.workContent}</p>
                      )}
                    </div>
                    <span className="bg-gray-50 border border-gray-200 text-gray-400 text-[10px] font-black tracking-wide px-2 py-1 rounded shadow-inner">
                      ✓ 対応済
                    </span>
                  </div>

                  {/* 過去設備詳細トグル */}
                  <div className="space-y-1">
                    <div 
                      onClick={() => toggleExpand(req.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-gray-400 cursor-pointer hover:text-gray-600 w-fit select-none"
                    >
                      <span>{isExpanded ? '▼' : '▶'} 当時の対象設備 ({req.targetMccbIds.length}面)</span>
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-1 gap-1.5 mt-1.5 transition-all">
                        {req.targetMccbIds.map((targetId) => {
                          const targetMccb = mccbMap.get(targetId);
                          if (!targetMccb) return null;
                          
                          const reserveInfo = req.reservedCards?.[targetId];
                          const mccbDisplayName = reserveInfo?.customDummyName
                            ? `${targetMccb.name} (${reserveInfo.customDummyName})`
                            : targetMccb.name;

                          return (
                            <div key={targetId} className="flex items-center justify-between bg-gray-50/50 px-2 py-1.5 rounded border border-gray-150 text-[11px] font-bold">
                              <div className="flex items-center gap-2 truncate">
                                <span className="bg-white text-gray-400 text-[9px] px-1 rounded border">{targetMccb.room}</span>
                                <span className="text-gray-600 truncate">{mccbDisplayName}</span>
                                
                                {reserveInfo?.cardNo && (
                                  <span className="bg-white text-gray-400 border border-gray-200 text-[9px] px-1 rounded font-normal">
                                    🔖 使用札: {reserveInfo.displayName} No.{reserveInfo.cardNo}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}