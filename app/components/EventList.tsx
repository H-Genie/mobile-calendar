"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { EventItem } from "@/lib/events";
import { dateKey, formatDayLabel } from "@/lib/date";
import { scrollToMarker } from "@/lib/scroll";
import { AppHeader } from "@/app/components/AppHeader";
import { DaySection } from "@/app/components/DaySection";
import type {
  PrependAnchor,
  ScrollTarget,
} from "@/app/hooks/useCalendarEvents";

type EventListProps = {
  items: EventItem[];
  loading: boolean;
  loadingPast: boolean;
  loadingFuture: boolean;
  hasMorePast: boolean;
  hasMoreFuture: boolean;
  error: string | null;
  todayKey: string;
  monthValue: string;
  prependAnchor: PrependAnchor | null;
  scrollTarget: ScrollTarget | null;
  suspendScrollLoad: boolean;
  amOnly: boolean;
  onLoadPast: () => void;
  onLoadFuture: () => void;
  onGoToday: () => void;
  onToggleAm: () => void;
  onGoMonth: (month: string) => void;
  onScrollHandled: () => void;
};

type DayGroup = {
  key: string;
  label: string;
  isToday: boolean;
  items: EventItem[];
};

function groupByDay(items: EventItem[], todayKey: string): DayGroup[] {
  const map = new Map<string, EventItem[]>();
  for (const item of items) {
    const key = dateKey(item.date);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }

  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    label: formatDayLabel(key, todayKey),
    isToday: key === todayKey,
    items: groupItems,
  }));
}

function todayLineIndex(
  groups: DayGroup[],
  todayKey: string,
  hasMoreFuture: boolean
): number | "end" | null {
  const idx = groups.findIndex(
    (group) => group.key !== "no-date" && group.key >= todayKey
  );
  if (idx >= 0) return idx;
  if (!hasMoreFuture && groups.length > 0) return "end";
  return null;
}

export function EventList({
  items,
  loading,
  loadingPast,
  loadingFuture,
  hasMorePast,
  hasMoreFuture,
  error,
  todayKey,
  monthValue,
  prependAnchor,
  scrollTarget,
  suspendScrollLoad,
  amOnly,
  onLoadPast,
  onLoadFuture,
  onGoToday,
  onToggleAm,
  onGoMonth,
  onScrollHandled,
}: EventListProps) {
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const onLoadPastRef = useRef(onLoadPast);
  const onLoadFutureRef = useRef(onLoadFuture);
  onLoadPastRef.current = onLoadPast;
  onLoadFutureRef.current = onLoadFuture;

  const groups = useMemo(() => groupByDay(items, todayKey), [items, todayKey]);
  const lineIndex = todayLineIndex(groups, todayKey, hasMoreFuture);
  const showEmptyTodayLine = items.length === 0;

  useLayoutEffect(() => {
    if (!prependAnchor) return;
    const diff = document.documentElement.scrollHeight - prependAnchor.height;
    window.scrollTo(0, prependAnchor.top + diff);
  }, [prependAnchor]);

  useEffect(() => {
    if (loading || !scrollTarget) return;
    if (scrollToMarker(scrollTarget.id)) {
      onScrollHandled();
    }
  }, [loading, scrollTarget, items, onScrollHandled]);

  useEffect(() => {
    if (loading || suspendScrollLoad) return;

    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!topEl || !bottomEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === topEl) onLoadPastRef.current();
          if (entry.target === bottomEl) onLoadFutureRef.current();
        }
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 }
    );

    observer.observe(topEl);
    observer.observe(bottomEl);
    return () => observer.disconnect();
  }, [loading, suspendScrollLoad, items.length]);

  return (
    <main className="calendar-main">
      <AppHeader
        monthValue={monthValue}
        amOnly={amOnly}
        onGoToday={onGoToday}
        onToggleAm={onToggleAm}
        onGoMonth={onGoMonth}
      />

      {error && <div className="calendar-error">{error}</div>}

      {loading ? (
        <div className="calendar-empty">불러오는 중…</div>
      ) : (
        <>
          <div ref={topSentinelRef} className="calendar-sentinel">
            {loadingPast ? (
              <span className="calendar-hint">이전 일정 불러오는 중…</span>
            ) : hasMorePast ? (
              <span className="calendar-hint">위로 스크롤 · 이전 일정</span>
            ) : (
              <span className="calendar-hint is-muted">이전 일정 없음</span>
            )}
          </div>

          {items.length === 0 ? (
            <div id="list-start">
              {showEmptyTodayLine && (
                <div id="today-line" className="today-line" />
              )}
              <div className="calendar-empty">
                {amOnly ? "am 일정이 없습니다." : "표시할 일정이 없습니다."}
              </div>
            </div>
          ) : (
            <div id="list-start" className="calendar-timeline">
              {groups.map((group, index) => (
                <div key={group.key}>
                  {lineIndex === index && (
                    <div id="today-line" className="today-line" />
                  )}
                  <DaySection
                    dayKey={group.key}
                    label={group.label}
                    isToday={group.isToday}
                    items={group.items}
                  />
                </div>
              ))}
              {lineIndex === "end" && (
                <div id="today-line" className="today-line" />
              )}
            </div>
          )}

          <div ref={bottomSentinelRef} className="calendar-sentinel">
            {loadingFuture ? (
              <span className="calendar-hint">이후 일정 불러오는 중…</span>
            ) : hasMoreFuture ? (
              <span className="calendar-hint">아래로 스크롤 · 이후 일정</span>
            ) : (
              <span className="calendar-hint is-muted">이후 일정 없음</span>
            )}
          </div>
        </>
      )}
    </main>
  );
}
