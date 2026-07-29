// モニター画面向けの停電中 MCCB スライド表示。画面に収まる分だけ表示し、一定間隔でページを自動切り替える。
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { getCategoryBadgeClass } from "../shared/categoryColorUtils";
import { useResizeObserverEffect } from "../hooks/useResizeObserverEffect";

// カード幅(330px目安)を守りつつ、画面幅に応じて列数を自動算出する。
const getColumnCount = (width) => Math.max(1, Math.floor(width / 330));

const COLUMN_GAP = 16;
const ROW_GAP = 16;
const BASE_CARD_HEIGHT = 210;
const BADGE_ROW_HEIGHT = 42;
const EMPTY_STATE_EXTRA_HEIGHT = 16;
const ROW_SAFETY_HEIGHT = 28;
const PAGE_INDICATOR_HEIGHT = 28;
const SLIDE_INTERVAL_MS = 10000;

const WorkerBadge = memo(function WorkerBadge({ card, isDarkMode }) {
  return (
    <span
      className={`text-sm border-2 px-3 py-1 rounded font-black flex items-center gap-2 whitespace-nowrap ${
        isDarkMode ? "bg-gray-950 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-800"
      }`}
    >
      <span
        className={`font-mono text-xs px-1.5 py-0.5 rounded ${
          isDarkMode ? "bg-amber-950 text-amber-400" : "bg-amber-100 text-amber-700"
        }`}
      >
        No.{card.id}
      </span>
      {card.workerName}
    </span>
  );
});

const OffMccbCard = memo(function OffMccbCard({
  mccb,
  workers,
  isAlternative,
  isDarkMode,
  categoryColors,
}) {
  const isReturnedPowerOff = workers.length === 0;
  const cardClass = isReturnedPowerOff
    ? (isDarkMode ? "bg-sky-950/40 border-sky-500" : "bg-sky-50/70 border-sky-500")
    : (isDarkMode ? "bg-red-950/40 border-red-500" : "bg-red-50/70 border-red-500");
  const titleBorderClass = isReturnedPowerOff
    ? (isDarkMode ? "border-sky-800" : "border-sky-200")
    : (isDarkMode ? "border-red-800" : "border-red-200");
  const sectionTextClass = isReturnedPowerOff
    ? (isDarkMode ? "text-sky-300" : "text-sky-700")
    : (isDarkMode ? "text-red-300" : "text-red-700");
  const footerClass = isReturnedPowerOff
    ? (isDarkMode ? "border-sky-800/70 text-sky-300" : "border-sky-200 text-sky-700")
    : (isDarkMode ? "border-red-800/70 text-red-300" : "border-red-200 text-red-700");
  const statusBadgeClass = isReturnedPowerOff
    ? (isDarkMode ? "bg-sky-950 text-sky-300 border-sky-800" : "bg-sky-100 text-sky-800 border-sky-300")
    : (isDarkMode ? "bg-red-950 text-red-500 border-red-900/40" : "bg-red-100 text-red-700 border-red-200");

  return (
    <div
      className={`border-2 rounded-xl p-5 flex flex-col justify-between min-h-[200px] h-full ${cardClass}`}
    >
      <div>
        <div className="flex justify-between items-start gap-2 mb-2">
          <span
            className={`text-xs border px-2.5 py-0.5 rounded font-black truncate ${
              isDarkMode ? "bg-gray-950 border-gray-700 text-gray-300" : "bg-white border-gray-300 text-gray-600"
            }`}
          >
            {mccb.room}
          </span>
          <span className={`text-xs border px-2.5 py-0.5 rounded font-black shrink-0 ${getCategoryBadgeClass(mccb.category, categoryColors, isDarkMode)}`}>
            {mccb.category}
          </span>
        </div>

        <h3
          className={`text-2xl font-black tracking-wide border-b-2 pb-2 mb-3 truncate ${
            isAlternative
              ? (isDarkMode ? "text-amber-400 font-extrabold" : "text-orange-400 font-extrabold")
              : (isDarkMode ? "text-white" : "text-gray-900")
          } ${titleBorderClass}`}
        >
          {mccb.name}
        </h3>

        <div className="space-y-1.5">
          <p className={`text-xs font-extrabold tracking-wider ${sectionTextClass}`}>
            {isReturnedPowerOff ? "▼ 子札状態:" : "▼ 子札保持者:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {isReturnedPowerOff ? (
              <span
                className={`text-xs font-black px-2.5 py-1 rounded border ${
                  isDarkMode ? "bg-sky-950/70 border-sky-800 text-sky-300" : "bg-sky-100 border-sky-300 text-sky-800"
                }`}
              >
                ✅ 送電可能
              </span>
            ) : (
              workers.map((card) => (
                <WorkerBadge key={card.id} card={card} isDarkMode={isDarkMode} />
              ))
            )}
          </div>
        </div>
      </div>

      <div
        className={`mt-4 pt-2 border-t flex justify-between items-center text-[10px] font-mono ${
          footerClass
        }`}
      >
        <span>ID: {mccb.id}</span>
        <span
          className={`px-1.5 py-0.5 rounded font-black border ${
            statusBadgeClass
          }`}
        >
          {isReturnedPowerOff ? "送電可能" : "操作禁止"}
        </span>
      </div>
    </div>
  );
});

export default function OffMccbSlideGrid({
  items,
  isDarkMode,
  categoryColors = {},
}) {
  const containerRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pageIndex, setPageIndex] = useState(0);

  const measureViewport = () => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const nextWidth = Math.floor(rect.width);
    const nextHeight = Math.floor(rect.height);

    setViewportSize((prev) => {
      if (prev.width === nextWidth && prev.height === nextHeight) return prev;
      return { width: nextWidth, height: nextHeight };
    });
  };

  useResizeObserverEffect([containerRef], measureViewport, []);

  const width = Math.max(0, viewportSize.width - 4);
  // ページ切替インジケーター分の高さを常に差し引き、表示件数がページをまたいで揺れ動かないようにする。
  const gridHeight = Math.max(0, viewportSize.height - PAGE_INDICATOR_HEIGHT);
  const columnCount = getColumnCount(width);
  const columnWidth = Math.max(1, Math.floor((width - COLUMN_GAP * (columnCount - 1)) / columnCount));
  const estimatedBadgesPerRow = Math.max(1, Math.floor((columnWidth - 40) / 145));

  // 画面に収まる行数ぶんずつをまとめ、1ページ分の表示件数を決める。
  const pages = useMemo(() => {
    if (items.length === 0 || width <= 0 || gridHeight <= 0) return [];

    const itemMetas = items.map((item) => {
      const workers = item.childCards?.filter((c) => c.isBorrowed) || [];
      const isAlternative = item.name.includes("(");
      const estimatedHeight = workers.length === 0
        ? BASE_CARD_HEIGHT + EMPTY_STATE_EXTRA_HEIGHT + ROW_SAFETY_HEIGHT
        : BASE_CARD_HEIGHT + Math.ceil(workers.length / estimatedBadgesPerRow) * BADGE_ROW_HEIGHT + ROW_SAFETY_HEIGHT;
      return { item, workers, isAlternative, estimatedHeight };
    });

    const rows = [];
    for (let i = 0; i < itemMetas.length; i += columnCount) {
      const rowMetas = itemMetas.slice(i, i + columnCount);
      const rowHeight = Math.max(...rowMetas.map((meta) => meta.estimatedHeight)) + ROW_GAP;
      rows.push({ metas: rowMetas, rowHeight });
    }

    const result = [];
    let currentRows = [];
    let currentHeight = 0;

    rows.forEach((row) => {
      const wouldOverflow = currentRows.length > 0 && currentHeight + row.rowHeight > gridHeight;
      if (wouldOverflow) {
        result.push(currentRows);
        currentRows = [];
        currentHeight = 0;
      }
      currentRows.push(row);
      currentHeight += row.rowHeight;
    });

    if (currentRows.length > 0) result.push(currentRows);
    return result;
  }, [items, columnCount, estimatedBadgesPerRow, gridHeight, width]);

  useEffect(() => {
    if (pages.length <= 1) return undefined;
    const timer = setInterval(() => {
      setPageIndex((prev) => prev + 1);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pages.length]);

  // ページ数がデータ更新で変わっても、剰余で範囲内に丸めて表示する（カウンター自体はクランプしない）。
  const displayPageIndex = pages.length === 0 ? 0 : pageIndex % pages.length;
  const currentRows = pages[displayPageIndex] ?? [];

  return (
    <div ref={containerRef} className="flex-1 min-h-0 w-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col" style={{ gap: ROW_GAP }}>
        {currentRows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, gap: COLUMN_GAP }}
          >
            {row.metas.map((meta) => (
              <OffMccbCard
                key={meta.item.id}
                mccb={meta.item}
                workers={meta.workers}
                isAlternative={meta.isAlternative}
                isDarkMode={isDarkMode}
                categoryColors={categoryColors}
              />
            ))}
          </div>
        ))}
      </div>

      {pages.length > 1 && (
        <div
          className="shrink-0 flex items-center justify-center gap-1.5"
          style={{ height: PAGE_INDICATOR_HEIGHT }}
        >
          {pages.map((_, idx) => (
            <span
              key={idx}
              className={`rounded-full transition-all duration-300 h-1.5 ${
                idx === displayPageIndex
                  ? `w-5 ${isDarkMode ? "bg-teal-400" : "bg-blue-600"}`
                  : `w-1.5 ${isDarkMode ? "bg-gray-700" : "bg-gray-300"}`
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
