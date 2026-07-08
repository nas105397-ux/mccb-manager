// MCCB 一覧の仮想スクロールグリッド。大量設備でも操作画面を軽く保つ。
import { useEffect, useRef, useState } from "react";
import { FixedSizeList as List } from "react-window";
import MccbCard from "./MccbCard";

// ブレークポイントは Tailwind のデフォルトに合わせる
const getColumnsFromWidth = (width) => {
  if (width >= 1024) return 4; // lg
  if (width >= 768) return 3; // md
  if (width >= 640) return 2; // sm
  return 1;
};

const getAvailableListHeight = (containerElement) => {
  if (typeof window === "undefined") return 400;

  if (!containerElement) {
    return Math.max(window.innerHeight - 260, 300);
  }

  const rect = containerElement.getBoundingClientRect();
  const bottomPadding = 16;
  return Math.max(window.innerHeight - rect.top - bottomPadding, 300);
};

export default function VirtualizedMccbGrid({
  items = [],
  borrowedCountMap = {},
  onSelect,
  onToggleFavorite,
  activeMccbIds = new Set(),
  categoryColors = {},
  // カード高さ推定値、列間（水平方向）ギャップ、行間（垂直方向）ギャップ
  estimatedCardHeight = 180,
  hGap = 12,
  rowGap = 12,
}) {
  const edgeGap = 2;
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  const [columns, setColumns] = useState(getColumnsFromWidth(containerWidth));
  const [listHeight, setListHeight] = useState(
    getAvailableListHeight(null),
  );

  useEffect(() => {
    const measure = () => {
      const width = containerRef.current
        ? Math.floor(containerRef.current.getBoundingClientRect().width)
        : window.innerWidth;
      setContainerWidth(width);
      setColumns(getColumnsFromWidth(width));
      setListHeight(getAvailableListHeight(containerRef.current));
    };

    measure();
    window.addEventListener("resize", measure);

    let ro;
    if (containerRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, []);

  const itemWidth = Math.floor(
    (containerWidth - edgeGap * 2 - hGap * (columns - 1)) / columns,
  );
  const rowCount = Math.ceil(items.length / columns);
  const rowHeight = estimatedCardHeight + rowGap; // 垂直ギャップは rowGap でコントロールする

  const Row = ({ index, style }) => {
    const from = index * columns;
    const cells = [];
    for (let col = 0; col < columns; col++) {
      const item = items[from + col];
      if (item) {
        const hasActive = activeMccbIds?.has(item.id) ?? false;
        cells.push(
          <div
            key={item.id}
            style={{ width: itemWidth, height: estimatedCardHeight }}
          >
            <MccbCard
              mccb={item}
              borrowedCount={borrowedCountMap[item.id] ?? 0}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
              hasActiveRequest={hasActive}
              className="h-full"
              categoryColors={categoryColors}
            />
          </div>,
        );
      } else {
        // 空セル（列の数が余る場合の埋め草）
        cells.push(<div key={`empty-${col}`} style={{ width: itemWidth }} />);
      }
    }

    return (
      <div
        style={{
          ...style,
          display: "flex",
          gap: `${hGap}px`,
          boxSizing: "border-box",
          width: "100%",
          paddingLeft: edgeGap,
          paddingRight: edgeGap,
          paddingBottom: 0,
          alignItems: "flex-start", // 子要素は固定高さ（estimatedCardHeight）にし、下側にギャップを作る
        }}
      >
        {cells}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-0">
      <List
        height={listHeight}
        itemCount={rowCount}
        itemSize={rowHeight}
        width={containerWidth}
        style={{ overflowX: "hidden" }}
      >
        {Row}
      </List>
    </div>
  );
}
