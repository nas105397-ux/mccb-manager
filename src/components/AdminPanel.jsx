import { useState } from 'react';

// ==========================================
// 1. コンポーネント外の定数・バッジスタイル定義 (純粋データ)
// ==========================================
const CATEGORY_COLORS = {
  '1スト': 'bg-white text-gray-900 border-gray-300 shadow-sm',
  '2スト': 'bg-black text-white border-black',
  '3スト': 'bg-red-600 text-white border-red-600',
  '4スト': 'bg-blue-600 text-white border-blue-600',
  '5スト': 'bg-yellow-400 text-gray-900 border-yellow-400',
  '6スト': 'bg-green-600 text-white border-green-600',
  '共通': 'bg-gray-100 text-gray-700 border-gray-300',
};

const getLogBadgeClass = (type) => {
  switch (type) {
    case '操作': return 'bg-blue-100 text-blue-800 border border-blue-200';
    case '札貸出': return 'bg-amber-100 text-amber-800 border border-amber-200';
    case 'マスタ登録': return 'bg-green-100 text-green-800 border border-green-200';
    case 'マスタ編集': return 'bg-purple-100 text-purple-800 border border-purple-200';
    case 'マスタ削除': return 'bg-red-100 text-red-800 border border-red-200';
    default: return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

// ==========================================
// 2. メインコンポーネント
// ==========================================
export default function AdminPanel({
  onImportCSV,
  onSaveEntry,
  mccbList = [],
  rooms = [],
  categories = [],
  addRoom,
  updateRoom,
  deleteRoom,
  addCategory,
  updateCategory,
  deleteCategory,
  logs = [],
  logSettings = { maxSize: 500 },
  onChangeMaxLogSize,
  onClearAllLogs,
  deviceGroups = [],
  addDeviceGroup = () => {},
  updateDeviceGroup = () => {},
  deleteDeviceGroup = () => {},
  historySettings = { maxSize: 500 },
  onClearRequestHistory = () => {},
  onChangeMaxHistorySize = () => {}
}) {
  // --- ローカルステート管理 ---
  const [room, setRoom] = useState('');
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [newRoomInput, setNewRoomInput] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // 現在選択されている設備グループオブジェクトを取得
  const currentGroup = deviceGroups.find(g => g.id === selectedGroupId);

  // --- ハンドラ関数群 ---

  /** 設備の個別新規登録 */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const selectedRoom = room || rooms[0] || '';
    const selectedCategory = category || categories[0] || '';

    if (!selectedRoom || !selectedCategory) {
      alert('電気室または区分が正しく設定されていません。マスター登録を確認してください。');
      return;
    }

    onSaveEntry({ room: selectedRoom, category: selectedCategory, name: name.trim() });
    setName('');
  };

  /** 現在のデータをCSVファイルとしてエクスポート */
  const handleExportCSV = () => {
    if (!mccbList || mccbList.length === 0) {
      alert('出力する設備データがありません。');
      return;
    }
    let csvContent = '電気室,区分,設備名称\n';
    mccbList.forEach(item => {
      const cleanRoom = item.room.replace(/[,"]/g, '');
      const cleanCategory = item.category.replace(/[,"]/g, '');
      const cleanName = item.name.replace(/[,"]/g, '');
      csvContent += `${cleanRoom},${cleanCategory},${cleanName}\n`;
    });
    
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // Excelの文字化けを防ぐBOM
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `登録設備データ_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /** ダイアログ経由の電気室名称編集 */
  const handleEditRoomPrompt = (oldName) => {
    const res = window.prompt(`電気室「${oldName}」の新しい名称を入力してください:`, oldName);
    if (res && res.trim() && res.trim() !== oldName) {
      updateRoom(oldName, res.trim());
    }
  };

  /** ダイアログ経由の区分名称編集 */
  const handleEditCategoryPrompt = (oldName) => {
    const res = window.prompt(`区分「${oldName}」の新しい名称を入力してください:`, oldName);
    if (res && res.trim() && res.trim() !== oldName) {
      updateCategory(oldName, res.trim());
    }
  };

  /** 新しい電気室マスターの追加 */
  const handleAddRoom = () => {
    if (newRoomInput.trim()) {
      addRoom(newRoomInput.trim());
      setNewRoomInput('');
    }
  };

  /** 新しい区分マスターの追加 */
  const handleAddCategory = () => {
    if (newCategoryInput.trim()) {
      addCategory(newCategoryInput.trim());
      setNewCategoryInput('');
    }
  };

  /** 新しい設備グループの作成 */
  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      addDeviceGroup(newGroupName.trim());
      setNewGroupName('');
    }
  };

  /** グループから対象を削除 */
  const handleDeleteGroup = (g, e) => {
    e.stopPropagation(); 
    if (window.confirm(`グループ「${g.name}」を削除しますか？`)) {
      deleteDeviceGroup(g.id); 
      if (selectedGroupId === g.id) setSelectedGroupId(null);
    }
  };

  /** グループ内の設備チェック切り替えロジック */
  const handleToggleDeviceInGroup = (deviceId) => {
    if (!currentGroup) return;
    let updatedIds = [...(currentGroup.mccbIds || [])];
    if (updatedIds.includes(deviceId)) {
      updatedIds = updatedIds.filter(id => id !== deviceId);
    } else {
      updatedIds.push(deviceId);
    }
    updateDeviceGroup(currentGroup.id, { ...currentGroup, mccbIds: updatedIds });
  };

  // --- 画面レンダリング ---
  return (
    <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm space-y-6">
      
      {/* 📥 SECTION 1: 設備の個別新規登録 */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 border-b pb-1.5">
          ➕ 設備の個別新規登録
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <label className="block text-xs text-gray-500 mb-1">電気室</label>
            <select
              value={room || rooms[0] || ''}
              onChange={(e) => setRoom(e.target.value)}
              className="border p-2 rounded text-sm w-full bg-white focus:outline-none"
            >
              {rooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="w-32">
            <label className="block text-xs text-gray-500 mb-1">区分</label>
            <select
              value={category || categories[0] || ''}
              onChange={(e) => setCategory(e.target.value)}
              className="border p-2 rounded text-sm w-full bg-white focus:outline-none"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">設備名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: ○○ポンプ用ブレーカー"
              className="border p-2 rounded text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-blue-450"
            />
          </div>

          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-sm shadow-sm transition-all whitespace-nowrap cursor-pointer">
            新規追加
          </button>
        </form>
      </div>

      {/* 📁 SECTION 2: CSVデータの入出力エリア */}
      <div className="pt-4 border-t border-gray-150 flex flex-wrap items-center justify-between gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">CSVファイルから一括取り込み（データ上書き）</label>
          <input 
            type="file" 
            accept=".csv" 
            onChange={(e) => e.target.files?.[0] && onImportCSV(e.target.files[0])}
            className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-150 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
          />
        </div>
        <button 
          onClick={handleExportCSV} 
          className="bg-gray-700 hover:bg-gray-800 text-white font-bold px-4 py-2 rounded text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          📥 現在のデータをCSVエクスポート
        </button>
      </div>

      {/* ⚙️ SECTION 3: 電気室・区分マスター管理エリア */}
      <div className="pt-5 border-t border-gray-150">
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 border-b pb-1.5">
          ⚙️ 電気室・区分マスター設定の追加・編集
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 電気室一覧リスト */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="text-xs font-bold text-gray-600">🏢 電気室マスター一覧 ({rooms.length})</h3>
            <div className="max-h-40 overflow-y-auto border border-gray-200 bg-white rounded-lg p-2 space-y-1.5">
              {rooms.map((r) => (
                <div key={r} className="flex items-center justify-between text-xs p-1.5 bg-gray-50 rounded border border-gray-100">
                  <span className="font-semibold text-gray-800">{r}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleEditRoomPrompt(r)} className="text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded font-bold cursor-pointer">編集</button>
                    <button onClick={() => deleteRoom(r)} className="text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded font-bold cursor-pointer">削除</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newRoomInput}
                onChange={(e) => setNewRoomInput(e.target.value)}
                placeholder="新しい電気室名"
                className="border p-1.5 rounded text-xs flex-1 bg-white focus:outline-none"
              />
              <button onClick={handleAddRoom} className="bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer shrink-0">＋ 追加</button>
            </div>
          </div>

          {/* 区分一覧リスト */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="text-xs font-bold text-gray-600">🏷️ 区分マスター一覧 ({categories.length})</h3>
            <div className="max-h-40 overflow-y-auto border border-gray-200 bg-white rounded-lg p-2 space-y-1.5">
              {categories.map((c) => (
                <div key={c} className="flex items-center justify-between text-xs p-1.5 bg-gray-50 rounded border border-gray-100">
                  <span className="font-semibold text-gray-800">{c}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleEditCategoryPrompt(c)} className="text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded font-bold cursor-pointer">編集</button>
                    <button onClick={() => deleteCategory(c)} className="text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded font-bold cursor-pointer">削除</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="新しい区分名 (例: 7スト)"
                className="border p-1.5 rounded text-xs flex-1 bg-white focus:outline-none"
              />
              <button onClick={handleAddCategory} className="bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer shrink-0">＋ 追加</button>
            </div>
          </div>
        </div>
      </div>

      {/* 👥 SECTION 4: 設備グループ一括選択マスター管理エリア */}
      <div className="pt-5 border-t border-gray-150">
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 border-b pb-1.5">
          👥 設備グループ一括選択マスター設定
        </h2>
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* 左側：グループ一覧 */}
          <div className="w-full lg:w-1/3 space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold text-gray-600">📁 グループ一覧 ({deviceGroups.length})</h3>
              <div className="max-h-56 overflow-y-auto border border-gray-200 bg-white rounded-lg p-2 space-y-1.5">
                {deviceGroups.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">グループがありません</div>
                ) : (
                  deviceGroups.map((g) => (
                    <div 
                      key={g.id} 
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`flex items-center justify-between text-xs p-2 rounded border cursor-pointer transition-all ${
                        selectedGroupId === g.id 
                          ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-sm' 
                          : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-semibold truncate">{g.name} ({g.mccbIds?.length || 0})</span>
                      <button onClick={(e) => handleDeleteGroup(g, e)} className="text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded font-bold">削除</button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="新しいグループ名 (例: A系統一括)"
                  className="border p-1.5 rounded text-xs flex-1 bg-white focus:outline-none"
                />
                <button onClick={handleCreateGroup} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer shrink-0 shadow-sm">作成</button>
              </div>
            </div>
          </div>

          {/* 右側：所属設備編集 */}
          <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col min-h-[300px]">
            {currentGroup ? (
              <>
                <h3 className="text-xs font-bold text-gray-600 mb-3 flex justify-between items-center border-b border-gray-200 pb-2">
                  <span>📦 所属設備の紐付け: <span className="text-blue-700 ml-1">{currentGroup.name}</span></span>
                  <span>選択中: {currentGroup.mccbIds?.length || 0} 面</span>
                </h3>
                <div className="flex-1 overflow-y-auto max-h-[350px] bg-white border border-gray-200 rounded-lg p-2 grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
                  {mccbList.map(mccb => {
                    const isChecked = currentGroup.mccbIds?.includes(mccb.id);
                    const badgeColor = CATEGORY_COLORS[mccb.category] || 'bg-gray-50 text-gray-600 border-gray-200';
                    return (
                      <label 
                        key={mccb.id}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                          isChecked ? 'border-blue-300 bg-blue-50/30 text-blue-900 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDeviceInGroup(mccb.id)}
                          className="rounded text-blue-600"
                        />
                        <div className="truncate flex-1">
                          <span className={`text-[11px] border px-1 py-0.5 rounded mr-1 ${badgeColor}`}>
                            {mccb.category}
                          </span>
                          {mccb.name}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-lg bg-white">
                👈 左側の一覧からグループを選択すると、ここに所属設備の紐付け編集パネルが表示されます
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ⚙️ SECTION 5: 停電作業依頼 履歴管理設定エリア */}
      <div className="pt-5 border-t border-gray-150">
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 border-b pb-1.5">
          ⚙️ 停電作業依頼 履歴管理設定
        </h2>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
            <div className="text-gray-500 font-medium">
              解約・作業完了になった停電作業依頼の最大履歴保持数およびデータの全一括クリアを行います。
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-gray-500 font-black">最大保持件数:</span>
                <select
                  value={historySettings?.maxSize || 500}
                  onChange={(e) => onChangeMaxHistorySize(Number(e.target.value))}
                  className="bg-transparent text-gray-700 font-black focus:outline-none cursor-pointer"
                >
                  <option value="50">50 件</option>
                  <option value="100">100 件</option>
                  <option value="300">300 件</option>
                  <option value="500">500 件</option>
                </select>
              </div>
              <button
                onClick={onClearRequestHistory}
                className="bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg font-black shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                🗑️ 依頼履歴全クリア
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 📜 SECTION 6: システム操作ログ履歴セクション */}
      <div className="pt-4 border-t border-gray-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1">
            📜 システム操作ログ履歴 (直近の操作から順に表示)
          </h3>
          
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-200">
              <span className="text-gray-500 font-semibold">最大保持件数:</span>
              <select
                value={logSettings.maxSize}
                onChange={(e) => onChangeMaxLogSize(Number(e.target.value))}
                className="border rounded px-1 py-0.5 bg-white text-gray-700 font-bold focus:outline-none cursor-pointer"
              >
                <option value="100">100 件</option>
                <option value="300">300 件</option>
                <option value="500">500 件</option>
                <option value="1000">1000 件</option>
              </select>
            </div>
            <button
              onClick={onClearAllLogs}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1 rounded font-bold transition-all cursor-pointer"
            >
              🗑️ ログ履歴クリア
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="max-h-52 overflow-y-auto font-mono text-xs">
            {!logs || logs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bg-gray-50 italic">
                現在、記録されている履歴はありません。
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 sticky top-0 border-b border-gray-200 text-[10px]">
                    <th className="p-2 w-36 whitespace-nowrap">操作日時</th>
                    <th className="p-2 w-24 whitespace-nowrap">分類</th>
                    <th className="p-2">操作記録・詳細</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/70 text-gray-600 transition-all">
                      <td className="p-2 text-gray-400 whitespace-nowrap text-[11px]">{log.timestamp}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getLogBadgeClass(log.type)}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="p-2 text-gray-800 font-sans leading-relaxed break-all">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-gray-50 px-3 py-1 text-[10px] text-gray-400 text-right border-t border-gray-150">
            ログ保存容量: <span className="font-bold text-gray-600">{logs ? logs.length : 0}</span> / {logSettings.maxSize} 件
          </div>
        </div>
      </div>

    </div>
  );
}