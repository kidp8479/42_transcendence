import type { Dayjs } from "dayjs";
import { EventPill } from "@/components/project/calendar/EventPill";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import type { CalendarEvent } from "@/lib/calendarEventsApi";

interface CalendarDayCellProps {
  day: Dayjs;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  // below the "sm" breakpoint (see useIsCompactCalendar), shows dots instead
  // of pills - tapping always goes through onDayClick, list-or-create is
  // decided by the parent (CalendarMonthGrid)
  isCompact: boolean;
  onDayClick: (day: Dayjs) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

// one day in the month grid: date number, its events, click-to-create or
// click-to-list. Adjacent-month days are just dimmed, still fully usable.
export function CalendarDayCell({
  day,
  isCurrentMonth,
  isToday,
  events,
  isCompact,
  onDayClick,
  onSelectEvent,
}: CalendarDayCellProps) {
  const ariaLabel =
    isCompact && events.length > 0
      ? "View " + events.length + " events on " + day.format("MMMM D, YYYY")
      : "Add event on " + day.format("MMMM D, YYYY");

  // div, not a real button: EventPill renders its own buttons inside this
  // cell, and buttons can't be nested. onKeyDown restores Enter/Space
  // activation for keyboard users.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onDayClick(day)}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
          keyboardEvent.preventDefault();
          onDayClick(day);
        }
      }}
      aria-label={ariaLabel}
      className={
        "flex min-h-24 cursor-pointer flex-col items-stretch gap-1 border-r border-b border-surface-border p-1.5 text-left last:border-r-0 hover:bg-surface-overlay/60 " +
        (isCurrentMonth ? "bg-surface-raised" : "bg-surface-base")
      }
    >
      <span
        className={
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
          (isToday
            ? "bg-brand-500 text-white"
            : isCurrentMonth
              ? "text-text-primary"
              : "text-text-muted")
        }
      >
        {day.format("D")}
      </span>
      {isCompact ? (
        <div className="flex flex-wrap gap-1 px-0.5">
          {events.map((event) => {
            const eventColor =
              CATEGORY_COLOR_PALETTE[event.category?.color ?? 0] ??
              CATEGORY_COLOR_PALETTE[0];
            return (
              <span
                key={event.id}
                className={"h-1.5 w-1.5 shrink-0 rounded-full " + eventColor.bg}
                aria-hidden="true"
              ></span>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1 overflow-hidden">
          {events.map((event) => (
            <EventPill key={event.id} event={event} onSelect={onSelectEvent} />
          ))}
        </div>
      )}
    </div>
  );
}
