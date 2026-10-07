"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventList } from "@/app/components/EventList";
import type { EventItem } from "@/lib/events";
import { todayISO } from "@/lib/events";

const DATABASE_ID = process.env.NEXT_PUBLIC_DATABASE_ID;
const PAGE_SIZE = 20;
const AM_TITLE = "am";

type FetchResult = {
  events: EventItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

type FocusTarget = "today" | "start" | null;

async function fetchEvents(
  params: Record<string, string>
): Promise<FetchResult> {
  const qs = new URLSearchParams({
    databaseId: DATABASE_ID!,
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

function scrollToMarker(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const header = document.querySelector(".app-header");
  const headerH = header?.getBoundingClientRect().height ?? 0;
  const top = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  return true;
}

export default function HomePage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMorePast, setHasMorePast] = useState(true);
  const [hasMoreFuture, setHasMoreFuture] = useState(true);
  const [prependTick, setPrependTick] = useState(0);
  const [amOnly, setAmOnly] = useState(false);
  const [anchorDate, setAnchorDate] = useState(todayISO());
  const [focus, setFocus] = useState<FocusTarget>(null);

  const futureCursorRef = useRef<string | null>(null);
  const pastCursorRef = useRef<string | null>(null);
  const pastBeforeRef = useRef<string>(todayISO());
  const anchorRef = useRef(todayISO());
  const titleRef = useRef<string | null>(null);
  const hasMorePastRef = useRef(true);
  const hasMoreFutureRef = useRef(true);
  const loadingPastRef = useRef(false);
  const loadingFutureRef = useRef(false);
  const epochRef = useRef(0);

  const extraParams = useCallback((): Record<string, string> => {
    return titleRef.current ? { title: titleRef.current } : {};
  }, []);

  const reloadFrom = useCallback(
    async (afterDate: string, nextFocus: FocusTarget) => {
      if (!DATABASE_ID) {
        setError("NEXT_PUBLIC_DATABASE_ID가 설정되지 않았습니다.");
        setLoading(false);
        return;
      }

      const epoch = ++epochRef.current;
      loadingPastRef.current = false;
      loadingFutureRef.current = false;
      anchorRef.current = afterDate;
      pastBeforeRef.current = afterDate;
      pastCursorRef.current = null;
      futureCursorRef.current = null;

      setAnchorDate(afterDate);
      setLoading(true);
      setLoadingPast(false);
      setLoadingFuture(false);
      setError(null);
      setFocus(null);

      try {
        const data = await fetchEvents({
          direction: "initial",
          after: afterDate,
          ...extraParams(),
        });
        if (epoch !== epochRef.current) return;

        setItems(data.events);
        setHasMoreFuture(data.hasMore);
        hasMoreFutureRef.current = data.hasMore;
        futureCursorRef.current = data.nextCursor;

        setHasMorePast(true);
        hasMorePastRef.current = true;
        setFocus(nextFocus);
      } catch (err) {
        if (epoch !== epochRef.current) return;
        console.error(err);
        setError(
          err instanceof Error ? err.message : "요청 중 오류가 발생했습니다."
        );
        setItems([]);
      } finally {
        if (epoch === epochRef.current) setLoading(false);
      }
    },
    [extraParams]
  );

  useEffect(() => {
    reloadFrom(todayISO(), "today");
  }, [reloadFrom]);

  const loadPast = useCallback(async () => {
    if (!DATABASE_ID || loadingPastRef.current || !hasMorePastRef.current) return;

    const epoch = epochRef.current;
    loadingPastRef.current = true;
    setLoadingPast(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        direction: "past",
        before: pastBeforeRef.current,
        ...extraParams(),
      };
      if (pastCursorRef.current) params.cursor = pastCursorRef.current;

      const data = await fetchEvents(params);
      if (epoch !== epochRef.current) return;

      if (data.events.length === 0) {
        setHasMorePast(false);
        hasMorePastRef.current = false;
        return;
      }

      setItems((prev) => mergeUnique(prev, data.events, "prepend"));
      setPrependTick((t) => t + 1);
      setHasMorePast(data.hasMore);
      hasMorePastRef.current = data.hasMore;
      pastCursorRef.current = data.nextCursor;
    } catch (err) {
      if (epoch !== epochRef.current) return;
      console.error(err);
      setError(err instanceof Error ? err.message : "과거 일정 로딩 실패");
    } finally {
      if (epoch === epochRef.current) {
        loadingPastRef.current = false;
        setLoadingPast(false);
      }
    }
  }, [extraParams]);

  const loadFuture = useCallback(async () => {
    if (!DATABASE_ID || loadingFutureRef.current || !hasMoreFutureRef.current) return;
    if (!futureCursorRef.current) {
      setHasMoreFuture(false);
      hasMoreFutureRef.current = false;
      return;
    }

    const epoch = epochRef.current;
    loadingFutureRef.current = true;
    setLoadingFuture(true);
    setError(null);

    try {
      const data = await fetchEvents({
        direction: "future",
        after: anchorRef.current,
        cursor: futureCursorRef.current,
        ...extraParams(),
      });
      if (epoch !== epochRef.current) return;

      setItems((prev) => mergeUnique(prev, data.events, "append"));
      setHasMoreFuture(data.hasMore);
      hasMoreFutureRef.current = data.hasMore;
      futureCursorRef.current = data.nextCursor;
    } catch (err) {
      if (epoch !== epochRef.current) return;
      console.error(err);
      setError(err instanceof Error ? err.message : "이후 일정 로딩 실패");
    } finally {
      if (epoch === epochRef.current) {
        loadingFutureRef.current = false;
        setLoadingFuture(false);
      }
    }
  }, [extraParams]);

  const handleGoToday = useCallback(() => {
    if (scrollToMarker("today-line")) return;
    reloadFrom(todayISO(), "today");
  }, [reloadFrom]);

  const handleToggleAm = useCallback(() => {
    const next = !amOnly;
    setAmOnly(next);
    titleRef.current = next ? AM_TITLE : null;
    const focusTarget = anchorRef.current === todayISO() ? "today" : "start";
    reloadFrom(anchorRef.current, focusTarget);
  }, [amOnly, reloadFrom]);

  const handleGoMonth = useCallback(
    (month: string) => {
      if (!/^\d{4}-\d{2}$/.test(month)) return;
      reloadFrom(`${month}-01`, "start");
    },
    [reloadFrom]
  );

  return (
    <EventList
      items={items}
      loading={loading}
      loadingPast={loadingPast}
      loadingFuture={loadingFuture}
      hasMorePast={hasMorePast}
      hasMoreFuture={hasMoreFuture}
      error={error}
      todayKey={todayISO()}
      anchorDate={anchorDate}
      prependTick={prependTick}
      amOnly={amOnly}
      focus={focus}
      onLoadPast={loadPast}
      onLoadFuture={loadFuture}
      onGoToday={handleGoToday}
      onToggleAm={handleToggleAm}
      onGoMonth={handleGoMonth}
      onFocusHandled={() => setFocus(null)}
    />
  );
}
