// 一覧に表示する MCCB カード。送電状態を最優先に、貸出・依頼の進捗を補助情報として表示する。
import React from "react";
import { useMccbCardController } from "../hooks/useMccbCardController";
import { getCategoryBadgeClass } from "../shared/categoryColorUtils";

/**
 * カード枠・色帯は実際の電源状態を表す（緑＝送電中系、赤＝停電中系）。
 * 送電可能／依頼発行中などの細かい状態はバッジの色と文言で判別する。
 * 色だけでなく、同じ位置の文言・記号でも判別できるようにする。
 */
const CARD_STATUS = {
  returnedPowerOff: {
    label: "送電可能",
    icon: "✓",
    cardClass: "border-red-400 bg-red-50/70",
    stripeClass: "bg-red-600",
    badgeClass: "bg-sky-600 text-white",
    countClass: "text-sky-800 bg-sky-100 border-sky-300",
  },
  powerOff: {
    label: "停電中",
    icon: "!",
    cardClass: "border-red-400 bg-red-50/70",
    stripeClass: "bg-red-600",
    badgeClass: "bg-red-600 text-white",
    countClass: "text-amber-800 bg-amber-50 border-amber-300",
  },
  activeRequest: {
    label: "依頼発行中",
    icon: "…",
    cardClass: "border-green-400 bg-green-50/70",
    stripeClass: "bg-green-600",
    badgeClass: "bg-amber-500 text-white",
    countClass: "text-amber-800 bg-amber-100 border-amber-300",
  },
  normal: {
    label: "送電中",
    icon: "●",
    cardClass: "border-green-400 bg-green-50/70",
    stripeClass: "bg-green-600",
    badgeClass: "bg-green-600 text-white",
  },
};

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
  const statusKey = isReturnedPowerOff
    ? "returnedPowerOff"
    : isPowerOff
      ? "powerOff"
      : hasActiveRequest
        ? "activeRequest"
        : "normal";
  const status = CARD_STATUS[statusKey];

  return (
    <div
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={`p-4 pl-5 rounded-xl border relative flex flex-col justify-between min-h-[156px] overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${status.cardClass} ${className}`}
      role="button"
      tabIndex={0}
      aria-label={`${name}：${status.label}`}
    >
      {/* 一覧を見渡した時に判別できる固定の状態色帯 */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${status.stripeClass}`} aria-hidden="true" />

      <div>
        {/* 状態・電気室・区分を同じ位置に集約し、色覚に依存しない */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_1.75rem] items-start gap-1.5 mb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-black tracking-wide ${status.badgeClass}`}>
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-white/70 text-[10px] leading-none" aria-hidden="true">{status.icon}</span>
              {status.label}
            </span>
            <span className="shrink-0 text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-1 py-0 rounded font-bold">
              {room}
            </span>
            <span className={`shrink-0 text-[10px] px-1 py-0 rounded border font-black ${badgeColor}`}>
              {category}
            </span>
          </div>
          <button
            onClick={handleToggleFavorite}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-lg leading-none focus:outline-none cursor-pointer ${
              isFavorite
                ? "text-amber-500 font-bold"
                : "text-gray-300 hover:text-amber-400"
            }`}
            title={isFavorite ? "お気に入り解除" : "お気に入り登録"}
            aria-label={isFavorite ? "お気に入りを外す" : "お気に入りに追加"}
          >
            {isFavorite ? "★" : "☆"}
          </button>
        </div>
        <h3
          className="text-sm font-black text-gray-800 leading-snug truncate mb-2"
          title={name}
        >
          {name}
        </h3>
      </div>

      {/* 送電状態と混同しないよう、子札の状況は下部に集約する */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200/80 text-xs font-bold">
        <span className="text-gray-500 font-bold">子札の貸出状況</span>
        {statusKey === "normal" ? (
          <span className="text-gray-400 font-normal">貸出なし</span>
        ) : (
          <span className={`${status.countClass} px-2 py-0.5 rounded border font-mono`}>
            子札: {borrowedCount} 枚
          </span>
        )}
      </div>
    </div>
  );
}

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
