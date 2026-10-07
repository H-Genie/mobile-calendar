"use client";

import type { EventItem } from "@/lib/events";
import { EventRow } from "@/app/components/EventRow";

type DaySectionProps = {
  dayKey: string;
  label: string;
  isToday: boolean;
  items: EventItem[];
};

export function DaySection({
  dayKey,
  label,
  isToday,
  items,
}: DaySectionProps) {
  return (
    <section
      id={dayKey === "no-date" ? undefined : `day-${dayKey}`}
      className="day-section"
    >
      <h2 className={isToday ? "day-label is-today" : "day-label"}>{label}</h2>
      <ul className="event-list">
        {items.map((item) => (
          <EventRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
