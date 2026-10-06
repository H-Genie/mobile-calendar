"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventList } from "@/app/components/EventList";
import type { EventItem } from "@/lib/events";
import { todayISO } from "@/lib/events";

const DATABASE_ID = process.env.NEXT_PUBLIC_DATABASE_ID;
const PAGE_SIZE = 20;

type FetchResult = {
  events: EventItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

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

export default function HomePage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMorePast, setHasMorePast] = useState(true);
  const [hasMoreFuture, setHasMoreFuture] = useState(true);
  /** 위로 붙인 횟수 — EventList 스크롤 보정 트리거 */
  const [prependTick, setPrependTick] = useState(0);

  const futureCursorRef = useRef<string | null>(null);
  const pastCursorRef = useRef<string | null>(null);
  const pastBeforeRef = useRef<string>(todayISO());
  const loadingPastRef = useRef(false);
  const loadingFutureRef = useRef(false);

  useEffect(() => {
    async function loadInitial() {
      if (!DATABASE_ID) {
        setError("NEXT_PUBLIC_DATABASE_ID가 설정되지 않았습니다.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchEvents({ direction: "initial" });
        setItems(data.events);
        setHasMoreFuture(data.hasMore);
        futureCursorRef.current = data.nextCursor;

        pastBeforeRef.current = todayISO();
        pastCursorRef.current = null;
        setHasMorePast(true);
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
  }, []);

  const loadPast = useCallback(async () => {
    if (!DATABASE_ID || loadingPastRef.current || !hasMorePast) return;

    loadingPastRef.current = true;
    setLoadingPast(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        direction: "past",
        before: pastBeforeRef.current,
      };
      if (pastCursorRef.current) {
        params.cursor = pastCursorRef.current;
      }

      const data = await fetchEvents(params);

      if (data.events.length === 0) {
        setHasMorePast(false);
        return;
      }

      setItems((prev) => mergeUnique(prev, data.events, "prepend"));
      setPrependTick((t) => t + 1);
      setHasMorePast(data.hasMore);
      pastCursorRef.current = data.nextCursor;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "과거 일정 로딩 실패");
    } finally {
      loadingPastRef.current = false;
      setLoadingPast(false);
    }
  }, [hasMorePast]);

  const loadFuture = useCallback(async () => {
    if (!DATABASE_ID || loadingFutureRef.current || !hasMoreFuture) return;
    if (!futureCursorRef.current) {
      setHasMoreFuture(false);
      return;
    }

    loadingFutureRef.current = true;
    setLoadingFuture(true);
    setError(null);

    try {
      const data = await fetchEvents({
        direction: "future",
        cursor: futureCursorRef.current,
      });

      setItems((prev) => mergeUnique(prev, data.events, "append"));
      setHasMoreFuture(data.hasMore);
      futureCursorRef.current = data.nextCursor;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "이후 일정 로딩 실패");
    } finally {
      loadingFutureRef.current = false;
      setLoadingFuture(false);
    }
  }, [hasMoreFuture]);

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
      prependTick={prependTick}
      onLoadPast={loadPast}
      onLoadFuture={loadFuture}
    />
  );
}
