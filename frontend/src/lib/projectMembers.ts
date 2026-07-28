// Project members API helpers for the Kanban/List tabs (assignee pickers).
//
// TODO: not wired yet - the Kanban tab runs on in-memory mock state (see
// routes/_authenticated/$projectId/kanban.tsx). The backend controller exists
// but ProjectMembersService is still TODO. Switch the route to this fetcher
// once GET /api/projects/:projectId/members is implemented.
//
// The response shape is TBD (the controller is a comment stub and nothing
// commits to including the user relation yet). The UI needs username +
// avatarUrl, so the validator below accepts either a flattened user or a
// ProjectMember row with an included user ({ user: { id, username, ... } }) -
// same tolerance as parseAssignees in lib/tasks.ts.

export interface ProjectMemberUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export class ProjectMembersUnauthorizedError extends Error {
  constructor() {
    super("Authentication is required to load project members");
    this.name = "ProjectMembersUnauthorizedError";
  }
}

export async function fetchProjectMembers(
  projectId: string
): Promise<ProjectMemberUser[]> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/projects/${projectId}/members`,
    { credentials: "include" }
  );

  if (response.status === 401) {
    throw new ProjectMembersUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(`Failed to load members for project ${projectId}`);
  }

  // Parse as unknown first, then validate each item to keep runtime safety.
  const payload: unknown = await response.json();
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
