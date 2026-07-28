import dayjs from "dayjs";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import type { CalendarEvent } from "@/lib/calendarEventsApi";

interface EventPillProps {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
}

// one event pill inside a day cell: colored dot, start time, title.
// stopPropagation so clicking it doesn't also trigger the day cell's own
// "create a new event" handler.
export function EventPill({ event, onSelect }: EventPillProps) {
  const eventColor =
    CATEGORY_COLOR_PALETTE[event.category?.color ?? 0] ??
    CATEGORY_COLOR_PALETTE[0];

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect(event);
      }}
      title={event.title}
      className={
        "flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left text-xs " +
        eventColor.badgeBg +
        " " +
        eventColor.badgeBorder
      }
    >
      <span
        className={"h-1.5 w-1.5 shrink-0 rounded-full " + eventColor.bg}
        aria-hidden="true"
      ></span>
      {/* hidden below sm: not enough room for dot + time + title on mobile,
      and a truncated title is more useful than a half-cut-off time */}
      <span className="hidden shrink-0 font-medium text-text-secondary sm:inline">
        {dayjs(event.startAt).format("HH:mm")}
      </span>
      <span className="min-w-0 truncate text-text-primary">{event.title}</span>
    </button>
  );
}
