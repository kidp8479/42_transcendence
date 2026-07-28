// Same explicit style as discoveryBlocks.ts on purpose - no destructuring,
// no object shorthand, while learning.
import { apiClient } from "@/lib/apiClient";
import type { CalendarCategory } from "@/lib/calendarCategoriesApi";

// mirrors CreateCalendarEventDto's @MaxLength values on the backend
// (backend/src/calendar-events/dto/create-calendar-event.dto.ts) - kept in
// sync manually since frontend/backend are separate builds, no shared import
// possible.
export const CALENDAR_EVENT_TITLE_MAX_LENGTH = 100;
export const CALENDAR_EVENT_DESCRIPTION_MAX_LENGTH = 500;
export const CALENDAR_EVENT_NOTES_MAX_LENGTH = 2000;

export interface CalendarEventAssignee {
  id: string;
  username: string;
  avatarUrl: string | null;
}

// shape of a CalendarEvent exactly as the frontend uses it - mirrors what
// CalendarEventsService returns (event fields + its category + its
// assignees' user info), not something we invent independently
export interface CalendarEvent {
  id: string;
  projectId: string;
  title: string;
  startAt: string;
  endAt: string;
  categoryId: string | null;
  category: CalendarCategory | null;
  description: string | null;
  notes: string | null;
  assignees: CalendarEventAssignee[];
}

// GET all - one call for the whole visible month, filtered client-side by
// day (see calendar.tsx) rather than one request per month range, since the
// backend has no date-range filter yet (see CalendarEventsService.findAll)
export async function listCalendarEvents(
  projectId: string
): Promise<CalendarEvent[]> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/calendar-events"
  );
  if (!Array.isArray(payload)) {
    throw new Error("Calendar events response is invalid");
  }

  const parsed = payload.map(parseCalendarEvent);
  if (parsed.some((event) => event === null)) {
    throw new Error("Calendar event response contains invalid items");
  }

  return parsed as CalendarEvent[];
}

export interface CalendarEventInput {
  title: string;
  categoryId: string;
  startAt: string;
  endAt: string;
  description?: string;
  notes?: string;
  assigneeIds?: string[];
}

// POST - creates a new event (mirrors CreateCalendarEventDto)
export async function createCalendarEvent(
  projectId: string,
  input: CalendarEventInput
): Promise<CalendarEvent> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/calendar-events",
    {
      method: "POST",
      body: input,
    }
  );

  const parsed = parseCalendarEvent(payload);
  if (parsed === null) {
    throw new Error("Calendar event creation response was invalid");
  }
  return parsed;
}

// PATCH - all fields optional (mirrors UpdateCalendarEventDto)
export async function updateCalendarEvent(
  projectId: string,
  eventId: string,
  updates: Partial<CalendarEventInput>
): Promise<CalendarEvent> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/calendar-events/" + eventId,
    {
      method: "PATCH",
      body: updates,
    }
  );

  const parsed = parseCalendarEvent(payload);
  if (parsed === null) {
    throw new Error("Calendar event modification response was invalid");
  }
  return parsed;
}

// DELETE - the backend returns the deleted event's own body (200, not 204)
export async function deleteCalendarEvent(
  projectId: string,
  eventId: string
): Promise<CalendarEvent> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/calendar-events/" + eventId,
    { method: "DELETE" }
  );

  const parsed = parseCalendarEvent(payload);
  if (parsed === null) {
    throw new Error("Calendar event deletion response was invalid");
  }
  return parsed;
}

function parseCalendarEvent(value: unknown): CalendarEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const projectId = value.projectId;
  const title = value.title;
  const startAt = value.startAt;
  const endAt = value.endAt;
  const categoryId = value.categoryId;
  const category = value.category;
  const assignees = value.assignees;

  if (typeof id !== "string") {
    return null;
  }
  if (typeof projectId !== "string") {
    return null;
  }
  if (typeof title !== "string") {
    return null;
  }
  if (typeof startAt !== "string") {
    return null;
  }
  if (typeof endAt !== "string") {
    return null;
  }
  if (categoryId !== null && typeof categoryId !== "string") {
    return null;
  }
  if (!Array.isArray(assignees)) {
    return null;
  }

  const parsedAssignees = assignees.map(parseCalendarEventAssignee);
  if (parsedAssignees.some((assignee) => assignee === null)) {
    return null;
  }

  const description =
    typeof value.description === "string" ? value.description : null;
  const notes = typeof value.notes === "string" ? value.notes : null;
  const parsedCategory = parseNullableCategory(category);

  return {
    id: id,
    projectId: projectId,
    title: title,
    startAt: startAt,
    endAt: endAt,
    categoryId: categoryId,
    category: parsedCategory,
    description: description,
    notes: notes,
    assignees: parsedAssignees as CalendarEventAssignee[],
  };
}

function parseCalendarEventAssignee(
  value: unknown
): CalendarEventAssignee | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = value.id;
  const username = value.username;
  const avatarUrl = value.avatarUrl;

  if (typeof id !== "string") {
    return null;
  }
  if (typeof username !== "string") {
    return null;
  }
  if (avatarUrl !== null && typeof avatarUrl !== "string") {
    return null;
  }

  return { id: id, username: username, avatarUrl: avatarUrl };
}

function parseNullableCategory(value: unknown): CalendarCategory | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  const id = value.id;
  const projectId = value.projectId;
  const name = value.name;
  const color = value.color;

  if (typeof id !== "string") {
    return null;
  }
  if (typeof projectId !== "string") {
    return null;
  }
  if (typeof name !== "string") {
    return null;
  }
  if (typeof color !== "number") {
    return null;
  }

  return { id: id, projectId: projectId, name: name, color: color };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
