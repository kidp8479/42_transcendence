// Task categories API helpers for the Kanban/List tabs.
//
// TODO: not wired yet - the Kanban tab runs on in-memory mock state (see
// routes/_authenticated/$projectId/kanban.tsx). The backend controller exists
// but has no route decorators and TaskCategoriesService is empty. Switch the
// route to this function once GET /api/projects/:projectId/task-categories is
// implemented.
//
// Read-only for now: the controller documents full CRUD, but the Kanban only
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
