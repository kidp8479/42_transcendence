// Project members API helpers for the Kanban/List tabs (assignee pickers).
//
// TODO: not wired yet - the Kanban tab runs on in-memory mock state (see
// routes/_authenticated/$projectId/kanban.tsx). The backend controller exists
// but has no route decorators. Switch the route to this function once
// GET /api/projects/:projectId/members is implemented.
//
// The response shape is TBD (nothing commits to including the user relation
// yet). The UI needs username + avatarUrl, so the validator below accepts
// either a flattened user or a ProjectMember row with an included user
// ({ user: { id, username, ... } }) - same tolerance as parseAssignees in
// lib/tasks.ts.
import { apiClient } from "@/lib/apiClient";

export interface ProjectMemberUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export async function listProjectMembers(
  projectId: string
): Promise<ProjectMemberUser[]> {
  const payload = await apiClient<unknown>(`/projects/${projectId}/members`);
  if (!Array.isArray(payload)) {
    throw new Error("Project members response is invalid");
  }

  const parsed = payload.map(parseProjectMemberUser);
  if (parsed.some((member) => member === null)) {
    throw new Error("Project members response contains invalid items");
  }
  return parsed as ProjectMemberUser[];
}

function parseProjectMemberUser(value: unknown): ProjectMemberUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const user = isRecord(value.user) ? value.user : value;
  if (
    typeof user.id !== "string" ||
    typeof user.username !== "string" ||
    (user.avatarUrl !== null &&
      user.avatarUrl !== undefined &&
      typeof user.avatarUrl !== "string")
  ) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
