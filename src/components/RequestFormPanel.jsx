import React, { useEffect, useMemo, useRef, useState } from "react";
import PrintPreviewForm from "./PrintPreviewForm";
import StatusMessageRail from "./StatusMessageRail";
import { useRequestFormController } from "../hooks/useRequestFormController";
import { usePrintPreviewController } from "../hooks/usePrintPreviewController";
import { VariableSizeList as List } from "react-window";
import { REQUEST_PRINT_MODES } from "../shared/printSettings";

// ==========================================
// 定数定義
// ==========================================

/** 基本テキスト入力クラス */
const INPUT_CLASS =
  "border p-2 rounded text-sm w-full bg-gray-50 focus:bg-white focus:outline-none";
/** 検索入力クラス */
const INPUT_SEARCH_CLASS =
  "border p-2 rounded text-xs w-full focus:outline-none mb-2 focus:border-blue-500";
/** ダミー代替名入力クラス */
const INPUT_DUMMY_CLASS =
  "border p-1.5 rounded text-[11px] w-full bg-white focus:outline-none font-medium text-gray-700";
/** 設備行：選択中クラス */
const ROW_SELECTED_CLASS =
  "p-2 rounded border bg-blue-50/30 border-blue-200 text-blue-900";
/** 設備行：通常クラス */
const ROW_DEFAULT_CLASS =
  "p-2 rounded border bg-white border-gray-200 text-gray-700 hover:bg-gray-50";
/** グループボタン共通ベース */
const BTN_GROUP_BASE =
  "px-2.5 py-1.5 rounded text-[11px] font-black border cursor-pointer";

// 仮想リストの行高さ/ギャップ（px）
const ROW_HEIGHT_COLLAPSED = 40;
const ROW_HEIGHT_SELECTED = 40;
const ROW_HEIGHT_SELECTED_DUMMY = 87;
const ROW_GAP = 1; // 行間の余白（上下）

function DummyNameInput({ mccbId, value, onChange }) {
  const [draft, setDraft] = useState(() => value || "");

  const commitValue = (nextValue) => {
    if ((value || "") !== nextValue) {
      onChange(mccbId, nextValue);
    }
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => {
        const nextValue = e.target.value;
        setDraft(nextValue);
      }}
      onBlur={() => commitValue(draft)}
      placeholder="✏️ 代替する実際の設備名称を入力"
      className={INPUT_DUMMY_CLASS}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}

// ==========================================
// RequestMccbRow: 1行単位の軽量コンポーネント（独立隔離）
// ==========================================
const RequestMccbRow = React.memo(
  ({ mccb, isSelected, onToggle, dummyName, onDummyNameChange }) => {
    const isDummy = mccb.isDummy || mccb.name?.includes("ダミー");

    return (
      <div
        title={mccb.name ? `禁止札名: ${mccb.name}` : "禁止札名: 未設定"}
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
            <DummyNameInput
              key={mccb.id}
              mccbId={mccb.id}
              value={dummyName}
              onChange={onDummyNameChange}
            />
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.dummyName === next.dummyName &&
    prev.mccb.id === next.mccb.id &&
    prev.mccb.name === next.mccb.name &&
    prev.mccb.room === next.mccb.room,
);

// ==========================================
// RequestFormPanel: メインコンポーネント
// ==========================================
export default function RequestFormPanel({
  mccbList,
  onAddRequest,
  onAddDraftRequest,
  deviceGroups = [],
  requestPrintMode = REQUEST_PRINT_MODES.STAR_RECEIPT,
}) {
  const [previewRefreshNonce, setPreviewRefreshNonce] = useState(0);
  const printPreviewStatusRef = useRef({
    isReady: false,
    isLoading: false,
    error: "",
    previewKey: "",
  });
  const {
    workerName,
    setWorkerName,
    workContent,
    setWorkContent,
    selectedMccbIds,
    searchQuery,
    setSearchQuery,
    dummyNames,
    selectedMccbIdSet,
    filteredMccbList,
    formMessage,
    setFormMessage,
    handleToggleMccb,
    handleDummyNameChange,
    handleSelectGroup,
    handlePrint,
    handleSaveDraft,
    isIssuingRequest,
    isSavingDraft,
  } = useRequestFormController({
    mccbList,
    onAddRequest,
    onAddDraftRequest,
    getPrintPreviewStatus: () => printPreviewStatusRef.current,
    onAfterPrint: () => setPreviewRefreshNonce((prev) => prev + 1),
    requestPrintMode,
  });
  const {
    now,
    dateCode,
    previewRequestKey,
    selectedMccbsWithAssignedCards,
    isPreviewLoading,
    previewError,
  } = usePrintPreviewController({
    selectedMccbIds,
    dummyNames,
    previewRefreshNonce,
  });

  const listRef = useRef(null);
  const previousSelectedSetRef = useRef(selectedMccbIdSet);
  const previousFilteredLengthRef = useRef(filteredMccbList.length);
  const filteredIndexById = useMemo(() => {
    const indexById = new Map();
    filteredMccbList.forEach((mccb, index) => {
      indexById.set(mccb.id, index);
    });
    return indexById;
  }, [filteredMccbList]);

  const isPrintPreviewReady =
    selectedMccbIds.length > 0 &&
    !isPreviewLoading &&
    !previewError &&
    selectedMccbsWithAssignedCards.length > 0;
  const requiresBrowserPrintPreview = requestPrintMode === REQUEST_PRINT_MODES.BROWSER;
  const issueButtonLabel = isIssuingRequest
    ? requestPrintMode === REQUEST_PRINT_MODES.STAR_RECEIPT
      ? "🖨️ 印刷中..."
      : "処理中..."
    : requestPrintMode === REQUEST_PRINT_MODES.STAR_RECEIPT
      ? "🖨️ 停電依頼を発行してレシート印刷"
      : requiresBrowserPrintPreview
        ? "🖨️ 停電依頼を発行して印刷"
        : "✅ 停電依頼を発行";

  useEffect(() => {
    printPreviewStatusRef.current = {
      isReady: isPrintPreviewReady,
      isLoading: isPreviewLoading,
      error: previewError,
      previewKey: previewRequestKey,
    };
  }, [isPrintPreviewReady, isPreviewLoading, previewError, previewRequestKey]);

  useEffect(() => {
    // 選択状態や絞り込みが変わったら、必要な位置から行高さを再計測する。
    // 代替名称の入力値は高さに影響しないため、入力中のフォーカス維持を優先する。
    if (!listRef.current || typeof listRef.current.resetAfterIndex !== "function") {
      previousSelectedSetRef.current = selectedMccbIdSet;
      previousFilteredLengthRef.current = filteredMccbList.length;
      return;
    }

    let resetIndex = Infinity;

    if (previousFilteredLengthRef.current !== filteredMccbList.length) {
      resetIndex = 0;
    } else {
      const previousSet = previousSelectedSetRef.current;
      selectedMccbIdSet.forEach((id) => {
        if (!previousSet.has(id) && filteredIndexById.has(id)) {
          resetIndex = Math.min(resetIndex, filteredIndexById.get(id));
        }
      });
      previousSet.forEach((id) => {
        if (!selectedMccbIdSet.has(id) && filteredIndexById.has(id)) {
          resetIndex = Math.min(resetIndex, filteredIndexById.get(id));
        }
      });
    }

    if (Number.isFinite(resetIndex)) {
      listRef.current.resetAfterIndex(resetIndex, true);
    }

    previousSelectedSetRef.current = selectedMccbIdSet;
    previousFilteredLengthRef.current = filteredMccbList.length;
  }, [selectedMccbIdSet, filteredMccbList.length, filteredIndexById]);

  // --- 画面レンダリング ---
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start print:block print:space-y-0 print:p-0">
      {/* 左側：入力設定フォームパネル (印刷時は非表示) */}
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl border border-gray-200 space-y-4 print:hidden shrink-0 lg:sticky lg:top-4">
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
              作業内容・目的 <span className="text-red-500">*</span>
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
              {deviceGroups.map((group) => {
                const groupIds = group.mccbIds || [];
                const isActive =
                  groupIds.length > 0 &&
                  groupIds.every((id) => selectedMccbIdSet.has(id));
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleSelectGroup(groupIds)}
                    className={`${BTN_GROUP_BASE} ${
                      isActive
                        ? "bg-blue-600 border-blue-700 text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {isActive ? "✓ " : "➕ "}
                    {group.name}
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

          <div className="max-h-56 overflow-y-auto border rounded-lg p-2 bg-gray-50 text-left">
            <List
              ref={listRef}
              height={224}
              itemCount={filteredMccbList.length}
              itemKey={(index) => filteredMccbList[index]?.id || index}
              itemSize={(index) => {
                const mccb = filteredMccbList[index];
                if (!mccb) return ROW_HEIGHT_COLLAPSED + ROW_GAP;
                const isSelected = selectedMccbIdSet.has(mccb.id);
                const isDummy = mccb.isDummy || mccb.name?.includes("ダミー");
                if (!isSelected) return ROW_HEIGHT_COLLAPSED + ROW_GAP; // 標準行高さ + ギャップ
                const base = isDummy
                  ? ROW_HEIGHT_SELECTED_DUMMY
                  : ROW_HEIGHT_SELECTED;
                return base + ROW_GAP; // 選択時高さ + ギャップ
              }}
              width={"100%"}
              overscanCount={6}
            >
              {({ index, style }) => {
                const mccb = filteredMccbList[index];
                return (
                  <div style={style} key={mccb?.id || index}>
                    <div
                      style={{
                        height: `calc(100% - ${ROW_GAP}px)`,
                        boxSizing: "border-box",
                      }}
                    >
                      <RequestMccbRow
                        mccb={mccb}
                        isSelected={selectedMccbIdSet.has(mccb.id)}
                        onToggle={handleToggleMccb}
                        dummyName={dummyNames[mccb.id]}
                        onDummyNameChange={handleDummyNameChange}
                      />
                    </div>
                  </div>
                );
              }}
            </List>
          </div>
        </div>

        {/* 発行ボタン */}
        <div className="pt-2">
          <button
            onClick={handlePrint}
            disabled={isIssuingRequest || isSavingDraft || (requiresBrowserPrintPreview && selectedMccbIds.length > 0 && !isPrintPreviewReady)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-lg text-sm cursor-pointer w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {issueButtonLabel}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isIssuingRequest || isSavingDraft}
            className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-black px-6 py-2.5 rounded-lg text-sm cursor-pointer w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSavingDraft ? "仮発行中..." : "仮発行として保存"}
          </button>
        </div>

        <StatusMessageRail
          message={formMessage}
          onClose={() => setFormMessage(null)}
        />
      </div>

      {/* 右側：印刷プレビューコンポーネント */}
      <PrintPreviewForm
        workerName={workerName}
        workContent={workContent}
        now={now}
        dateCode={dateCode}
        selectedMccbsWithAssignedCards={selectedMccbsWithAssignedCards}
        isPreviewLoading={isPreviewLoading}
        previewError={previewError}
      />
    </div>
  );
}
