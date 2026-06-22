import React, { useState, useMemo, useDeferredValue } from 'react';
import PrintPreviewForm from './PrintPreviewForm'; 

// ====================================================
// 💡 【新設】1行単位の軽量コンポーネント（独立隔離）
// ====================================================
const RequestMccbRow = React.memo(({ mccb, isSelected, onToggle, dummyName, onDummyNameChange }) => {
  const isDummy = mccb.isDummy || (mccb.name && mccb.name.includes('ダミー'));
  
  return (
    <div 
      className={`p-2 rounded border transition-all duration-150 will-change-transform ${
        isSelected ? 'bg-blue-50/30 border-blue-200 text-blue-900 shadow-sm' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
      }`}
    >
      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => onToggle(mccb.id)} 
          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer" 
        />
        <div className="truncate flex-1">
          <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 mr-1.5 border">{mccb.room}</span>
          {mccb.name}
        </div>
      </label>
      
      {isSelected && isDummy && (
        <div className="mt-1.5 pl-6">
          <input
            type="text"
            value={dummyName || ''}
            onChange={(e) => onDummyNameChange(mccb.id, e.target.value)}
            placeholder="✏️ 代替する実際の設備名称を入力"
            className="border p-1.5 rounded text-[11px] w-full bg-white focus:outline-none font-medium text-gray-700 shadow-inner"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // 💡 自分のチェック状態か、入力された名前が変化した時「だけ」しか再描画を許可しない（他は何百行あろうが完全静止）
  return (
    prev.isSelected === next.isSelected &&
    prev.dummyName === next.dummyName &&
    prev.mccb.id === next.mccb.id &&
    prev.mccb.name === next.mccb.name
  );
});

// ====================================================
// 📝 メインコンポーネント
// ====================================================
export default function RequestFormPanel({ mccbList, onAddRequest, requests = [], deviceGroups = [] }) {
  const [workerName, setWorkerName] = useState('');
  const [workContent, setWorkContent] = useState('');
  const [selectedMccbIds, setSelectedMccbIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dummyNames, setDummyNames] = useState({});

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const handleToggleMccb = React.useCallback((id) => {
    setSelectedMccbIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  }, []);

  const handleDummyNameChange = React.useCallback((id, value) => {
    setDummyNames(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleSelectGroup = (groupMccbIds) => {
    if (!groupMccbIds || groupMccbIds.length === 0) return;
    const isAllSelected = groupMccbIds.every(id => selectedMccbIds.includes(id));
    if (isAllSelected) {
      setSelectedMccbIds(selectedMccbIds.filter(id => !groupMccbIds.includes(id)));
    } else {
      setSelectedMccbIds(prev => Array.from(new Set([...prev, ...groupMccbIds])));
    }
  };

  const handlePrint = () => {
    if (!workerName.trim()) { alert('作業者名を入力してください。'); return; }
    if (selectedMccbIds.length === 0) { alert('設備が選択されていません。'); return; }

    if (onAddRequest) {
      onAddRequest({
        id: `REQ-${Date.now()}`,
        timestamp: new Date().toLocaleString('ja-JP'),
        workerName: workerName,
        workContent: workContent,
        targetMccbIds: selectedMccbIds,
        dummyNames: dummyNames
      });
      alert('停電依頼を発行し、一覧へ登録しました。');
    }
    window.print();
  };

  const filteredMccbList = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase().trim();
    if (!query) return mccbList;
    return mccbList.filter(mccb => 
      (mccb.name && mccb.name.toLowerCase().includes(query)) ||
      (mccb.room && mccb.room.toLowerCase().includes(query))
    );
  }, [mccbList, deferredSearchQuery]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start print:block print:space-y-0 print:p-0">
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 print:hidden shrink-0 lg:sticky lg:top-4">
        <h2 className="text-sm font-black text-gray-700 border-b pb-2">📝 停電依頼書の作成・印刷用フォーム</h2>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 font-bold mb-1">作業責任者名 <span className="text-red-500">*</span></label>
            <input type="text" value={workerName} onChange={(e) => setWorkerName(e.target.value)} placeholder="例: 山田 太郎" className="border p-2 rounded text-sm w-full bg-gray-50 focus:bg-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-bold mb-1">作業内容・目的</label>
            <input type="text" value={workContent} onChange={(e) => setWorkContent(e.target.value)} placeholder="例: ○○ポンプ定期点検作業" className="border p-2 rounded text-sm w-full bg-gray-50 focus:bg-white focus:outline-none" />
          </div>
        </div>

        {deviceGroups && deviceGroups.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <label className="block text-[11px] text-gray-400 font-bold">👥 グループ一括選択ショートカット</label>
            <div className="flex flex-wrap gap-1.5">
              {deviceGroups.map(group => {
                const groupIds = group.mccbIds || [];
                const isActive = groupIds.length > 0 && groupIds.every(id => selectedMccbIds.includes(id));
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleSelectGroup(groupIds)}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-black border transition-all cursor-pointer shadow-sm transform active:scale-95 ${
                      isActive ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {isActive ? '✓ ' : '➕ '}{group.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <label className="block text-xs text-gray-500 font-bold">対象設備の選択（複数選択可）</label>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 設備名や電気室で絞り込み..." className="border p-2 rounded text-xs w-full focus:outline-none mb-2 focus:border-blue-500" />
          
          {/* 💡 超軽量化した隔離子コンポーネントをループ呼び出し */}
          <div className="max-h-56 overflow-y-auto border rounded-lg p-2 bg-gray-50 space-y-1">
            {filteredMccbList.map(mccb => (
              <RequestMccbRow
                key={mccb.id}
                mccb={mccb}
                isSelected={selectedMccbIds.includes(mccb.id)}
                onToggle={handleToggleMccb}
                dummyName={dummyNames[mccb.id]}
                onDummyNameChange={handleDummyNameChange}
              />
            ))}
          </div>
        </div>

        <div className="pt-2 text-right">
          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-lg text-sm shadow-md cursor-pointer w-full transform active:scale-[0.98] transition-all">
            🖨️ 停電依頼を発行して印刷
          </button>
        </div>
      </div>

      <PrintPreviewForm workerName={workerName} workContent={workContent} selectedMccbIds={selectedMccbIds} mccbList={mccbList} requests={requests} dummyNames={dummyNames} />
    </div>
  );
}