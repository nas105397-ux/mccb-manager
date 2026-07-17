// 一覧に表示する MCCB カード。状態色、貸出数、依頼中表示をまとめる。
import React from "react";
import { useMccbCardController } from "../hooks/useMccbCardController";
import { getCategoryBadgeClass } from "../shared/categoryColorUtils";

/** カード状態別ボーダー・背景クラス */
const CARD_STATUS_CLASS = {
  returnedPowerOff:
    "border-sky-500 bg-sky-50/60",
  powerOff:
    "border-red-500   bg-red-50/20",
  activeRequest:
    "border-violet-500 bg-violet-50/30",
  normal:
    "border-green-500 bg-green-50/20",
};

// ==========================================
// メインコンポーネント
// ==========================================
function MccbCard({
  mccb,
  borrowedCount = 0,
  onSelect,
  onToggleFavorite,
  hasActiveRequest = false,
  className = "",
  categoryColors = {},
}) {
  const {
    id: mccbId,
    isPowerOff,
    room,
    category,
    name,
    isFavorite,
  } = mccb || {};

  const { handleSelect, handleKeyDown, handleToggleFavorite } =
    useMccbCardController({ mccbId, isFavorite, onSelect, onToggleFavorite });

  const badgeColor = getCategoryBadgeClass(category, categoryColors);
  const isReturnedPowerOff = isPowerOff && borrowedCount === 0;
  const cardStatusCls = isReturnedPowerOff
    ? CARD_STATUS_CLASS.returnedPowerOff
    : isPowerOff
    ? CARD_STATUS_CLASS.powerOff
    : hasActiveRequest
      ? CARD_STATUS_CLASS.activeRequest
      : CARD_STATUS_CLASS.normal;

  return (
    <div
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={`p-4 rounded-xl border relative flex flex-col justify-between min-h-[140px] cursor-pointer ${cardStatusCls} ${className}`}
      role="button"
      tabIndex={0}
    >
      {/* ⭐ お気に入りトグルボタン */}
      <button
        onClick={handleToggleFavorite}
        className={`absolute top-3 right-3 text-lg focus:outline-none cursor-pointer z-10 ${
          isFavorite
            ? "text-amber-500 font-bold"
            : "text-gray-300 hover:text-amber-400"
        }`}
        title={isFavorite ? "お気に入り解除" : "お気に入り登録"}
        aria-label={isFavorite ? "お気に入りを外す" : "お気に入りに追加"}
      >
        {isFavorite ? "★" : "☆"}
      </button>

      {/* 📝 設置電気室・区分・設備名表示 */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded font-bold">
            {room}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border font-black ${badgeColor}`}
          >
            {category}
          </span>
        </div>
        <h3 className="text-sm font-black text-gray-800 leading-snug line-clamp-2 mb-2 pr-6">
          {name}
        </h3>
      </div>

      {/* ⚡ 下部ステータスバー */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs font-bold">
        {isPowerOff ? (
          <>
            <span className={`${isReturnedPowerOff ? "text-sky-700" : "text-red-600"} flex items-center gap-1 shrink-0`}>
              {isReturnedPowerOff ? "✅ 送電可能" : "🔴 停電中"}
            </span>
            <span className={`${isReturnedPowerOff ? "text-sky-800 bg-sky-100 border-sky-300" : "text-amber-700 bg-amber-50 border-amber-200"} px-2 py-0.5 rounded border font-mono`}>
              子札: {borrowedCount} 枚
            </span>
          </>
        ) : hasActiveRequest ? (
          <>
            <span className="text-violet-700 flex items-center gap-1 shrink-0">
              🟣 依頼発行中
            </span>
            <span className="text-violet-800 bg-violet-100 px-2 py-0.5 rounded border border-violet-300 font-mono">
              子札: {borrowedCount} 枚
            </span>
          </>
        ) : (
          <>
            <span className="text-green-600 flex items-center gap-1">
              🟢 通常送電
            </span>
            <span className="text-gray-400 font-normal">―</span>
          </>
        )}
      </div>
    </div>
  );
}

// ==========================================
// メモ化エクスポート（差分レンダリング最適化）
// ==========================================
export default React.memo(
  MccbCard,
  (prev, next) =>
    prev?.mccb?.id === next?.mccb?.id &&
    prev?.mccb?.isPowerOff === next?.mccb?.isPowerOff &&
    prev?.mccb?.isFavorite === next?.mccb?.isFavorite &&
    prev?.mccb?.name === next?.mccb?.name &&
    prev?.mccb?.room === next?.mccb?.room &&
    prev?.mccb?.category === next?.mccb?.category &&
    prev?.categoryColors === next?.categoryColors &&
    prev?.borrowedCount === next?.borrowedCount &&
    prev?.hasActiveRequest === next?.hasActiveRequest,
);
