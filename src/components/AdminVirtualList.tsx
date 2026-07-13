import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

type AdminVirtualListProps<T> = {
  items: T[];
  estimateSize?: number;
  maxHeight?: number;
  className?: string;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
};

export function AdminVirtualList<T>({
  items,
  estimateSize = 120,
  maxHeight = 640,
  className,
  getKey,
  renderItem,
}: AdminVirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 6,
  });

  if (items.length === 0) return null;

  return (
    <div ref={parentRef} className={className} style={{ maxHeight, overflow: "auto" }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={getKey(item, virtualRow.index)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AdminVirtualTableRowsProps<T> = {
  items: T[];
  colSpan: number;
  estimateRowHeight?: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  /** When this changes, scroll position resets to the top (e.g. search or page). */
  resetKey?: string;
  getKey: (item: T, index: number) => string;
  getRowClassName?: (item: T, index: number) => string;
  renderCells: (item: T, index: number) => ReactNode;
};

/** Renders virtualized table rows inside a scrollable table (thead stays sticky outside). */
export function AdminVirtualTableRows<T>({
  items,
  colSpan,
  estimateRowHeight = 76,
  scrollRef,
  resetKey,
  getKey,
  getRowClassName,
  renderCells,
}: AdminVirtualTableRowsProps<T>) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    virtualizer.scrollToOffset(0);
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps -- scroll only when list context changes

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <>
      {paddingTop > 0 ? (
        <tr aria-hidden>
          <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: "none" }} />
        </tr>
      ) : null}
      {virtualRows.map((virtualRow) => {
        const item = items[virtualRow.index];
        return (
          <tr
            key={getKey(item, virtualRow.index)}
            data-index={virtualRow.index}
            className={getRowClassName?.(item, virtualRow.index)}
          >
            {renderCells(item, virtualRow.index)}
          </tr>
        );
      })}
      {paddingBottom > 0 ? (
        <tr aria-hidden>
          <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: "none" }} />
        </tr>
      ) : null}
    </>
  );
}
