// Calendar tab (/:projectId/calendar) - a simple month view, no link to the
// Kanban board: Task and CalendarEvent are separate, unconnected tables.
//
// Loads events/categories/members once in the route loader. Month
// navigation is then purely client-side (no date-range filter on the
// backend yet), just re-rendering already-loaded events for the new month.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { CalendarNavHeader } from "@/components/project/calendar/CalendarNavHeader";
import { CalendarMonthGrid } from "@/components/project/calendar/CalendarMonthGrid";
import { CalendarEventDrawer } from "@/components/drawers/calendar/CalendarEventDrawer";
import { DayEventsListDrawer } from "@/components/drawers/calendar/DayEventsListDrawer";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventInput,
} from "@/lib/calendarEventsApi";
import {
  listCalendarCategories,
  type CalendarCategory,
} from "@/lib/calendarCategoriesApi";
import {
  listProjectMembers,
  type ProjectMember,
} from "@/lib/projectMembersApi";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { useToast } from "@/hooks/useToast";

interface CalendarPageData {
  events: CalendarEvent[];
  categories: CalendarCategory[];
  members: ProjectMember[];
}

async function loadCalendarPageData(
  projectId: string
): Promise<CalendarPageData> {
  const events = await listCalendarEvents(projectId);
  const categories = await listCalendarCategories(projectId);
  const members = await listProjectMembers(projectId);
  return { events: events, categories: categories, members: members };
}

type DrawerState =
  | { mode: "closed" }
  | { mode: "create"; day: Dayjs }
  | { mode: "edit"; event: CalendarEvent }
  // compact viewports only: a day's events shown as a plain list
  | { mode: "day-list"; day: Dayjs; events: CalendarEvent[] };

export const Route = createFileRoute("/_authenticated/$projectId/calendar")({
  loader: (routeContext) => loadCalendarPageData(routeContext.params.projectId),
  component: CalendarPage,
});

function CalendarPage() {
  const loaderData = Route.useLoaderData();
  const params = Route.useParams();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();

  const [monthAnchor, setMonthAnchor] = useState(() => dayjs());
  const [drawerState, setDrawerState] = useState<DrawerState>({
    mode: "closed",
  });

  function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  function handleCreateEvent(day: Dayjs) {
    setDrawerState({ mode: "create", day: day });
  }

  function handleSelectEvent(event: CalendarEvent) {
    setDrawerState({ mode: "edit", event: event });
  }

  function handleOpenDayList(day: Dayjs, events: CalendarEvent[]) {
    setDrawerState({ mode: "day-list", day: day, events: events });
  }

  function closeDrawer() {
    setDrawerState({ mode: "closed" });
  }

  async function handleSaveEvent(input: CalendarEventInput): Promise<boolean> {
    try {
      if (drawerState.mode === "edit") {
        await updateCalendarEvent(
          params.projectId,
          drawerState.event.id,
          input
        );
      } else {
        await createCalendarEvent(params.projectId, input);
      }
    } catch (error) {
      showToast({
        type: "error",
        message: errorMessage(error, "Failed to save event"),
      });
      return false;
    }
    await safeInvalidateRouter();
    showToast({
      type: "success",
      message: drawerState.mode === "edit" ? "Event updated" : "Event created",
    });
    closeDrawer();
    return true;
  }

  async function handleDeleteEvent(): Promise<boolean> {
    if (drawerState.mode !== "edit") {
      return false;
    }
    try {
      await deleteCalendarEvent(params.projectId, drawerState.event.id);
    } catch (error) {
      showToast({
        type: "error",
        message: errorMessage(error, "Failed to delete event"),
      });
      return false;
    }
    await safeInvalidateRouter();
    showToast({ type: "success", message: "Event deleted" });
    closeDrawer();
    return true;
  }

  return (
    <div className="flex flex-col gap-2">
      <CalendarNavHeader
        monthAnchor={monthAnchor}
        onPrevMonth={() =>
          setMonthAnchor((current) => current.subtract(1, "month"))
        }
        onNextMonth={() => setMonthAnchor((current) => current.add(1, "month"))}
        onToday={() => setMonthAnchor(dayjs())}
      />
      <CalendarMonthGrid
        monthAnchor={monthAnchor}
        events={loaderData.events}
        onCreateEvent={handleCreateEvent}
        onSelectEvent={handleSelectEvent}
        onOpenDayList={handleOpenDayList}
      />
      <CalendarEventDrawer
        isOpen={drawerState.mode === "create" || drawerState.mode === "edit"}
        mode={drawerState.mode === "edit" ? "edit" : "create"}
        initialDate={
          drawerState.mode === "create" ? drawerState.day : undefined
        }
        event={drawerState.mode === "edit" ? drawerState.event : undefined}
        categories={loaderData.categories}
        members={loaderData.members}
        onClose={closeDrawer}
        onSave={handleSaveEvent}
        onDelete={drawerState.mode === "edit" ? handleDeleteEvent : undefined}
      />
      <DayEventsListDrawer
        isOpen={drawerState.mode === "day-list"}
        day={drawerState.mode === "day-list" ? drawerState.day : dayjs()}
        events={drawerState.mode === "day-list" ? drawerState.events : []}
        onClose={closeDrawer}
        onSelectEvent={handleSelectEvent}
        onCreateEvent={handleCreateEvent}
      />
    </div>
  );
}
