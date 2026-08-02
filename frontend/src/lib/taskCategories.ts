// Task categories API helpers for the Kanban/List tabs.
//
// Every project is seeded with the 8 defaults at creation time
// (backend/src/task-categories/default-task-categories.ts), so this list is
// never empty - which matters, because the drawer requires a category to
// create a task.
//
// Read-only for now: the backend only exposes GET, and the Kanban only
// ever lists categories. create/update/delete get added alongside the UI that
// needs them, rather than shipping three unused exports.
import { apiClient } from "@/lib/apiClient";

export interface TaskCategory {
  id: string;
  name: string;
  // index into CATEGORY_COLOR_PALETTE (0-7), matches TaskCategory.color (Int)
  // in schema.prisma
  color: number;
}

export async function listTaskCategories(
  projectId: string
): Promise<TaskCategory[]> {
  const payload = await apiClient<unknown>(
    `/projects/${projectId}/task-categories`
  );
  if (!Array.isArray(payload)) {
    throw new Error("Task categories response is invalid");
  }

  const parsed = payload.map(parseTaskCategory);
  if (parsed.some((category) => category === null)) {
    throw new Error("Task categories response contains invalid items");
  }
  return parsed as TaskCategory[];
}

function parseTaskCategory(value: unknown): TaskCategory | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, name, color } = value;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof color !== "number"
  ) {
    return null;
  }
  return { id, name, color };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
