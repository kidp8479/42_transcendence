// Tasks API helpers for the Kanban/List tabs.
//
// TODO: not wired yet - the Kanban tab runs on in-memory mock state (see
// routes/_authenticated/$projectId/kanban.tsx). The backend controller exists
// but TasksService is still TODO. Switch the route to these fetchers once
// GET/POST/PATCH/DELETE /api/projects/:projectId/tasks are implemented.
//
// Why this file exists:
// - keeps network + parsing logic out of route files/components
// - gives a single typed contract mirroring the backend DTOs
//   (backend/src/tasks/dto/create-task.dto.ts, update-task.dto.ts)
// - centralizes unauthorized handling semantics
//
// Known contract gaps to resolve backend-side before wiring:
// 1. UpdateTaskDto has no assigneeIds field, and the global ValidationPipe
//    runs with whitelist + forbidNonWhitelisted - a PATCH sending assigneeIds
//    is rejected with 400. Until the DTO gains the field, editing a task's
//    members cannot persist.
// 2. CreateTaskDto documents rank as the position "in its category column",
//    but the Kanban board groups by STATUS. The frontend treats rank as the
//    0-based position within the task's status column - to confirm backend-side.

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

// User info the board needs for an assignee. The GET response shape is TBD
// until TasksService exists - the board needs assignees flattened to this
// (TaskAssignee join rows alone carry no username to display).
export interface TaskAssigneeUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

// Mirrors the Task model in backend/prisma/schema.prisma, with assignees
// flattened to the users the board displays.
export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  categoryId: string | null;
  rank: number;
  priority: TaskPriority;
  startAt: string | null;
  endAt: string | null;
  description: string | null;
  notes: string | null;
  onCalendar: boolean;
  assignees: TaskAssigneeUser[];
}

// Mirrors CreateTaskDto (all required unless marked optional there).
export interface CreateTaskBody {
  title: string;
  categoryId: string;
  status: TaskStatus;
  priority: TaskPriority;
  rank: number;
  startAt?: string;
  endAt?: string;
  description?: string;
  notes?: string;
  onCalendar: boolean;
  assigneeIds?: string[];
}

// Mirrors UpdateTaskDto (every field optional). assigneeIds is intentionally
// absent - see contract gap 1 in the header comment.
export interface UpdateTaskBody {
  title?: string;
  categoryId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  rank?: number;
  startAt?: string;
  endAt?: string;
  description?: string;
  notes?: string;
  onCalendar?: boolean;
}

export class TasksUnauthorizedError extends Error {
  constructor() {
    super("Authentication is required to load tasks");
    this.name = "TasksUnauthorizedError";
  }
}

export async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/tasks`,
    { credentials: "include" }
  );

  if (response.status === 401) {
    throw new TasksUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(`Failed to load tasks for project ${projectId}`);
  }

  // Parse as unknown first, then validate each item to keep runtime safety.
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Tasks response is invalid");
  }

  const parsed = payload.map(parseTask);
  if (parsed.some((task) => task === null)) {
    throw new Error("Tasks response contains invalid task items");
  }

  return parsed as Task[];
}

// Mutations require the CSRF token from the current auth session
// (getSession() in lib/auth.ts returns it) - the auth service rejects any
// POST/PATCH/DELETE without a valid X-CSRF-Token header.
export async function createTask(
  projectId: string,
  body: CreateTaskBody,
  csrfToken: string
): Promise<Task> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/tasks`,
    {
      method: "POST",
      credentials: "include",
      headers: mutationHeaders(csrfToken),
      body: JSON.stringify(body),
    }
  );

  return parseTaskResponse(response);
}

export async function updateTask(
  projectId: string,
  taskId: string,
  changes: UpdateTaskBody,
  csrfToken: string
): Promise<Task> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/tasks/${taskId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: mutationHeaders(csrfToken),
      body: JSON.stringify(changes),
    }
  );

  return parseTaskResponse(response);
}

export async function deleteTask(
  projectId: string,
  taskId: string,
  csrfToken: string
): Promise<void> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/tasks/${taskId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: mutationHeaders(csrfToken),
    }
  );

  if (response.status === 401) {
    throw new TasksUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(`Failed to delete task ${taskId}`);
  }
}

function mutationHeaders(csrfToken: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
  };
}

async function parseTaskResponse(response: Response): Promise<Task> {
  if (response.status === 401) {
    throw new TasksUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(`Task request failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  const parsed = parseTask(payload);
  if (parsed === null) {
    throw new Error("Task response is invalid");
  }
  return parsed;
}

function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    id,
    projectId,
    title,
    status,
    categoryId,
    rank,
    priority,
    startAt,
    endAt,
    description,
    notes,
    onCalendar,
    assignees,
  } = value;

  if (
    typeof id !== "string" ||
    typeof projectId !== "string" ||
    typeof title !== "string" ||
    typeof rank !== "number" ||
    typeof onCalendar !== "boolean"
  ) {
    return null;
  }
  if (!isTaskStatus(status) || !isTaskPriority(priority)) {
    return null;
  }
  if (
    !isNullableString(categoryId) ||
    !isNullableString(startAt) ||
    !isNullableString(endAt) ||
    !isNullableString(description) ||
    !isNullableString(notes)
  ) {
    return null;
  }

  // assignees is tolerated missing (treated as []) since the GET include shape
  // is TBD until TasksService exists - see the header comment.
  const parsed_assignees =
    assignees === undefined ? [] : parseAssignees(assignees);
  if (parsed_assignees === null) {
    return null;
  }

  return {
    id,
    projectId,
    title,
    status,
    categoryId: categoryId ?? null,
    rank,
    priority,
    startAt: startAt ?? null,
    endAt: endAt ?? null,
    description: description ?? null,
    notes: notes ?? null,
    onCalendar,
    assignees: parsed_assignees,
  };
}

function parseAssignees(value: unknown): TaskAssigneeUser[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: TaskAssigneeUser[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    // Accept either a flattened user or a TaskAssignee join row with an
    // included user relation ({ user: { id, username, avatarUrl } }).
    const user = isRecord(item.user) ? item.user : item;
    if (
      typeof user.id !== "string" ||
      typeof user.username !== "string" ||
      !isNullableString(user.avatarUrl)
    ) {
      return null;
    }
    parsed.push({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl ?? null,
    });
  }
  return parsed;
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === "TODO" ||
    value === "IN_PROGRESS" ||
    value === "REVIEW" ||
    value === "COMPLETED"
  );
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
