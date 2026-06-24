import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useMccbData } from './hooks/useMccbData';
import Header from './components/Header';
import AdminPanel from './components/AdminPanel';
import MccbCard from './components/MccbCard';
import ControlModal from './components/ControlModal';
import RequestFormPanel from './components/RequestFormPanel';
import RequestListPanel from './components/RequestListPanel';
import DashboardView from './components/DashboardView';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

function AppContent() {
  // --- 1. カスタムフックから状態と操作関数を抽出 ---
  const {
    mccbList, rooms, categories, updateMccb, saveMccbEntry, deleteMccb,
    importFromCSV, addRoom, updateRoom, deleteRoom,
    addCategory, updateCategory, deleteCategory,
    requests, requestHistory, historySettings, addRequest, deleteRequest, clearRequestHistory, changeMaxHistorySize,
    logs, logSettings, changeMaxLogSize, clearAllLogs,
    deviceGroups, addDeviceGroup, updateDeviceGroup, deleteDeviceGroup 
  } = useMccbData();

  // --- 2. 検索・フィルター・表示用のローカル状態 ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('すべて');
  const [filterRoom, setFilterRoom] = useState('すべて');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMccbId, setSelectedMccbId] = useState(null);
  const [selectedMccbCache, setSelectedMccbCache] = useState(null);

  // --- 3. ルーティング情報 ---
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname;

  // --- 4. 管理者モード切り替えハンドラ ---
  const handleToggleAdmin = () => {
    if (!isAdmin) {
      const password = window.prompt('管理者パスワードを入力してください：');
      if (password === 'admin') {
        setIsAdmin(true);
        alert('🔓 管理者認証に成功しました。');
      } else if (password !== null) {
        alert('❌ パスワードが正しくありません。認証に失敗しました。');
      }
    } else {
      setIsAdmin(false);
    }
  };

  // --- 5. 【高速化】データ処理・計算のキャッシュ化 (useMemo) ---

  // 💡 3重ループを解消：事前に「設備ID -> 追加すべき名称」の高速参照マップを作成
  const processedMccbList = useMemo(() => {
    const nameOverlayMap = new Map();

    requests.forEach(req => {
      if (!req.reservedCards) return;
      Object.entries(req.reservedCards).forEach(([originalId, resInfo]) => {
        if (!resInfo || !resInfo.actualMccbId) return;

        if (originalId !== resInfo.actualMccbId) {
          const originalMccb = mccbList.find(m => m.id === originalId);
          if (originalMccb) {
            nameOverlayMap.set(resInfo.actualMccbId, ` (${originalMccb.name})`);
          }
        } else if (resInfo.customDummyName) {
          nameOverlayMap.set(resInfo.actualMccbId, ` (${resInfo.customDummyName})`);
        }
      });
    });

    // マップを元に1段階のループで名称を合成
    return mccbList.map((mccb) => {
      const suffix = nameOverlayMap.get(mccb.id);
      return suffix ? { ...mccb, name: `${mccb.name}${suffix}` } : mccb;
    });
  }, [mccbList, requests]);

  // 検索用の入力遅延
  const deferredSearch = useDeferredValue(searchTerm);

  // 検索と各種フィルター条件の適用
  const filteredMccbList = useMemo(() => {
    const lowerSearch = deferredSearch.toLowerCase();
    return processedMccbList.filter((mccb) => {
      const matchesSearch = mccb.name.toLowerCase().includes(lowerSearch);
      const matchesRoom = filterRoom === 'すべて' || mccb.room === filterRoom;
      const matchesStatus =
        filterStatus === 'すべて' ||
        (filterStatus === '送電中' && !mccb.isPowerOff) ||
        (filterStatus === '停電中' && mccb.isPowerOff);
      const matchesFavorite = !filterFavorite || mccb.isFavorite;
      return matchesSearch && matchesRoom && matchesStatus && matchesFavorite;
    });
  }, [processedMccbList, deferredSearch, filterRoom, filterStatus, filterFavorite]);

  // 💡 関数依存を排除：純粋に childCards の状態だけでマップを構築しキャッシュのブレを防止
  const borrowedCountMap = useMemo(() => {
    const map = {};
    mccbList.forEach(m => {
      map[m.id] = m.childCards ? m.childCards.filter(c => c.isBorrowed).length : 0;
    });
    return map;
  }, [mccbList]);

  // 現在モーダルで選択中の設備データ
  // ポーリング更新の瞬間に対象が一時的に見つからない場合も、キャッシュでモーダルを維持する
  const currentMccb = useMemo(() => {
    if (!selectedMccbId) {
      return null;
    }

    const found = mccbList.find((m) => m.id === selectedMccbId);
    if (found) {
      return found;
    }

    if (selectedMccbCache?.id === selectedMccbId) {
      return selectedMccbCache;
    }

    return null;
  }, [mccbList, selectedMccbId, selectedMccbCache]);

  // --- 6. 安定化したコールバック関数 (useCallback) ---
  const handleSelect = useCallback((id) => { 
    const selected = mccbList.find((m) => m.id === id) ?? null;
    setSelectedMccbCache(selected);
    setSelectedMccbId(id); 
  }, [mccbList]);

  const handleCloseModal = useCallback(() => {
    setSelectedMccbCache(null);
    setSelectedMccbId(null);
  }, []);

  const handleToggleFavorite = useCallback((id, current) => {
    const target = mccbList.find(m => m.id === id);
    if (!target) return;
    updateMccb({ ...target, isFavorite: !current });
  }, [mccbList, updateMccb]);

  // --- 7. ナビゲーションの共通定義項目 ---
  const navItems = [
    { path: '/', label: '🔖 札管理ダッシュボード' },
    { path: '/request', label: '🖨️ 停電作業 依頼発行・印刷' },
    { path: '/request-list', label: `📋 依頼一覧・進捗 (${requests.length})` },
  ];

  // --- 8. 特殊画面（フル画面モニターモード）の早期リターン ---
  if (activeTab === '/monitor') {
    return (
      <DashboardView onClose={() => navigate('/')} />
    );
  }

  // --- 9. 通常アプリケーション画面のレンダリング ---
  return (
    <div translate="no" className="min-h-screen bg-gray-50 text-gray-850 p-4 font-sans print:p-0 print:bg-white">
      <div className="max-w-7xl mx-auto space-y-4 print:space-y-0">
        
        {/* 上部共通ヘッダー・ナビゲーションバー */}
        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm print:hidden">
          <div className="flex flex-wrap gap-2">
            {/* 重複していたタブボタンをループ展開に変更しスッキリ整頓 */}
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  activeTab === item.path ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}
            {/* モニターボタンのみ特別目立つカラーリングデザインを維持 */}
            <button onClick={() => navigate('/monitor')} className="px-4 py-2 rounded-lg text-xs font-black text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-all cursor-pointer shadow-sm flex items-center gap-1">🖥️ 電気室モニター</button>
          </div>
          
          <button onClick={handleToggleAdmin} className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border cursor-pointer shadow-sm transition-all whitespace-nowrap mr-1 ${ isAdmin ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100' }`}>
            {isAdmin ? '🔓 モード: 管理者' : '🔒 モード: 一般ユーザー'}
          </button>
        </div>

        {/* ルーティング定義および各機能コンテンツパネル */}
        <Routes>
          <Route path="/" element={
            <>
              <Header
                searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterRoom={filterRoom} setFilterRoom={setFilterRoom} filterFavorite={filterFavorite} setFilterFavorite={setFilterFavorite}
                totalCount={mccbList.length} offCount={mccbList.filter(m => m.isPowerOff).length} onCount={mccbList.filter(m => !m.isPowerOff).length} isAdmin={isAdmin} setIsAdmin={setIsAdmin} rooms={rooms}
              />

              {isAdmin && (
                <AdminPanel 
                  onImportCSV={importFromCSV} onSaveEntry={saveMccbEntry} mccbList={mccbList} rooms={rooms} categories={categories}
                  addRoom={addRoom} updateRoom={updateRoom} deleteRoom={deleteRoom} addCategory={addCategory} updateCategory={updateCategory} deleteCategory={deleteCategory}
                  logs={logs} logSettings={logSettings} onChangeMaxLogSize={changeMaxLogSize} onClearAllLogs={clearAllLogs}
                  deviceGroups={deviceGroups} addDeviceGroup={addDeviceGroup} updateDeviceGroup={updateDeviceGroup} deleteDeviceGroup={deleteDeviceGroup}
                  historySettings={historySettings} onClearRequestHistory={clearRequestHistory} onChangeMaxHistorySize={changeMaxHistorySize}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                {filteredMccbList.map((mccb) => (
                  <MccbCard
                    key={mccb.id}
                    mccb={mccb}
                    borrowedCount={borrowedCountMap[mccb.id] ?? 0}
                    onSelect={handleSelect}
                    onToggleFavorite={handleToggleFavorite}
                    requestsCount={requests.length}
                  />
                ))}
              </div>

              {currentMccb && (
                <ControlModal key={currentMccb.id} mccb={currentMccb} borrowedCount={borrowedCountMap[currentMccb.id] ?? 0} onClose={handleCloseModal} onUpdate={updateMccb} onDelete={deleteMccb} isAdmin={isAdmin} rooms={rooms} categories={categories} />
              )}
            </>
          } />
          
          <Route path="/request" element={<RequestFormPanel mccbList={mccbList} onAddRequest={addRequest} requests={requests} deviceGroups={deviceGroups} />} />
          <Route path="/request-list" element={<RequestListPanel requests={requests} requestHistory={requestHistory} mccbList={mccbList} onDeleteRequest={deleteRequest} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}