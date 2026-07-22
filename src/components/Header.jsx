// メイン操作画面の検索・表示対象・並び順を設定するヘッダー。
import { useEffect, useRef, useState } from "react";

const STATUS_LABELS = {
  "札返却済み": "✅ 札返却済み",
  "依頼発行中": "📋 依頼発行中",
  "停電中": "🔴 停電中",
  "送電中": "🟢 送電中",
};

export default function Header({
  searchTerm,
  setSearchTerm,
  selectedRooms,
  setSelectedRooms,
  statusSortOrder,
  setStatusSortOrder,
  totalCount,
  offCount,
  onCount,
  rooms = [],
}) {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsSortMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const toggleRoom = (roomName) => {
    setSelectedRooms((currentRooms) =>
      currentRooms.includes(roomName)
        ? currentRooms.filter((room) => room !== roomName)
        : [...currentRooms, roomName],
    );
  };

  const moveStatus = (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= statusSortOrder.length) return;

    const nextOrder = [...statusSortOrder];
    [nextOrder[index], nextOrder[destination]] = [
      nextOrder[destination],
      nextOrder[index],
    ];
    setStatusSortOrder(nextOrder);
  };

  const roomSelectionLabel =
    selectedRooms.length === 0
      ? "全電気室"
      : `${selectedRooms.length} 電気室`;

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl mb-2 sm:mb-4 border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 pb-2 sm:pb-3 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-wider flex items-center gap-1.5">
            📋 操作禁止札管理システム
          </h1>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">登録: {totalCount}</span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">🟢 送電: {onCount}</span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">🔴 停電: {offCount}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="🔍 設備名称で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsSortMenuOpen((isOpen) => !isOpen)}
            className={`flex items-center gap-2 border p-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
              isSortMenuOpen
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            aria-expanded={isSortMenuOpen}
            aria-haspopup="dialog"
          >
            ⇅ 表示・並び順
            <span className="text-xs font-medium text-gray-500">{roomSelectionLabel}</span>
          </button>

          {isSortMenuOpen && (
            <div
              role="dialog"
              aria-label="表示・並び順の設定"
              className="absolute left-0 sm:left-auto sm:right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
            >
              <section>
                <h2 className="text-sm font-black text-gray-800">1. 状態の優先順位</h2>
                <p className="mt-1 text-xs text-gray-500">上にある状態ほど先に表示します。</p>
                <ol className="mt-2 space-y-1">
                  {statusSortOrder.map((status, index) => (
                    <li key={status} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm">
                      <span className="w-4 text-xs font-black text-gray-400">{index + 1}</span>
                      <span className="flex-1 font-bold text-gray-700">{STATUS_LABELS[status]}</span>
                      <button
                        type="button"
                        onClick={() => moveStatus(index, -1)}
                        disabled={index === 0}
                        className="grid h-8 w-8 place-items-center rounded text-sm font-black text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                        aria-label={`${status}を上へ`}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStatus(index, 1)}
                        disabled={index === statusSortOrder.length - 1}
                        className="grid h-8 w-8 place-items-center rounded text-sm font-black text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                        aria-label={`${status}を下へ`}
                      >
                        ▼
                      </button>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black text-gray-800">2. 表示する電気室</h2>
                  <button
                    type="button"
                    onClick={() => setSelectedRooms([])}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    すべて選択
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">複数選択できます。未選択の場合は全電気室を表示します。</p>
                <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
                  {rooms.map((roomName) => (
                    <label key={roomName} className="flex items-center gap-2 rounded px-1 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRooms.length === 0 || selectedRooms.includes(roomName)}
                        onChange={() => {
                          if (selectedRooms.length === 0) {
                            setSelectedRooms(rooms.filter((room) => room !== roomName));
                            return;
                          }
                          toggleRoom(roomName);
                        }}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{roomName}</span>
                    </label>
                  ))}
                </div>
              </section>

              <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">3. 同じ状態・電気室内では、お気に入りを先に表示します。さらに同じ条件のカードは登録順です。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
