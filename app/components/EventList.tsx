"use client"

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties
} from "react"
import dayjs from "dayjs"
import "dayjs/locale/ko"
import type { EventItem } from "@/lib/events"
import { dateKey } from "@/lib/events"

dayjs.locale("ko")

type EventListProps = {
  items: EventItem[]
  loading: boolean
  loadingPast: boolean
  loadingFuture: boolean
  hasMorePast: boolean
  hasMoreFuture: boolean
  error: string | null
  todayKey: string
  anchorDate: string
  prependTick: number
  amOnly: boolean
  focus: "today" | "start" | null
  onLoadPast: () => void
  onLoadFuture: () => void
  onGoToday: () => void
  onToggleAm: () => void
  onGoMonth: (month: string) => void
  onFocusHandled: () => void
}

type DayGroup = {
  key: string
  label: string
  isToday: boolean
  items: EventItem[]
}

function formatDayLabel(key: string, todayKey: string): string {
  if (key === "no-date") return "날짜 없음"
  const d = dayjs(key)
  const label = d.format("YYYY년 M월 D일 (ddd)")
  if (key === todayKey) return `오늘 · ${label}`
  if (key === dayjs(todayKey).add(1, "day").format("YYYY-MM-DD")) {
    return `내일 · ${label}`
  }
  if (key === dayjs(todayKey).subtract(1, "day").format("YYYY-MM-DD")) {
    return `어제 · ${label}`
  }
  return label
}

function formatTime(value: string | null): string | null {
  if (!value || !value.includes("T")) return null
  const d = dayjs(value)
  if (d.hour() === 0 && d.minute() === 0 && d.second() === 0) return null
  return d.format("HH:mm")
}

function groupByDay(items: EventItem[], todayKey: string): DayGroup[] {
  const map = new Map<string, EventItem[]>()
  for (const item of items) {
    const key = dateKey(item.date)
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }

  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    label: formatDayLabel(key, todayKey),
    isToday: key === todayKey,
    items: groupItems
  }))
}

function todayLineIndex(
  groups: DayGroup[],
  todayKey: string,
  anchorDate: string,
  hasMoreFuture: boolean
): number | "end" | null {
  const idx = groups.findIndex(
    group => group.key !== "no-date" && group.key >= todayKey
  )
  if (idx > 0) return idx
  if (idx === 0 && anchorDate <= todayKey) return 0
  if (
    idx < 0 &&
    !hasMoreFuture &&
    anchorDate <= todayKey &&
    groups.length > 0
  ) {
    return "end"
  }
  return null
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
  anchorDate,
  prependTick,
  amOnly,
  focus,
  onLoadPast,
  onLoadFuture,
  onGoToday,
  onToggleAm,
  onGoMonth,
  onFocusHandled
}: EventListProps) {
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const scrollSnapshotRef = useRef<{ height: number; top: number } | null>(null)
  const todayAnchorRef = useRef<HTMLDivElement>(null)
  const didScrollToToday = useRef(false)

  const groups = useMemo(() => groupByDay(items, todayKey), [items, todayKey])
  const lineIndex = todayLineIndex(groups, todayKey, anchorDate, hasMoreFuture)
  const showEmptyTodayLine = items.length === 0 && anchorDate === todayKey

  // 위로 붙이기 직전 스크롤 스냅샷은 page가 prependTick을 올리기 전에
  // layout에서 이전 height를 잡아야 하므로, tick 변경 직전 height를 보존
  useLayoutEffect(() => {
    if (prependTick === 0) return
    const snap = scrollSnapshotRef.current
    if (!snap) return
    const diff = document.documentElement.scrollHeight - snap.height
    window.scrollTo(0, snap.top + diff)
    scrollSnapshotRef.current = null
  }, [prependTick, items])

  // 과거 로드 직전에 스크롤 위치 저장
  const handleLoadPast = () => {
    scrollSnapshotRef.current = {
      height: document.documentElement.scrollHeight,
      top: window.scrollY
    }
    onLoadPast()
  }

  // 초기 로드 후 오늘 섹션으로 스크롤 (과거가 아직 없으면 상단이 오늘)
  useEffect(() => {
    if (loading || didScrollToToday.current) return
    didScrollToToday.current = true
    // 오늘 이후만 보이므로 상단이 오늘 근처 — 추가 스크롤 불필요
  }, [loading])

  // IntersectionObserver: 위/아래 센티널
  const onLoadPastRef = useRef(handleLoadPast)
  const onLoadFutureRef = useRef(onLoadFuture)
  onLoadPastRef.current = handleLoadPast
  onLoadFutureRef.current = onLoadFuture

  useEffect(() => {
    if (loading || !focus) return
    const id = focus === "today" ? "today-line" : "list-start"
    const el = document.getElementById(id)
    if (!el) return
    const header = document.querySelector(".app-header")
    const headerH = header?.getBoundingClientRect().height ?? 0
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - 8
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    onFocusHandled()
  }, [loading, focus, items, onFocusHandled])

  useEffect(() => {
    if (loading) return

    const topEl = topSentinelRef.current
    const bottomEl = bottomSentinelRef.current
    if (!topEl || !bottomEl) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.target === topEl) onLoadPastRef.current()
          if (entry.target === bottomEl) onLoadFutureRef.current()
        }
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 }
    )

    observer.observe(topEl)
    observer.observe(bottomEl)
    return () => observer.disconnect()
  }, [loading, items.length])

  const monthValue = anchorDate.slice(0, 7)

  return (
    <main style={styles.main}>
      <header className="app-header">
        <h1 className="app-header-title">Genie Schedule</h1>
        <div className="app-header-actions">
          <button type="button" className="header-btn" onClick={onGoToday}>
            오늘
          </button>
          <button
            type="button"
            className={amOnly ? "header-btn is-active" : "header-btn"}
            aria-pressed={amOnly}
            onClick={onToggleAm}
          >
            am
          </button>
          <input
            className="month-input"
            type="month"
            aria-label="월 이동"
            value={monthValue}
            onChange={event => {
              if (event.target.value) onGoMonth(event.target.value)
            }}
          />
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.empty}>불러오는 중…</div>
      ) : (
        <>
          <div ref={topSentinelRef} style={styles.sentinel}>
            {loadingPast ? (
              <span style={styles.hint}>이전 일정 불러오는 중…</span>
            ) : hasMorePast ? (
              <span style={styles.hint}>위로 스크롤 · 이전 일정</span>
            ) : (
              <span style={styles.hintMuted}>이전 일정 없음</span>
            )}
          </div>

          {items.length === 0 ? (
            <div id="list-start">
              {showEmptyTodayLine && (
                <div id="today-line" className="today-line" />
              )}
              <div style={styles.empty}>
                {amOnly ? "am 일정이 없습니다." : "표시할 일정이 없습니다."}
              </div>
            </div>
          ) : (
            <div id="list-start" style={styles.timeline}>
              {groups.map((group, index) => (
                <div key={group.key}>
                  {lineIndex === index && (
                    <div id="today-line" className="today-line" />
                  )}
                  <section
                    ref={group.isToday ? todayAnchorRef : undefined}
                    style={styles.daySection}
                  >
                    <h2
                      style={{
                        ...styles.dayLabel,
                        ...(group.isToday ? styles.dayLabelToday : null)
                      }}
                    >
                      {group.label}
                    </h2>
                    <ul style={styles.list}>
                      {group.items.map(item => {
                        const time = formatTime(item.date)
                        const content = (
                          <>
                            <div style={styles.timeCol}>
                              {time ?? <span style={styles.allDay}>종일</span>}
                            </div>
                            <div style={styles.bodyCol}>
                              <div style={styles.itemTitle}>{item.title}</div>
                              {item.location && (
                                <div style={styles.meta}>{item.location}</div>
                              )}
                            </div>
                            {item.url && (
                              <span style={styles.chevron} aria-hidden>
                                ›
                              </span>
                            )}
                          </>
                        )

                        return (
                          <li key={item.id} style={styles.item}>
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.itemLink}
                                aria-label={`${item.title} 자세히 보기`}
                              >
                                {content}
                              </a>
                            ) : (
                              <div style={styles.itemRow}>{content}</div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                </div>
              ))}
              {lineIndex === "end" && (
                <div id="today-line" className="today-line" />
              )}
            </div>
          )}

          <div ref={bottomSentinelRef} style={styles.sentinel}>
            {loadingFuture ? (
              <span style={styles.hint}>이후 일정 불러오는 중…</span>
            ) : hasMoreFuture ? (
              <span style={styles.hint}>아래로 스크롤 · 이후 일정</span>
            ) : (
              <span style={styles.hintMuted}>이후 일정 없음</span>
            )}
          </div>
        </>
      )}
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  main: {
    padding: "1.25rem 1rem 2.5rem"
  },
  header: {
    marginBottom: "1rem"
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.02em"
  },
  subtitle: {
    margin: "0.35rem 0 0",
    fontSize: "0.8125rem",
    color: "#8e8e93"
  },
  error: {
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
    background: "#fff0f0",
    color: "#c62828",
    borderRadius: 10,
    fontSize: "0.875rem"
  },
  empty: {
    padding: "2.5rem 1rem",
    textAlign: "center",
    color: "#8e8e93",
    fontSize: "0.9375rem",
    lineHeight: 1.6
  },
  sentinel: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 36,
    padding: "0.5rem 0"
  },
  hint: {
    fontSize: "0.75rem",
    color: "#8e8e93"
  },
  hintMuted: {
    fontSize: "0.75rem",
    color: "#c7c7cc"
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem"
  },
  daySection: {
    margin: 0
  },
  dayLabel: {
    position: "sticky",
    top: "var(--app-header-height)",
    zIndex: 2,
    margin: "0 0 0.5rem",
    padding: "0.45rem 0",
    fontSize: "0.8125rem",
    fontWeight: 700,
    color: "#3a3a3c",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(8px)"
    // borderBottom: "1px solid #efeff4"
  },
  dayLabelToday: {
    color: "#007aff"
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem"
  },
  item: {
    padding: 0,
    background: "#f9f9fb",
    borderRadius: 12,
    border: "1px solid #efeff4",
    overflow: "hidden"
  },
  itemLink: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 0.75rem 0.75rem 0.875rem",
    textDecoration: "none",
    color: "inherit"
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 0.75rem 0.75rem 0.875rem"
  },
  timeCol: {
    flex: "0 0 3.25rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#007aff",
    alignSelf: "flex-start",
    paddingTop: 2
  },
  allDay: {
    color: "#8e8e93",
    fontWeight: 500
  },
  bodyCol: {
    flex: 1,
    minWidth: 0
  },
  itemTitle: {
    fontSize: "0.975rem",
    fontWeight: 600,
    lineHeight: 1.35,
    wordBreak: "break-word"
  },
  meta: {
    marginTop: "0.3rem",
    fontSize: "0.8125rem",
    color: "#8e8e93"
  },
  chevron: {
    flex: "0 0 auto",
    fontSize: "1.25rem",
    lineHeight: 1,
    color: "#c7c7cc",
    fontWeight: 300,
    paddingLeft: "0.25rem"
  }
}
