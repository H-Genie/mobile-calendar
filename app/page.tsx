"use client";

import { EventList } from "@/app/components/EventList";
import { useCalendarEvents } from "@/app/hooks/useCalendarEvents";

export default function HomePage() {
  const calendar = useCalendarEvents();
  return <EventList {...calendar} />;
}
