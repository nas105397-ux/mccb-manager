import React from 'react';
import PrintPreviewForm from './PrintPreviewForm';
import { useRequestFormController } from '../hooks/useRequestFormController';

// ==========================================
// 定数定義
// ==========================================

/** 基本テキスト入力クラス */
const INPUT_CLASS        = 'border p-2 rounded text-sm w-full bg-gray-50 focus:bg-white focus:outline-none';
/** 検索入力クラス */
const INPUT_SEARCH_CLASS = 'border p-2 rounded text-xs w-full focus:outline-none mb-2 focus:border-blue-500';
/** ダミー代替名入力クラス */
const INPUT_DUMMY_CLASS  = 'border p-1.5 rounded text-[11px] w-full bg-white focus:outline-none font-medium text-gray-700 shadow-inner';
/** 設備行：選択中クラス */
const ROW_SELECTED_CLASS = 'p-2 rounded border transition-all duration-150 will-change-transform bg-blue-50/30 border-blue-200 text-blue-900 shadow-sm';
/** 設備行：通常クラス */
const ROW_DEFAULT_CLASS  = 'p-2 rounded border transition-all duration-150 will-change-transform bg-white border-gray-200 text-gray-700 hover:bg-gray-50';
/** グループボタン共通ベース */
const BTN_GROUP_BASE     = 'px-2.5 py-1.5 rounded text-[11px] font-black border transition-all cursor-pointer shadow-sm transform active:scale-95';

// ==========================================
// RequestMccbRow: 1行単位の軽量コンポーネント（独立隔離）
// ==========================================
const RequestMccbRow = React.memo(({ mccb, isSelected, onToggle, dummyName, onDummyNameChange }) => {
  const isDummy = mccb.isDummy || mccb.name?.includes('ダミー');

  return (
    <div
      title={mccb.name ? `禁止札名: ${mccb.name}` : '禁止札名: 未設定'}
      className={isSelected ? ROW_SELECTED_CLASS : ROW_DEFAULT_CLASS}
    >
      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(mccb.id)}
          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
        <div className="truncate flex-1">
          <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 mr-1.5 border">
            {mccb.room}
          </span>
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
            className={INPUT_DUMMY_CLASS}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}, (prev, next) =>
  prev.isSelected   === next.isSelected  &&
  prev.dummyName    === next.dummyName   &&
  prev.mccb.id      === next.mccb.id     &&
  prev.mccb.name    === next.mccb.name   &&
  prev.mccb.room    === next.mccb.room
);

// ==========================================
// RequestFormPanel: メインコンポーネント
// ==========================================
export default function RequestFormPanel({ mccbList, onAddRequest, requests = [], deviceGroups = [] }) {
  const {
    workerName, setWorkerName,
    workContent, setWorkContent,
    selectedMccbIds,
    searchQuery, setSearchQuery,
    dummyNames,
    filteredMccbList,
    handleToggleMccb,
    handleDummyNameChange,
    handleSelectGroup,
    handlePrint,
  } = useRequestFormController({ mccbList, onAddRequest });

  // --- 画面レンダリング ---
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start print:block print:space-y-0 print:p-0">
      
      {/* 左側：入力設定フォームパネル (印刷時は非表示) */}
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 print:hidden shrink-0 lg:sticky lg:top-4">
        <h2 className="text-sm font-black text-gray-700 border-b pb-2">
          📝 停電依頼書の作成・印刷用フォーム
        </h2>
        
        {/* 基本情報入力 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 font-bold mb-1">
              作業責任者名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="例: 山田 太郎"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-bold mb-1">
              作業内容・目的
            </label>
            <input
              type="text"
              value={workContent}
              onChange={(e) => setWorkContent(e.target.value)}
              placeholder="例: ○○ポンプ定期点検作業"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* グループ選択ショートカットボタン */}
        {deviceGroups && deviceGroups.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <label className="block text-[11px] text-gray-400 font-bold">
              👥 グループ一括選択ショートカット
            </label>
            <div className="flex flex-wrap gap-1.5">
              {deviceGroups.map(group => {
                const groupIds = group.mccbIds || [];
                const isActive = groupIds.length > 0 && groupIds.every(id => selectedMccbIds.includes(id));
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleSelectGroup(groupIds)}
                    className={`${BTN_GROUP_BASE} ${
                      isActive
                        ? 'bg-blue-600 border-blue-700 text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {isActive ? '✓ ' : '➕ '}{group.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 設備検索 & 選択リスト */}
        <div className="space-y-2 pt-1">
          <label className="block text-xs text-gray-500 font-bold">
            対象設備の選択（複数選択可）
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 設備名や電気室で絞り込み..."
            className={INPUT_SEARCH_CLASS}
          />
          
          <div className="max-h-56 overflow-y-auto border rounded-lg p-2 bg-gray-50 space-y-1 text-left">
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

        {/* 発行ボタン */}
        <div className="pt-2">
          <button 
            onClick={handlePrint} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-lg text-sm shadow-md cursor-pointer w-full transform active:scale-[0.98] transition-all"
          >
            🖨️ 停電依頼を発行して印刷
          </button>
        </div>
      </div>

      {/* 右側：印刷プレビューコンポーネント */}
      <PrintPreviewForm 
        workerName={workerName} 
        workContent={workContent} 
        selectedMccbIds={selectedMccbIds} 
        mccbList={mccbList} 
        requests={requests} 
        dummyNames={dummyNames} 
      />
    </div>
  );
}