export default function Header({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  filterRoom,
  setFilterRoom,
  filterFavorite,
  setFilterFavorite,
  totalCount,
  offCount,
  onCount,
  rooms = []
}) {
  return (
    <div className="bg-white p-4 rounded-xl mb-4 border border-gray-200">
      
      {/* 🔝 SECTION 1: システムタイトル & ステータスカウンター */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-extrabold text-gray-850 tracking-wider flex items-center gap-1.5">
            📋 操作禁止札管理システム
          </h1>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              登録: {totalCount}
            </span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
              🟢 送電: {onCount}
            </span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
              🔴 停電: {offCount}
            </span>
          </div>
        </div>
      </div>

      {/* 🔍 SECTION 2: 検索 & 絞り込みフィルターコントロール */}
      <div className="flex flex-wrap items-center gap-4 mt-3">
        
        {/* 設備名称検索インプット */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="🔍 設備名称で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 p-1.5 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 電気室選択セレクトボックス */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 font-bold whitespace-nowrap">電気室:</span>
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="border border-gray-300 p-1.5 rounded-lg text-sm bg-white focus:outline-none cursor-pointer"
          >
            <option value="すべて">すべて表示</option>
            {rooms.map((roomName) => (
              <option key={roomName} value={roomName}>{roomName}</option>
            ))}
          </select>
        </div>

        {/* 送電・停電状態セレクトボックス */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 font-bold whitespace-nowrap">状態:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 p-1.5 rounded-lg text-sm bg-white focus:outline-none cursor-pointer"
          >
            <option value="すべて">すべて表示</option>
            <option value="送電中">🟢 送電中のみ</option>
            <option value="停電中">🔴 停電中のみ</option>
            <option value="札返却済み">✅ 札返却済みのみ</option>
            <option value="依頼発行中">📋 依頼発行中のみ</option>
          </select>
        </div>

        {/* お気に入りトグルボタン */}
        <div className="flex items-center">
          <button
            onClick={() => setFilterFavorite(!filterFavorite)}
            className={`flex items-center gap-1 text-sm font-bold p-1.5 rounded-lg border cursor-pointer ${
              filterFavorite
                ? 'bg-amber-400 text-gray-900 border-amber-400 font-black'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {filterFavorite ? '★ お気に入りのみ抽出中' : '☆ お気に入りで絞り込み'}
          </button>
        </div>

      </div>
    </div>
  );
}
