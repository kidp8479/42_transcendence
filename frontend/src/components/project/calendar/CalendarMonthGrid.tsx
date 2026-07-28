import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { CalendarDayCell } from "@/components/project/calendar/CalendarDayCell";
import { useIsCompactCalendar } from "@/hooks/useIsCompactCalendar";
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  eventCoversDay,
} from "@/lib/calendarGrid";
import type { CalendarEvent } from "@/lib/calendarEventsApi";

interface CalendarMonthGridProps {
  monthAnchor: Dayjs;
  events: CalendarEvent[];
  onCreateEvent: (day: Dayjs) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  // compact mode: tapping a day with events opens a list instead of create
  onOpenDayList: (day: Dayjs, events: CalendarEvent[]) => void;
}

// lays out the weeks/days for the current month, including the dimmed
// lead-in/lead-out days from adjacent months, one row per week, Monday
// through Sunday.
export function CalendarMonthGrid({
  monthAnchor,
  events,
  onCreateEvent,
  onSelectEvent,
  onOpenDayList,
}: CalendarMonthGridProps) {
  const weeks = buildMonthGrid(monthAnchor);
  const today = dayjs();
  const isCompact = useIsCompactCalendar();

  return (
    <div className="overflow-hidden rounded-lg border-t border-l border-surface-border">
      <div className="grid grid-cols-7 border-b border-surface-border bg-surface-overlay">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-r border-surface-border p-2 text-center text-xs font-semibold text-text-secondary last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0].format("YYYY-MM-DD")} className="grid grid-cols-7">
          {week.map((day) => {
            const dayEvents = events
              .filter((event) => eventCoversDay(event, day))
              .sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

            const handleDayClick = (clickedDay: Dayjs) => {
              if (isCompact && dayEvents.length > 0) {
                onOpenDayList(clickedDay, dayEvents);
                return;
              }
              onCreateEvent(clickedDay);
            };

            return (
              <CalendarDayCell
                key={day.format("YYYY-MM-DD")}
                day={day}
                isCurrentMonth={day.isSame(monthAnchor, "month")}
                isToday={day.isSame(today, "day")}
                events={dayEvents}
                isCompact={isCompact}
                onDayClick={handleDayClick}
                onSelectEvent={onSelectEvent}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
