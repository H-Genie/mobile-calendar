"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventItem } from "@/lib/events";
import { datedKeys, todayISO } from "@/lib/date";
import { scrollToMarker } from "@/lib/scroll";

const PAGE_SIZE = 20;
const AM_TITLE = "am";
const MAX_JUMP_PAGES = 40;

type FetchResult = {
  events: EventItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type ScrollTarget = { id: string; token: number };
export type PrependAnchor = { token: number; height: number; top: number };

async function fetchEvents(
  params: Record<string, string>
): Promise<FetchResult> {
  const qs = new URLSearchParams({
    pageSize: String(PAGE_SIZE),
    ...params,
  });
  const res = await fetch(`/api/notion?${qs}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "조회에 실패했습니다.");
  }
  return {
    events: data.events ?? [],
    hasMore: Boolean(data.hasMore),
    nextCursor: data.nextCursor ?? null,
  };
}

function mergeUnique(
  existing: EventItem[],
  incoming: EventItem[],
  mode: "prepend" | "append"
) {
  const seen = new Set(existing.map((e) => e.id));
  const fresh = incoming.filter((e) => !seen.has(e.id));
  return mode === "prepend" ? [...fresh, ...existing] : [...existing, ...fresh];
}

export function useCalendarEvents() {
  const today = todayISO();
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMorePast, setHasMorePast] = useState(true);
  const [hasMoreFuture, setHasMoreFuture] = useState(true);
  const [amOnly, setAmOnly] = useState(false);
  const [viewMonth, setViewMonth] = useState(today.slice(0, 7));
  const [prependAnchor, setPrependAnchor] = useState<PrependAnchor | null>(
    null
  );
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
  const [suspendScrollLoad, setSuspendScrollLoad] = useState(false);

  const itemsRef = useRef<EventItem[]>([]);
  const amOnlyRef = useRef(false);
  const futureCursorRef = useRef<string | null>(null);
  const pastCursorRef = useRef<string | null>(null);
  const pastBeforeRef = useRef(today);
  const anchorRef = useRef(today);
  const hasMorePastRef = useRef(true);
  const hasMoreFutureRef = useRef(true);
  const loadingPastRef = useRef(false);
  const loadingFutureRef = useRef(false);
  const jumpRef = useRef(false);
  const prependTokenRef = useRef(0);
  const scrollTokenRef = useRef(0);

  const visibleItems = useMemo(() => {
    if (!amOnly) return items;
    return items.filter(
      (item) => item.title.trim().toLowerCase() === AM_TITLE
    );
  }, [items, amOnly]);

  const requestScroll = useCallback((id: string) => {
    scrollTokenRef.current += 1;
    setScrollTarget({ id, token: scrollTokenRef.current });
  }, []);

  const loadPast = useCallback(async (fromJump = false) => {
    if (loadingPastRef.current || !hasMorePastRef.current) return false;
    if (jumpRef.current && !fromJump) return false;

    loadingPastRef.current = true;
    setLoadingPast(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        direction: "past",
        before: pastBeforeRef.current,
      };
      if (pastCursorRef.current) params.cursor = pastCursorRef.current;

      const data = await fetchEvents(params);
      if (data.events.length === 0) {
        setHasMorePast(false);
        hasMorePastRef.current = false;
        return false;
      }

      prependTokenRef.current += 1;
      setPrependAnchor({
        token: prependTokenRef.current,
        height: document.documentElement.scrollHeight,
        top: window.scrollY,
      });
      setItems((prev) => {
        const next = mergeUnique(prev, data.events, "prepend");
        itemsRef.current = next;
        return next;
      });
      setHasMorePast(data.hasMore);
      hasMorePastRef.current = data.hasMore;
      pastCursorRef.current = data.nextCursor;
      return true;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "과거 일정 로딩 실패");
      return false;
    } finally {
      loadingPastRef.current = false;
      setLoadingPast(false);
    }
  }, []);

  const loadFuture = useCallback(async (fromJump = false) => {
    if (loadingFutureRef.current || !hasMoreFutureRef.current) return false;
    if (jumpRef.current && !fromJump) return false;
    if (!futureCursorRef.current) {
      setHasMoreFuture(false);
      hasMoreFutureRef.current = false;
      return false;
    }

    loadingFutureRef.current = true;
    setLoadingFuture(true);
    setError(null);

    try {
      const data = await fetchEvents({
        direction: "future",
        after: anchorRef.current,
        cursor: futureCursorRef.current,
      });
      setItems((prev) => {
        const next = mergeUnique(prev, data.events, "append");
        itemsRef.current = next;
        return next;
      });
      setHasMoreFuture(data.hasMore);
      hasMoreFutureRef.current = data.hasMore;
      futureCursorRef.current = data.nextCursor;
      return data.events.length > 0;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "이후 일정 로딩 실패");
      return false;
    } finally {
      loadingFutureRef.current = false;
      setLoadingFuture(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchEvents({
          direction: "initial",
          after: today,
        });
        itemsRef.current = data.events;
        setItems(data.events);
        setHasMoreFuture(data.hasMore);
        hasMoreFutureRef.current = data.hasMore;
        futureCursorRef.current = data.nextCursor;
        pastBeforeRef.current = today;
        anchorRef.current = today;
        pastCursorRef.current = null;
        setHasMorePast(true);
        hasMorePastRef.current = true;
        requestScroll("today-line");
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "요청 중 오류가 발생했습니다."
        );
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadInitial();
  }, [requestScroll, today]);

  const ensureDateLoaded = useCallback(
    async (target: string) => {
      for (let page = 0; page < MAX_JUMP_PAGES; page += 1) {
        const keys = datedKeys(itemsRef.current);
        const min = keys[0];
        const max = keys[keys.length - 1];
        if (!min || !max) {
          if (hasMoreFutureRef.current && (await loadFuture(true))) continue;
          if (hasMorePastRef.current && (await loadPast(true))) continue;
          return;
        }
        if (target > max) {
          if (!(await loadFuture(true))) return;
          continue;
        }
        if (target < min) {
          const windowAlreadyStartsHere =
            anchorRef.current <= target && min >= anchorRef.current;
          if (windowAlreadyStartsHere || !(await loadPast(true))) return;
          continue;
        }
        return;
      }
    },
    [loadFuture, loadPast]
  );

  const scrollToDate = useCallback(
    async (target: string, preferToday: boolean) => {
      if (jumpRef.current) return;
      jumpRef.current = true;
      setSuspendScrollLoad(true);
      try {
        await ensureDateLoaded(target);
        const source = amOnlyRef.current
          ? itemsRef.current.filter(
              (item) => item.title.trim().toLowerCase() === AM_TITLE
            )
          : itemsRef.current;
        const keys = datedKeys(source);
        if (preferToday) {
          if (scrollToMarker("today-line")) return;
          const lineWillRender =
            keys.length === 0 ||
            keys.some((key) => key >= target) ||
            !hasMoreFutureRef.current;
          requestScroll(
            lineWillRender
              ? "today-line"
              : `day-${keys[keys.length - 1]}`
          );
          return;
        }
        const hit = keys.find((key) => key >= target);
        requestScroll(
          hit
            ? `day-${hit}`
            : keys.length
              ? `day-${keys[keys.length - 1]}`
              : "list-start"
        );
      } finally {
        jumpRef.current = false;
        setSuspendScrollLoad(false);
      }
    },
    [ensureDateLoaded, requestScroll]
  );

  const handleGoToday = useCallback(() => {
    setViewMonth(today.slice(0, 7));
    scrollToDate(today, true);
  }, [scrollToDate, today]);

  const handleToggleAm = useCallback(() => {
    setAmOnly((prev) => {
      amOnlyRef.current = !prev;
      return !prev;
    });
  }, []);

  const handleGoMonth = useCallback(
    (month: string) => {
      if (!/^\d{4}-\d{2}$/.test(month)) return;
      setViewMonth(month);
      scrollToDate(`${month}-01`, false);
    },
    [scrollToDate]
  );

  return {
    items: visibleItems,
    loading,
    loadingPast,
    loadingFuture,
    hasMorePast,
    hasMoreFuture,
    error,
    todayKey: today,
    monthValue: viewMonth,
    prependAnchor,
    scrollTarget,
    suspendScrollLoad,
    amOnly,
    onLoadPast: () => {
      void loadPast(false);
    },
    onLoadFuture: () => {
      void loadFuture(false);
    },
    onGoToday: handleGoToday,
    onToggleAm: handleToggleAm,
    onGoMonth: handleGoMonth,
    onScrollHandled: () => setScrollTarget(null),
  };
}
