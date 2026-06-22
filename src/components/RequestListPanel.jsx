import { useState } from 'react'; // 💡 折りたたみ状態を管理するために useState をインポート

export default function RequestListPanel({ requests = [], mccbList = [], onDeleteRequest }) {
  // 💡 各依頼の展開（表示）状態を管理するローカルステート
  // 初期値を空のオブジェクトにすることで、デフォルトで「すべて非表示（閉じている）」状態にします
  const [expandedRequests, setExpandedRequests] = useState({});

  const toggleExpand = (id) => {
    setExpandedRequests((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[60vh]">
      <h2 className="text-lg font-black text-gray-800 border-b pb-3 mb-4">
        📋 停電依頼 一覧・進捗状況
      </h2>
      
      {requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-xl border border-dashed">
          現在、発行されている停電依頼はありません。
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            // この依頼に含まれるすべての設備が停電中(isPowerOff === true)かどうかを判定
            const isAllPowerOff = req.targetMccbIds.length > 0 && req.targetMccbIds.every((id) => {
              const targetMccb = mccbList.find(m => m.id === id);
              return targetMccb ? targetMccb.isPowerOff : false;
            });

            // 💡 true のときだけ展開表示するフラグ
            const isExpanded = !!expandedRequests[req.id];

            return (
              <div key={req.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-all">
                
                <div className="flex flex-wrap justify-between items-start mb-3 border-b border-gray-200 pb-3 gap-2">
                  <div>
                    <span className="text-xs text-gray-400 font-bold">{req.timestamp} 発行</span>
                    <h3 className="text-base font-black text-blue-800 mt-1 flex items-center gap-2 flex-wrap">
                      👷 {req.workerName} <span className="text-xs font-normal text-gray-600">氏からの依頼</span>
                      
                      {/* すべての設備が停電できたら「🛑 停電完了」バッジを表示 */}
                      {isAllPowerOff && (
                        <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider shadow-sm shrink-0 animate-pulse">
                          🛑 停電完了
                        </span>
                      )}
                    </h3>
                    {req.workContent && (
                      <p className="text-xs text-gray-500 mt-1 font-medium">内容: {req.workContent}</p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => onDeleteRequest(req.id)}
                    className="bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    解約・作業完了 (札解放)
                  </button>
                </div>

                {/* 💡 デザインは完全に維持し、初期状態を非表示に制御 */}
                <div className="space-y-2">
                  <div 
                    onClick={() => toggleExpand(req.id)}
                    className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer hover:text-gray-700 w-fit select-none"
                    title={isExpanded ? "クリックで非表示" : "クリックで表示"}
                  >
                    {/* 開閉状態に応じて矢印（▼/▶）とガイダンス文字を動的に切り替え */}
                    <span>{isExpanded ? '▼' : '▶'} 停電対象設備一覧 ({req.targetMccbIds.length}面)</span>
                    <span className="text-[10px] font-normal text-gray-400 opacity-80">
                      {isExpanded ? '[ クリックで折りたたむ ]' : '[ クリックで展開する ]'}
                    </span>
                  </div>

                  {/* 💡 表示ステート(isExpanded)が true のときだけ一覧を綺麗に描画 */}
                  {isExpanded && (
                    <div className="grid grid-cols-1 gap-2 transition-all duration-200">
                      {req.targetMccbIds.map((targetId) => {
                        const targetMccb = mccbList.find(m => m.id === targetId);
                        if (!targetMccb) return null;
                        const reserveInfo = req.reservedCards?.[targetId];

                        // 💡 【新機能】手動で選んだダミー設備に代替名称が記入されている場合、かっこ書きで動的に結合
                        const mccbDisplayName = reserveInfo?.customDummyName
                          ? `${targetMccb.name} (${reserveInfo.customDummyName})`
                          : targetMccb.name;

                        return (
                          <div key={targetId} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 text-xs font-bold shadow-sm">
                            <div className="flex items-center gap-2 truncate">
                              <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded border">{targetMccb.room}</span>
                              {/* 💡 代替名が反映された名称を表示 */}
                              <span className="text-gray-800 truncate">{mccbDisplayName}</span>
                              
                              {reserveInfo && reserveInfo.cardNo ? (
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
                                🛑 停電対応 完了
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
    </div>
  );
}