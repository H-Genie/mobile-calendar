"use client";

import type { EventItem } from "@/lib/events";
import { formatEventTime } from "@/lib/date";

type EventRowProps = {
  item: EventItem;
};

export function EventRow({ item }: EventRowProps) {
  const time = formatEventTime(item.date);

  const content = (
    <>
      <div className="event-time">{time}</div>
      <div className="event-body">
        <div className="event-title">{item.title}</div>
        {item.location && <div className="event-meta">{item.location}</div>}
      </div>
      {item.url && (
        <span className="event-chevron" aria-hidden>
          ›
        </span>
      )}
    </>
  );

  return (
    <li className="event-item">
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="event-link"
          aria-label={`${item.title} 자세히 보기`}
        >
          {content}
        </a>
      ) : (
        <div className="event-row">{content}</div>
      )}
    </li>
  );
}
