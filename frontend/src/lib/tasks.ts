// Tasks API helpers for the Kanban/List tabs.
//
// TODO: not wired yet - the Kanban tab runs on in-memory mock state (see
// routes/_authenticated/$projectId/kanban.tsx). The backend controller exists
// but has no route decorators and TasksService is an empty class. Switch the
// route to these functions once GET/POST/PATCH/DELETE
// /api/projects/:projectId/tasks are implemented.
//
// Why this file exists:
// - keeps network + parsing logic out of route files/components
// - gives a single typed contract mirroring the backend DTOs
//   (backend/src/tasks/dto/create-task.dto.ts, update-task.dto.ts)
//
// apiClient handles the /api prefix, the session cookie, the X-CSRF-Token
// header on mutations, and turns any non-OK response into an ApiError that
// carries `status` - so there's no bespoke Unauthorized error class here:
// callers that care check `error instanceof ApiError && error.status === 401`.
//
// Known contract gaps to resolve backend-side before wiring:
// 1. UpdateTaskDto has no assigneeIds field, and the global ValidationPipe
//    runs with whitelist + forbidNonWhitelisted - a PATCH sending assigneeIds
//    is rejected with 400. Until the DTO gains the field, editing a task's
//    members cannot persist.
// 2. CreateTaskDto documents rank as the position "in its category column",
//    but the Kanban board groups by STATUS. The frontend treats rank as the
//    0-based position within the task's status column - to confirm backend-side.
import { apiClient } from "@/lib/apiClient";

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

export async function listTasks(projectId: string): Promise<Task[]> {
  // apiClient<unknown>, not apiClient<Task[]>: that generic is only a
  // TS-level cast, it doesn't check the response shape. parseTask does.
  const payload = await apiClient<unknown>(`/projects/${projectId}/tasks`);
  if (!Array.isArray(payload)) {
    throw new Error("Tasks response is invalid");
  }

  const parsed = payload.map(parseTask);
  if (parsed.some((task) => task === null)) {
    throw new Error("Tasks response contains invalid task items");
  }
  return parsed as Task[];
}

export async function getTask(
  projectId: string,
  taskId: string
): Promise<Task> {
  const payload = await apiClient<unknown>(
    `/projects/${projectId}/tasks/${taskId}`
  );

  const parsed = parseTask(payload);
  if (parsed === null) {
    throw new Error("Task response is invalid");
  }
  return parsed;
}

export async function createTask(
  projectId: string,
  body: CreateTaskBody
): Promise<Task> {
  const payload = await apiClient<unknown>(`/projects/${projectId}/tasks`, {
    method: "POST",
    body: body,
  });

  const parsed = parseTask(payload);
  if (parsed === null) {
    throw new Error("Task creation response was invalid");
  }
  return parsed;
}

// PATCH takes one partial `updates` object rather than positional params, so
// a caller only ever sends what it means to change - dragging a card sends
// { status, rank } and can't clobber an unsaved title elsewhere.
export async function updateTask(
  projectId: string,
  taskId: string,
  updates: UpdateTaskBody
): Promise<Task> {
  const payload = await apiClient<unknown>(
    `/projects/${projectId}/tasks/${taskId}`,
    { method: "PATCH", body: updates }
  );

  const parsed = parseTask(payload);
  if (parsed === null) {
    throw new Error("Task modification response was invalid");
  }
  return parsed;
}

// Returns nothing: the controller's comments promise no body, and the reducer
// only needs the id it already has. If Tasks ends up returning the deleted row
// like Discovery does, widening this to Promise<Task> is a one-line change.
export async function deleteTask(
  projectId: string,
  taskId: string
): Promise<void> {
  await apiClient<unknown>(`/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
  });
}

// Converts an untrusted JSON value into a real Task, or null if it doesn't
// match the shape we expect. Never trust a response body's type just because
// a TS annotation says so.
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
