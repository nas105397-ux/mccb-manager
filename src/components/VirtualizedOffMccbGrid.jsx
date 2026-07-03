import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VariableSizeGrid as Grid } from 'react-window';
import { getCategoryBadgeClass } from '../shared/categoryColorUtils';

const getColumnCountFromLayout = (colLayout, width) => {
  if (colLayout === 'auto') return Math.max(1, Math.floor(width / 330));

  if (colLayout === '3') {
    if (width >= 1024) return 3;
    if (width >= 768) return 2;
    return 1;
  }

  if (colLayout === '4') {
    if (width >= 1280) return 4;
    if (width >= 1024) return 3;
    if (width >= 640) return 2;
    return 1;
  }

  if (colLayout === '5') {
    if (width >= 1536) return 5;
    if (width >= 1280) return 4;
    if (width >= 768) return 3;
    if (width >= 640) return 2;
    return 1;
  }

  return Math.max(1, Math.floor(width / 330));
};

const WorkerBadge = memo(function WorkerBadge({ card, isDarkMode }) {
  return (
    <span
      className={`text-sm border-2 px-3 py-1 rounded font-black flex items-center gap-2 whitespace-nowrap ${
        isDarkMode ? 'bg-gray-950 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-800'
      }`}
    >
      <span
        className={`font-mono text-xs px-1.5 py-0.5 rounded ${
          isDarkMode ? 'bg-amber-950 text-amber-400' : 'bg-amber-100 text-amber-700'
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
    ? (isDarkMode ? 'bg-sky-950/40 border-sky-500' : 'bg-sky-50/70 border-sky-500')
    : (isDarkMode ? 'bg-gray-800 border-red-600' : 'bg-red-50/40 border-red-500');
  const titleBorderClass = isReturnedPowerOff
    ? (isDarkMode ? 'border-sky-800' : 'border-sky-200')
    : (isDarkMode ? 'border-gray-700' : 'border-red-200');
  const sectionTextClass = isReturnedPowerOff
    ? (isDarkMode ? 'text-sky-300' : 'text-sky-700')
    : (isDarkMode ? 'text-gray-400' : 'text-gray-500');
  const footerClass = isReturnedPowerOff
    ? (isDarkMode ? 'border-sky-800/70 text-sky-300' : 'border-sky-200 text-sky-700')
    : (isDarkMode ? 'border-gray-700/60 text-gray-500' : 'border-red-200 text-gray-400');
  const statusBadgeClass = isReturnedPowerOff
    ? (isDarkMode ? 'bg-sky-950 text-sky-300 border-sky-800' : 'bg-sky-100 text-sky-800 border-sky-300')
    : (isDarkMode ? 'bg-red-950 text-red-500 border-red-900/40' : 'bg-red-100 text-red-700 border-red-200');

  return (
    <div
      className={`border-2 rounded-xl p-5 flex flex-col justify-between min-h-[200px] h-full ${cardClass}`}
    >
      <div>
        <div className="flex justify-between items-start gap-2 mb-2">
          <span
            className={`text-xs border px-2.5 py-0.5 rounded font-black truncate ${
              isDarkMode ? 'bg-gray-950 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-600'
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
              ? (isDarkMode ? 'text-amber-400 font-extrabold' : 'text-orange-400 font-extrabold')
              : (isDarkMode ? 'text-white' : 'text-gray-900')
          } ${titleBorderClass}`}
        >
          {mccb.name}
        </h3>

        <div className="space-y-1.5">
          <p className={`text-xs font-extrabold tracking-wider ${sectionTextClass}`}>
            {isReturnedPowerOff ? '▼ 子札状態:' : '▼ 子札保持者:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {isReturnedPowerOff ? (
              <span
                className={`text-xs font-black px-2.5 py-1 rounded border ${
                  isDarkMode ? 'bg-sky-950/70 border-sky-800 text-sky-300' : 'bg-sky-100 border-sky-300 text-sky-800'
                }`}
              >
                ✅ 子札返却済み
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
          {isReturnedPowerOff ? '札返却済み' : '操作禁止'}
        </span>
      </div>
    </div>
  );
});

const MeasuredOffMccbCard = memo(function MeasuredOffMccbCard({
  meta,
  itemIndex,
  rowIndex,
  isDarkMode,
  categoryColors,
  onHeightMeasured,
}) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!wrapperRef.current) return;

    const measure = () => {
      if (!wrapperRef.current) return;
      const nextHeight = Math.ceil(wrapperRef.current.getBoundingClientRect().height);
      onHeightMeasured(itemIndex, rowIndex, nextHeight);
    };

    measure();

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(wrapperRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [itemIndex, rowIndex, onHeightMeasured, meta.workers.length, meta.item.name]);

  return (
    <div ref={wrapperRef}>
      <OffMccbCard
        mccb={meta.item}
        workers={meta.workers}
        isAlternative={meta.isAlternative}
        isDarkMode={isDarkMode}
        categoryColors={categoryColors}
      />
    </div>
  );
});

export default function VirtualizedOffMccbGrid({
  items,
  colLayout,
  isDarkMode,
  categoryColors = {},
}) {
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [measuredHeights, setMeasuredHeights] = useState({});

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const nextWidth = Math.floor(rect.width);
      const nextHeight = Math.floor(rect.height);

      setViewportSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) return prev;
        return { width: nextWidth, height: nextHeight };
      });
    };

    measure();
    window.addEventListener('resize', measure);

    let observer;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', measure);
      if (observer) observer.disconnect();
    };
  }, []);

  const gap = 16;
  const rowGap = 16;
  const baseCardHeight = 210;
  const badgeRowHeight = 42;
  const emptyStateExtraHeight = 16;
  const rowSafetyHeight = 28;
  const width = Math.max(0, viewportSize.width - 4);
  const height = Math.max(0, viewportSize.height);
  const columnCount = getColumnCountFromLayout(colLayout, width);
  const rowCount = Math.ceil(items.length / columnCount);
  const columnWidth = Math.max(1, Math.floor((width - gap * (columnCount - 1)) / columnCount));

  const estimatedBadgesPerRow = Math.max(1, Math.floor((columnWidth - 40) / 145));
  const itemMetas = useMemo(() => {
    return items.map((item) => {
      const workers = item.childCards?.filter((c) => c.isBorrowed) || [];
      const isAlternative = item.name.includes('(');
      const measuredHeight = measuredHeights[`${columnWidth}:${item.id}`];

      if (workers.length === 0) {
        return {
          item,
          workers,
          isAlternative,
          estimatedHeight: baseCardHeight + emptyStateExtraHeight + rowSafetyHeight,
          measuredHeight,
        };
      }

      const badgeRows = Math.ceil(workers.length / estimatedBadgesPerRow);
      return {
        item,
        workers,
        isAlternative,
        estimatedHeight: baseCardHeight + badgeRows * badgeRowHeight + rowSafetyHeight,
        measuredHeight,
      };
    });
  }, [items, estimatedBadgesPerRow, measuredHeights, columnWidth]);

  const onHeightMeasured = useCallback((itemIndex, rowIndex, nextHeight) => {
    const item = items[itemIndex];
    if (!item || nextHeight <= 0) return;
    const cacheKey = `${columnWidth}:${item.id}`;

    setMeasuredHeights((prev) => {
      if (prev[cacheKey] === nextHeight) return prev;
      return { ...prev, [cacheKey]: nextHeight };
    });

    if (gridRef.current) {
      gridRef.current.resetAfterIndices({
        columnIndex: 0,
        rowIndex,
        shouldForceUpdate: false,
      });
    }
  }, [items, columnWidth]);

  const rowHeights = useMemo(() => {
    return Array.from({ length: rowCount }, (_, rowIndex) => {
      const from = rowIndex * columnCount;
      let maxHeight = baseCardHeight;

      for (let i = 0; i < columnCount; i += 1) {
        const meta = itemMetas[from + i];
        const itemHeight = meta?.measuredHeight ?? meta?.estimatedHeight;
        if (itemHeight && itemHeight > maxHeight) {
          maxHeight = itemHeight;
        }
      }

      return maxHeight + rowGap;
    });
  }, [rowCount, columnCount, itemMetas]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.resetAfterIndices({ columnIndex: 0, rowIndex: 0, shouldForceUpdate: true });
    }
  }, [rowHeights, columnWidth, columnCount]);

  return (
    <div ref={containerRef} className="flex-1 pr-1 min-h-0 w-full">
      {width > 0 && height > 0 && (
        <Grid
          ref={gridRef}
          columnCount={columnCount}
          columnWidth={() => columnWidth}
          height={height}
          rowCount={rowCount}
          rowHeight={(index) => rowHeights[index] ?? (baseCardHeight + rowGap)}
          width={width}
          overscanRowCount={2}
          overscanColumnCount={1}
        >
          {({ columnIndex, rowIndex, style }) => {
            const index = rowIndex * columnCount + columnIndex;
            const meta = itemMetas[index];

            if (!meta) return <div style={style} />;

            return (
              <div
                style={{
                  ...style,
                  paddingRight: columnIndex < columnCount - 1 ? gap : 0,
                  paddingBottom: rowIndex < rowCount - 1 ? rowGap : 0,
                  boxSizing: 'border-box',
                }}
              >
                <MeasuredOffMccbCard
                  meta={meta}
                  itemIndex={index}
                  rowIndex={rowIndex}
                  isDarkMode={isDarkMode}
                  categoryColors={categoryColors}
                  onHeightMeasured={onHeightMeasured}
                />
              </div>
            );
          }}
        </Grid>
      )}
    </div>
  );
}
