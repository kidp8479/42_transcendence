// Tasks API helpers for the Kanban/List tabs: network + parsing kept out of the
// routes, mirroring the backend DTOs (backend/src/tasks/dto/*.ts).
//
// `rank` is the 0-based position inside the task's STATUS column. The server
// owns that invariant - it clamps the rank you send to the column's length and
// shifts the siblings of both columns - so a drag is one PATCH { status, rank }
// and a concurrent reorder comes back as 409: reload, don't retry.
import { apiClient } from "@/lib/apiClient";

// Mirrors backend/src/tasks/tasks.constants.ts - kept in sync by hand, the two
// builds share no import (same arrangement as discoveryBlocks.ts). The drawer
// caps its inputs at these values so a long title stops at the field instead of
// coming back as a generic 400 on save.
export const TASK_TITLE_MAX_LENGTH = 100;
export const TASK_NOTES_MAX_LENGTH = 2000;

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

// An assignee as the board displays it. TasksService.mapTask flattens the
// TaskAssignee join rows down to this - the rows themselves carry no username.
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

// Mirrors UpdateTaskDto (every field optional).
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
  // Replaces the whole assignee set, it isn't a delta. UpdateTaskDto inherits
  // it from CreateTaskDto via PartialType, so a PATCH carrying it is accepted.
  assigneeIds?: string[];
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

// The backend does return the deleted row (200, not 204, same as Discovery),
// but the reducer only needs the id it already has - so it is dropped here
// rather than parsed for nothing.
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
// a TS annotation says so. Exported: also reused to validate WS payloads in
// kanban.tsx, same as parseDiscoveryBlockItem is reused by discovery.tsx.
export function parseTask(value: unknown): Task | null {
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

  // Required, not tolerated missing: every read path on the backend applies the
  // same `taskInclude` (delete included), so an absent array means the contract
  // broke and the caller should hear about it.
  const parsedAssignees = parseAssignees(assignees);
  if (parsedAssignees === null) {
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
    assignees: parsedAssignees,
  };
}

// Flattened users only - TasksService.mapTask never sends the raw join rows.
function parseAssignees(value: unknown): TaskAssigneeUser[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: TaskAssigneeUser[] = [];
  for (const user of value) {
    if (
      !isRecord(user) ||
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
