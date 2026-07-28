// Task categories API helpers for the Kanban/List tabs.
//
// TODO: not wired yet - the Kanban tab runs on in-memory mock state (see
// routes/_authenticated/$projectId/kanban.tsx). The backend controller exists
// but TaskCategoriesService is still TODO. Switch the route to this fetcher
// once GET /api/projects/:projectId/task-categories is implemented.

export interface TaskCategory {
  id: string;
  name: string;
  // index into CATEGORY_COLOR_PALETTE (0-7), matches TaskCategory.color (Int)
  // in schema.prisma
  color: number;
}

export class TaskCategoriesUnauthorizedError extends Error {
  constructor() {
    super("Authentication is required to load task categories");
    this.name = "TaskCategoriesUnauthorizedError";
  }
}

export async function fetchTaskCategories(
  projectId: string
): Promise<TaskCategory[]> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/task-categories`,
    { credentials: "include" }
  );

  if (response.status === 401) {
    throw new TaskCategoriesUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(`Failed to load task categories for project ${projectId}`);
  }

  // Parse as unknown first, then validate each item to keep runtime safety.
  const payload: unknown = await response.json();
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
