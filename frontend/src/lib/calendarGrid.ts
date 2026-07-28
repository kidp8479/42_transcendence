// Pure date-math helpers for the Calendar tab's month grid - no React here on
// purpose, so CalendarMonthGrid/CalendarDayCell stay focused on rendering.
import dayjs, { type Dayjs } from "dayjs";
import type { CalendarEvent } from "@/lib/calendarEventsApi";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// One row per week, weeks starting Monday, always full 7-day rows - fills in
// the lead-in/lead-out days from adjacent months so every row has 7 cells.
export function buildMonthGrid(monthAnchor: Dayjs): Dayjs[][] {
  const startOfMonth = monthAnchor.startOf("month");
  const endOfMonth = monthAnchor.endOf("month");

  // dayjs().day() is 0 (Sunday) to 6 (Saturday) - shift so Monday is 0
  const startWeekday = (startOfMonth.day() + 6) % 7;
  const endWeekday = (endOfMonth.day() + 6) % 7;

  const firstGridDay = startOfMonth.subtract(startWeekday, "day");
  const lastGridDay = endOfMonth.add(6 - endWeekday, "day");

  const days: Dayjs[] = [];
  let cursor = firstGridDay;
  while (
    cursor.isBefore(lastGridDay, "day") ||
    cursor.isSame(lastGridDay, "day")
  ) {
    days.push(cursor);
    cursor = cursor.add(1, "day");
  }

  const weeks: Dayjs[][] = [];
  for (let index = 0; index < days.length; index = index + 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

// True if `day` falls within the event's [startAt, endAt] range (compared
// by calendar day, not exact time) - a multi-day event renders on every day
// it spans, not just its start day.
export function eventCoversDay(event: CalendarEvent, day: Dayjs): boolean {
  const start = dayjs(event.startAt).startOf("day");
  const end = dayjs(event.endAt).startOf("day");
  const target = day.startOf("day");
  return (
    (target.isAfter(start, "day") || target.isSame(start, "day")) &&
    (target.isBefore(end, "day") || target.isSame(end, "day"))
  );
}
