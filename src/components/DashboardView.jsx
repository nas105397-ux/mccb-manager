import { useEffect, useState } from 'react';

const API_URL = '/api/mccb';
const POLL_INTERVAL = 15000; // 15秒ごとに自動更新

export default function DashboardView() {
  const [data, setData] = useState({ mccbList: [], logs: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [timeStr, setTimeStr] = useState('');

  // 💡 ダークモード状態の初期値を localStorage から復元
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('dashboard_is_dark_mode');
    return savedMode !== null ? savedMode === 'true' : true;
  });

  // 💡 表示列数の初期値を localStorage から復元
  const [colLayout, setColLayout] = useState(() => {
    return localStorage.getItem('dashboard_col_layout') || 'auto';
  });

  // 💡 ダークモードの変更を感知して localStorage に自動保存
  useEffect(() => {
    localStorage.setItem('dashboard_is_dark_mode', isDarkMode);
  }, [isDarkMode]);

  // 💡 表示列数の変更を感知して localStorage に自動保存
  useEffect(() => {
    localStorage.setItem('dashboard_col_layout', colLayout);
  }, [colLayout]);

  // 時計のリアルタイム更新
  useEffect(() => {
    const updateTime = () => {
      setTimeStr(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const clockTimer = setInterval(updateTime, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // データの自動ポーリング
  useEffect(() => {
    const fetchData = () => {
      fetch(API_URL)
        .then((res) => res.json())
        .then((latest) => {
          if (latest) {
            setData({
              mccbList: latest.mccbList || [],
              logs: latest.logs || [],
              requests: latest.requests || []
            });
          }
          setLoading(false);
        })
        .catch((err) => console.error("監視データ同期エラー:", err));
    };

  // 💡 隔離ルーティング統合に伴い、コンポーネントがマウント（実体化）された瞬間に即時初回取得
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // MccbCard.jsx と同じ区分カラーマッピング関数
  const getCategoryBadgeClass = (category) => {
    const categoryColors = {
      '1スト': 'bg-white text-gray-900 border-gray-300 shadow-sm',
      '2スト': 'bg-black text-white border-gray-700',
      '3スト': 'bg-red-600 text-white border-red-600',
      '4スト': 'bg-blue-600 text-white border-blue-600',
      '5スト': 'bg-yellow-400 text-gray-900 border-yellow-400',
      '6スト': 'bg-green-600 text-white border-green-600',
      '共通': 'bg-gray-100 text-gray-700 border-gray-300',
    };

    const defaultClass = isDarkMode 
      ? 'bg-gray-800 text-gray-300 border-gray-700' 
      : 'bg-gray-50 text-gray-600 border-gray-200';

    return categoryColors[category] ? `border ${categoryColors[category]}` : defaultClass;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-950 text-white flex items-center justify-center font-black tracking-widest text-3xl animate-pulse">
        📡 電気室 監視システム 同期中...
      </div>
    );
  }

  const activeOffMccbs = data.mccbList.filter(m => m.isPowerOff);
  const totalCount = data.mccbList.length;
  const onCount = data.mccbList.filter(m => !m.isPowerOff).length;
  const offCount = activeOffMccbs.length;

  const totalBorrowedCards = data.mccbList.reduce((acc, mccb) => {
    return acc + (mccb.childCards?.filter(c => c.isBorrowed).length || 0);
  }, 0);

  return (
    <div className={`fixed inset-0 h-screen w-screen p-5 font-sans flex flex-col overflow-hidden box-border select-none m-0 transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-100 text-gray-800'
    }`}>
      
      {/* 🔝 1. ヘッダーエリア */}
      <div className={`flex justify-between items-center border-b-2 pb-3 mb-4 shrink-0 ${
        isDarkMode ? 'border-gray-800' : 'border-gray-300'
      }`}>
        <div className="flex items-center gap-4 lg:gap-6 flex-wrap">
          <div>
            <h1 className={`text-3xl lg:text-4xl font-black tracking-widest ${
              isDarkMode ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400' : 'text-blue-900'
            }`}>
              🏢 RCC 禁止札監視モニター
            </h1>
            <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              ※本画面は {POLL_INTERVAL / 1000}秒 間隔で自動同期されています
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-4 py-2 rounded-xl text-xs font-black shadow-md border cursor-pointer transition-all flex items-center gap-1.5 shrink-0 h-9 transform active:scale-95 ${
                isDarkMode 
                  ? 'bg-gray-900 border-gray-700 text-amber-400 hover:bg-gray-800' 
                  : 'bg-white border-gray-300 text-blue-950 hover:bg-gray-50'
              }`}
            >
              {isDarkMode ? '☀️ ライトモード' : '🌙 ダークモード'}
            </button>

            {/* 表示列数コントローラースイッチ */}
            <div className={`flex items-center gap-1 border rounded-xl p-1 shrink-0 shadow-md h-9 ${
              isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
            }`}>
              <span className="text-[10px] font-black px-2 text-gray-500 tracking-tighter uppercase">🎛️ 表示列数:</span>
              {['auto', '3', '4', '5'].map((col) => (
                <button
                  key={col}
                  onClick={() => setColLayout(col)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer h-full flex items-center transform active:scale-95 ${
                    colLayout === col
                      ? (isDarkMode ? 'bg-teal-500 text-gray-950 shadow-sm' : 'bg-blue-600 text-white shadow-sm')
                      : (isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100')
                  }`}
                >
                  {col === 'auto' ? '自動' : `${col}列`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`border px-6 py-2 rounded-xl text-right shadow-lg transition-colors shrink-0 ${
          isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <span className="text-xs text-gray-500 font-bold block tracking-wider">CURRENT TIME</span>
          <span className={`font-mono text-3xl font-black tracking-wider transition-colors ${
            isDarkMode ? 'text-teal-400' : 'text-blue-600'
          }`}>
            {timeStr}
          </span>
        </div>
      </div>

      {/* 🔄 2. メインレイアウト */}
      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden mb-1">
        
        {/* 🛑 左側：現在操作禁止（停電対応中）設備一覧 */}
        <div className={`flex-1 border rounded-2xl p-5 flex flex-col min-h-0 overflow-hidden shadow-2xl transition-colors ${
          isDarkMode ? 'bg-gray-900/60 border-gray-850' : 'bg-white border-gray-200'
        }`}>
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h2 className={`text-2xl font-black flex items-center gap-3 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
              {/* 💡 負荷対策: アニメーション要素を別レイヤーに隔離してレンダリング詰まりを完全防止 */}
              <span className="animate-ping inline-flex h-3 w-3 rounded-full bg-red-500 opacity-75 will-change-transform"></span>
              🛑 現在操作禁止（停電対応中）設備一覧
            </h2>
            <span className={`text-sm border px-4 py-0.5 rounded-full font-black tracking-wider ${
              isDarkMode ? 'bg-red-950 text-red-400 border-red-900' : 'bg-red-50 text-red-600 border-red-200'
            }`}>
              対象: {offCount} 件
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {offCount === 0 ? (
              <div className={`h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl space-y-4 ${
                isDarkMode ? 'text-gray-500 border-gray-800 bg-gray-900/30' : 'text-gray-400 border-gray-300 bg-gray-50'
              }`}>
                <span className="text-6xl animate-pulse will-change-transform">🟢</span>
                <p className={`text-2xl font-black tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  現在、操作禁止（停電）設定中の設備はありません
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>全系統、通常送電運用中</p>
              </div>
            ) : (
              <div className={`grid gap-4 pb-2 transition-all duration-300 ${
                colLayout === 'auto' ? 'grid-cols-[repeat(auto-fill,minmax(330px,1fr))]' :
                colLayout === '3'    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                colLayout === '4'    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
                                       'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              }`}>
                {activeOffMccbs.map((mccb) => {
                  const workers = mccb.childCards?.filter(c => c.isBorrowed) || [];
                  
                  let displayName = mccb.name;
                  let isAlternative = false;

                  // 依頼データが存在する場合のみ安全にループ処理
                  if (data.requests && Array.isArray(data.requests)) {
                    data.requests.forEach(req => {
                      if (req.reservedCards) {
                        Object.keys(req.reservedCards).forEach(originalId => {
                          const resInfo = req.reservedCards[originalId];
                          if (resInfo && resInfo.actualMccbId === mccb.id) {
                            if (originalId !== mccb.id) {
                              const originalMccb = data.mccbList.find(m => m.id === originalId);
                              if (originalMccb) {
                                displayName = `${mccb.name} (${originalMccb.name})`;
                                isAlternative = true;
                              }
                            } else if (resInfo.customDummyName) {
                              displayName = `${mccb.name} (${resInfo.customDummyName})`;
                              isAlternative = true;
                            }
                          }
                        });
                      }
                    });
                  }

                  return (
                    <div 
                      key={mccb.id} 
                      /* 💡 負荷対策: will-change-transform をカード単位に適用し、
                         3秒ごとの再描画プロセスをラズパイ5のGPUに直接処理させてCPUのオーバーヘッドを削減 */
                      className={`border-4 rounded-xl p-5 shadow-xl flex flex-col justify-between min-h-[200px] transition-colors will-change-transform ${
                        isDarkMode 
                          ? 'from-gray-800 to-gray-850 bg-gradient-to-b border-red-600' 
                          : 'bg-red-50/40 border-red-500'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className={`text-xs border px-2.5 py-0.5 rounded font-black truncate ${
                            isDarkMode ? 'bg-gray-950 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-600'
                          }`}>
                            {mccb.room}
                          </span>
                          
                          <span className={`text-xs px-2.5 py-0.5 rounded font-black shrink-0 ${getCategoryBadgeClass(mccb.category)}`}>
                            {mccb.category}
                          </span>
                        </div>

                        <h3 className={`text-2xl font-black tracking-wide border-b-2 pb-2 mb-3 truncate ${
                          isAlternative ? (isDarkMode ? 'text-amber-400 font-extrabold' : 'text-orange-400 font-extrabold') : (isDarkMode ? 'text-white' : 'text-gray-900')
                        } ${isDarkMode ? 'border-gray-700' : 'border-red-200'}`}>
                          {displayName}
                        </h3>
                        
                        <div className="space-y-1.5">
                          <p className={`text-xs font-extrabold tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            ▼ 子札保持者:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {workers.length === 0 ? (
                              <span className={`text-xs font-black px-2.5 py-1 rounded animate-pulse border will-change-transform ${
                                isDarkMode ? 'bg-amber-950/40 border-amber-900 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
                              }`}>
                                ⚠️ 札登録なし（直接操作ロック中）
                              </span>
                            ) : (
                              workers.map((card) => (
                                <span 
                                  key={card.id} 
                                  className={`text-sm border-2 px-3 py-1 rounded font-black flex items-center gap-2 shadow-md ${
                                    isDarkMode ? 'bg-gray-950 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-800'
                                  }`}
                                >
                                  <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                                    isDarkMode ? 'bg-amber-950 text-amber-400' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    No.{card.id}
                                  </span>
                                  {card.workerName}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`mt-4 pt-2 border-t flex justify-between items-center text-[10px] font-mono ${
                        isDarkMode ? 'border-gray-700/60 text-gray-500' : 'border-red-200 text-gray-400'
                      }`}>
                        <span>ID: {mccb.id}</span>
                        <span className={`px-1.5 py-0.5 rounded font-black border ${
                          isDarkMode ? 'bg-red-950 text-red-500 border-red-900/40' : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          CRITICAL LOCK
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 📊 右側：システムカウンターサマリー ＆ 操作ログ */}
        <div className="w-[380px] flex flex-col gap-4 shrink-0 min-h-0 overflow-hidden">
          
          {/* サマリーメーター */}
          <div className={`border rounded-2xl p-4 grid grid-cols-2 gap-3 shrink-0 shadow-lg transition-colors will-change-transform ${
            isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <div className={`p-3 rounded-xl border text-center ${isDarkMode ? 'bg-gray-850 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`text-xs font-black block mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>🟢 送電中</span>
              <span className="text-3xl font-mono font-black text-green-500 tracking-tight">{onCount}</span>
              <span className="text-[10px] text-gray-500 block mt-0.5">/ 全 {totalCount} 面</span>
            </div>
            <div className={`p-3 rounded-xl border text-center ${isDarkMode ? 'bg-gray-850 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`text-xs font-black block mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>🛑 停電中</span>
              <span className="text-3xl font-mono font-black text-red-500 tracking-tight">{offCount}</span>
              <span className="text-[10px] text-gray-500 block mt-0.5">/ 全 {totalCount} 面</span>
            </div>
            <div className={`p-3 rounded-xl border text-center col-span-2 ${isDarkMode ? 'bg-gray-850 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`text-xs font-black block mb-1 tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                🔖 発行中の子札総数
              </span>
              <span className={`text-3xl font-mono font-black tracking-tight ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                {totalBorrowedCards} <span className="text-xs font-sans font-black text-gray-400">枚</span>
              </span>
            </div>
          </div>

          {/* 操作ログ履歴タイムライン */}
          <div className={`border rounded-2xl p-4 flex flex-col min-h-0 overflow-hidden shadow-lg transition-colors ${
            isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <h2 className={`text-xs font-black mb-2 border-b pb-1.5 flex items-center gap-2 tracking-wider ${
              isDarkMode ? 'text-gray-400 border-gray-800' : 'text-gray-600 border-gray-200'
            }`}>
              📜 直近のシステム操作アクティビティ
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] font-mono min-h-0">
              {data.logs && Array.isArray(data.logs) && data.logs.slice(0, 40).map((log) => {
                const isOff = log.message && (log.message.includes('🛑') || log.message.includes('停電'));
                return (
                  <div 
                    key={log.id} 
                    className={`p-2.5 rounded border-l-4 shadow-sm transition-colors ${
                      isDarkMode 
                        ? 'bg-gray-850 border-gray-700 hover:bg-gray-800 shadow-none' 
                        : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span className="font-bold">[{log.type}]</span>
                      <span>{log.timestamp ? (log.timestamp.split(' ')[1] || log.timestamp) : ''}</span>
                    </div>
                    <p className={`font-black leading-relaxed text-xs ${
                      isOff 
                        ? (isDarkMode ? 'text-red-300' : 'text-red-700') 
                        : (isDarkMode ? 'text-gray-300' : 'text-gray-700')
                    }`}>
                      {log.message}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}