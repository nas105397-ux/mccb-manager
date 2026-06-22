import { useState, useMemo } from 'react';
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
  const {
    mccbList, rooms, categories, updateMccb, saveMccbEntry, deleteMccb,
    importFromCSV, getBorrowedCount, addRoom, updateRoom, deleteRoom,
    addCategory, updateCategory, deleteCategory,
    requests, addRequest, deleteRequest,
    logs, logSettings, changeMaxLogSize, clearAllLogs,
    deviceGroups, addDeviceGroup, updateDeviceGroup, deleteDeviceGroup 
  } = useMccbData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('すべて');
  const [filterRoom, setFilterRoom] = useState('すべて');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMccbId, setSelectedMccbId] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname;

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

  // 💡 【超軽量化1】依頼データから「代替名」を合成する重い処理をキャッシュ化
  const processedMccbList = useMemo(() => {
    return mccbList.map((mccb) => {
      let dynamicMccb = { ...mccb };
      requests.forEach(req => {
        if (req.reservedCards) {
          Object.keys(req.reservedCards).forEach(originalId => {
            const resInfo = req.reservedCards[originalId];
            if (resInfo && resInfo.actualMccbId === mccb.id) {
              if (originalId !== mccb.id) {
                const originalMccb = mccbList.find(m => m.id === originalId);
                if (originalMccb) dynamicMccb.name = `${mccb.name} (${originalMccb.name})`;
              } else if (resInfo.customDummyName) {
                dynamicMccb.name = `${mccb.name} (${resInfo.customDummyName})`;
              }
            }
          });
        }
      });
      return dynamicMccb;
    });
  }, [mccbList, requests]); // mccbListかrequestsが変わった時だけ再計算

  // 💡 【超軽量化2】検索とフィルター処理も分離してキャッシュ化
  const filteredMccbList = useMemo(() => {
    return processedMccbList.filter((mccb) => {
      const matchesSearch = mccb.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRoom = filterRoom === 'すべて' || mccb.room === filterRoom;
      const matchesStatus =
        filterStatus === 'すべて' ||
        (filterStatus === '送電中' && !mccb.isPowerOff) ||
        (filterStatus === '停電中' && mccb.isPowerOff);
      const matchesFavorite = !filterFavorite || mccb.isFavorite;
      return matchesSearch && matchesRoom && matchesStatus && matchesFavorite;
    });
  }, [processedMccbList, searchTerm, filterRoom, filterStatus, filterFavorite]);

  const currentMccb = useMemo(() => mccbList.find((m) => m.id === selectedMccbId), [mccbList, selectedMccbId]);

  if (activeTab === '/monitor') {
    return (
      <div className="relative" translate="no">
        <button onClick={() => navigate('/')} className="absolute top-4 right-44 z-50 bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-xl text-xs border border-gray-700 shadow-lg cursor-pointer transition-all">
          ↩️ 監視モードを終了
        </button>
        <DashboardView />
      </div>
    );
  }

  return (
    <div translate="no" className="min-h-screen bg-gray-50 text-gray-850 p-4 font-sans print:p-0 print:bg-white">
      <div className="max-w-7xl mx-auto space-y-4 print:space-y-0">
        
        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm print:hidden">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${ activeTab === '/' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100' }`}>🎛️ 札管理ダッシュボード</button>
            <button onClick={() => navigate('/request')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${ activeTab === '/request' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100' }`}>𖠚️ 停電作業 依頼発行・印刷</button>
            <button onClick={() => navigate('/request-list')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${ activeTab === '/request-list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100' }`}>📋 依頼一覧・進捗 (<span>{requests.length}</span>)</button>
            <button onClick={() => navigate('/monitor')} className="px-4 py-2 rounded-lg text-xs font-black text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-all cursor-pointer shadow-sm flex items-center gap-1">📺 電気室モニター</button>
          </div>
          <button onClick={handleToggleAdmin} className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border cursor-pointer shadow-sm transition-all whitespace-nowrap mr-1 ${ isAdmin ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100' }`}>
            {isAdmin ? '🔓 モード: 管理者（フルアクセス）' : '🔒 モード: 一般ユーザー（制限版）'}
          </button>
        </div>

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
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                {/* 💡 事前計算済みの配列を回すだけになり、爆速で表示されます */}
                {filteredMccbList.map((mccb) => (
                  <MccbCard key={mccb.id} mccb={mccb} borrowedCount={getBorrowedCount(mccb)} onSelect={() => setSelectedMccbId(mccb.id)} onToggleFavorite={() => updateMccb({ ...mccb, isFavorite: !mccb.isFavorite })} requests={requests} />
                ))}
              </div>

              {currentMccb && (
                <ControlModal mccb={currentMccb} borrowedCount={getBorrowedCount(currentMccb)} onClose={() => setSelectedMccbId(null)} onUpdate={updateMccb} onDelete={deleteMccb} isAdmin={isAdmin} rooms={rooms} categories={categories} />
              )}
            </>
          } />
          <Route path="/request" element={<RequestFormPanel mccbList={mccbList} onAddRequest={addRequest} requests={requests} deviceGroups={deviceGroups} />} />
          <Route path="/request-list" element={<RequestListPanel requests={requests} mccbList={mccbList} onDeleteRequest={deleteRequest} />} />
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