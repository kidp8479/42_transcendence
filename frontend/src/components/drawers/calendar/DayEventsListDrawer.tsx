// Compact-mode fallback for a day's events (see useIsCompactCalendar): below
// the "sm" breakpoint there's no room for a legible pill, so tapping a day
// with events opens this list instead. Picking an event opens
// CalendarEventDrawer in edit mode; "+ Add event" opens it in create mode.
import { useId } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { HiOutlineXMark } from "react-icons/hi2";
import { DrawerShell } from "@/components/drawers/DrawerShell";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import type { CalendarEvent } from "@/lib/calendarEventsApi";

interface DayEventsListDrawerProps {
  isOpen: boolean;
  day: Dayjs;
  events: CalendarEvent[];
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateEvent: (day: Dayjs) => void;
}

export function DayEventsListDrawer({
  isOpen,
  day,
  events,
  onClose,
  onSelectEvent,
  onCreateEvent,
}: DayEventsListDrawerProps) {
  const titleId = useId();

  return (
    <DrawerShell isOpen={isOpen} onClose={onClose} titleId={titleId}>
      <div className="flex items-center justify-between border-b border-surface-border p-5">
        <span
          id={titleId}
          className="font-mono text-sm font-semibold text-text-primary"
        >
          {day.format("MMMM D, YYYY")}
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <HiOutlineXMark className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-col gap-2 p-5">
        {events.map((event) => {
          const eventColor =
            CATEGORY_COLOR_PALETTE[event.category?.color ?? 0] ??
            CATEGORY_COLOR_PALETTE[0];
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelectEvent(event)}
              className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-overlay p-3 text-left hover:bg-surface-overlay/60"
            >
              <span
                className={"h-2 w-2 shrink-0 rounded-full " + eventColor.bg}
                aria-hidden="true"
              ></span>
              <span className="shrink-0 text-xs font-medium text-text-secondary">
                {dayjs(event.startAt).format("HH:mm")}
              </span>
              <span className="min-w-0 truncate text-sm text-text-primary">
                {event.title}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onCreateEvent(day)}
          className="mt-2 rounded-lg border border-dashed border-control-border p-3 text-center text-sm text-text-secondary hover:bg-surface-overlay"
        >
          + Add event
        </button>
      </div>
    </DrawerShell>
  );
}
