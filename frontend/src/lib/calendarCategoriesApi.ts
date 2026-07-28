// Same explicit style as discoveryBlocks.ts on purpose - no destructuring,
// no object shorthand, while learning.
import { apiClient } from "@/lib/apiClient";

// shape of a CalendarCategory exactly as the frontend uses it - mirrors the
// backend's Prisma model (name, color; both required, unlike DiscoveryBlock)
export interface CalendarCategory {
  id: string;
  projectId: string;
  name: string;
  color: number;
}

// GET all - used for the Label dropdown and every event pill's color
export async function listCalendarCategories(
  projectId: string
): Promise<CalendarCategory[]> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/calendar-categories"
  );
  if (!Array.isArray(payload)) {
    throw new Error("Calendar categories response is invalid");
  }

  const parsed = payload.map(parseCalendarCategory);
  if (parsed.some((category) => category === null)) {
    throw new Error("Calendar category response contains invalid items");
  }

  return parsed as CalendarCategory[];
}

// POST - creates a new label
export async function createCalendarCategory(
  projectId: string,
  name: string,
  color: number
): Promise<CalendarCategory> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/calendar-categories",
    {
      method: "POST",
      body: { name: name, color: color },
    }
  );

  const parsed = parseCalendarCategory(payload);
  if (parsed === null) {
    throw new Error("Calendar category creation response was invalid");
  }
  return parsed;
}

// PATCH - name and/or color, both optional (mirrors UpdateCalendarCategoryDto)
export async function updateCalendarCategory(
  projectId: string,
  categoryId: string,
  updates: { name?: string; color?: number }
): Promise<CalendarCategory> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/calendar-categories/" + categoryId,
    {
      method: "PATCH",
      body: updates,
    }
  );

  const parsed = parseCalendarCategory(payload);
  if (parsed === null) {
    throw new Error("Calendar category modification response was invalid");
  }
  return parsed;
}

// DELETE - the backend returns the deleted category's own body (200, not 204)
export async function deleteCalendarCategory(
  projectId: string,
  categoryId: string
): Promise<CalendarCategory> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/calendar-categories/" + categoryId,
    { method: "DELETE" }
  );

  const parsed = parseCalendarCategory(payload);
  if (parsed === null) {
    throw new Error("Calendar category deletion response was invalid");
  }
  return parsed;
}

function parseCalendarCategory(value: unknown): CalendarCategory | null {
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

  return {
    id: id,
    projectId: projectId,
    name: name,
    color: color,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
