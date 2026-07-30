// Detail drawer for a calendar event - opens when clicking an event, or an
// empty day to create one. Renders inside DrawerShell for the slide-in/
// backdrop behavior; this component just handles the event-specific header
// and form.
//
// No linked-task field: Task (Kanban/List) and CalendarEvent are separate,
// unconnected tables in this app - an event never links back to a task.
import { useId, useState } from "react";
import type { Dayjs } from "dayjs";
import {
  HiOutlineArrowsPointingIn,
  HiOutlineArrowsPointingOut,
  HiOutlineXMark,
} from "react-icons/hi2";
import { DrawerShell } from "@/components/drawers/DrawerShell";
import { EventForm } from "@/components/project/calendar/EventForm";
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import type { CalendarCategory } from "@/lib/calendarCategoriesApi";
import type {
  CalendarEvent,
  CalendarEventInput,
} from "@/lib/calendarEventsApi";
import type { ProjectMember } from "@/lib/projectMembersApi";

interface CalendarEventDrawerProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialDate?: Dayjs;
  event?: CalendarEvent;
  categories: CalendarCategory[];
  members: ProjectMember[];
  onClose: () => void;
  onSave: (input: CalendarEventInput) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
}

export function CalendarEventDrawer({
  isOpen,
  mode,
  initialDate,
  event,
  categories,
  members,
  onClose,
  onSave,
  onDelete,
}: CalendarEventDrawerProps) {
  // expand/collapse: widens the panel to fill the content area instead of
  // navigating to a separate route
  const [isExpanded, setIsExpanded] = useState(false);
  const titleId = useId();

  // staged Escape: collapse the expanded panel first, only close on a
  // second press. DrawerShell's own Escape listener takes priority over the
  // sidebar's (stopPropagation), so this doesn't need to account for the
  // sidebar's state at all.
  function handleEscape() {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    onClose();
  }

  const headerAnchor = event?.startAt
    ? new Date(event.startAt)
    : (initialDate?.toDate() ?? new Date());
  const category = categories.find((entry) => entry.id === event?.categoryId);
  const categoryColor =
    CATEGORY_COLOR_PALETTE[category?.color ?? 0] ?? CATEGORY_COLOR_PALETTE[0];

  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={onClose}
      onEscape={handleEscape}
      widthClassName={isExpanded ? "w-full" : "max-w-md"}
      titleId={titleId}
    >
      <div className="flex items-center justify-between border-b border-surface-border p-5">
        <div id={titleId} className="flex items-center gap-2">
          <span
            className={
              "rounded-full border px-2.5 py-0.5 text-xs font-medium " +
              categoryColor.badgeBg +
              " " +
              categoryColor.badgeBorder +
              " " +
              categoryColor.text
            }
          >
            {category?.name ?? (mode === "create" ? "New event" : "No label")}
          </span>
          <span className="text-xs text-text-secondary">
            {headerAnchor.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            onClick={() => setIsExpanded((current) => !current)}
            className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            {isExpanded ? (
              <HiOutlineArrowsPointingIn className="h-5 w-5" />
            ) : (
              <HiOutlineArrowsPointingOut className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>
      </div>
      {isOpen && (
        <EventForm
          key={event?.id ?? "create"}
          mode={mode}
          initialDate={initialDate}
          event={event}
          categories={categories}
          members={members}
          onSave={onSave}
          onDelete={onDelete}
          onDiscard={onClose}
        />
      )}
    </DrawerShell>
  );
}
