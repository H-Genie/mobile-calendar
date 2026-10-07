const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** YYYY-MM-DD → 로컬 Date (타임존 밀림 방지) */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD (로컬 기준) */
export function todayISO(): string {
  return toISODate(new Date());
}

/** 날짜 키만 추출 (그룹핑용) */
export function dateKey(value: string | null): string {
  if (!value) return "no-date";
  return value.slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function formatDayLabel(key: string, todayKey: string): string {
  if (key === "no-date") return "날짜 없음";
  const date = parseLocalDate(key);
  const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_KO[date.getDay()]})`;
  if (key === todayKey) return `오늘 · ${label}`;
  if (key === addDays(todayKey, 1)) return `내일 · ${label}`;
  if (key === addDays(todayKey, -1)) return `어제 · ${label}`;
  return label;
}

export function formatEventTime(value: string | null): string | null {
  if (!value || !value.includes("T")) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0
  ) {
    return null;
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function datedKeys(list: { date: string | null }[]): string[] {
  return Array.from(new Set(list.map((item) => dateKey(item.date))))
    .filter((key) => key !== "no-date")
    .sort();
}
