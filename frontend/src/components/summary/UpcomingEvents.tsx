import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";

export interface UpcomingEvent {
  id: string;
  title: string;
  startAt: string;
  // index into CATEGORY_COLOR_PALETTE, matches CalendarCategory.color (Int)
  // in schema.prisma - a separate table from TaskCategory, same palette-index pattern
  color: number;
}

interface UpcomingEventsProps {
  events: UpcomingEvent[];
}

export function UpcomingEvents({ events }: UpcomingEventsProps) {
  return (
    <section
      aria-labelledby="upcoming-events-heading"
      className="rounded-lg border border-surface-border bg-surface-raised p-4"
    >
      <h2
        id="upcoming-events-heading"
        className="mb-4 text-sm font-semibold text-text-primary"
      >
        Upcoming Events
      </h2>
      {events.map((event) => (
        <div key={event.id} className="mb-3 flex items-center gap-3 last:mb-0">
          <span
            className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${CATEGORY_COLOR_PALETTE[event.color].badgeBg} ${CATEGORY_COLOR_PALETTE[event.color].badgeBorder} ${CATEGORY_COLOR_PALETTE[event.color].text}`}
          >
            {new Date(event.startAt).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
            })}
          </span>
          <span className="text-sm text-text-primary">{event.title}</span>
        </div>
      ))}
    </section>
  );
}
