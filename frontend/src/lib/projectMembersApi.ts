// projectMembersApi.ts
// Typed API client for project member management.
// This file contains all frontend calls related to ProjectMember join table.

// ProjectMember represents the relationship between a User and a Project:
// one row = one user belonging to one project.
// The backend routes are nested under the project because memberships only
// make sense in the context of a specific project.

// All requests go through apiClient so they automatically receive:
// - authentication cookies
// - CSRF token handling for mutations
// - normalized API errors

import { apiClient } from "@/lib/apiClient";

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: "ADMIN" | "MEMBER" | "OWNER";
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    campus: string | null;
  };
}

// ENDPOINTS:
// GET    /api/projects/:projectId/members
//  => list all members belonging to a project
//  => any project member can view the list
//  => backend verifies the requesting user belongs to the project
export function getMembers(projectId: string) {
  return apiClient<unknown>(`/projects/${projectId}/members`).then(
    parseProjectMembers
  );
}

// parser/helper function
function parseProjectMembers(value: unknown): ProjectMember[] {
  if (!Array.isArray(value)) {
    throw new Error("Project Members API returned an invalid response");
  }
  return value.map(parseProjectMember);
}

function parseProjectMember(value: unknown): ProjectMember {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.projectId !== "string" ||
    !isProjectMemberRole(value.role) ||
    !isRecord(value.user) ||
    typeof value.user.id !== "string" ||
    typeof value.user.username !== "string" ||
    (value.user.avatarUrl !== null &&
      typeof value.user.avatarUrl !== "string") ||
    (value.user.campus !== null && typeof value.user.campus !== "string")
  ) {
    throw new Error("Project Members API returned an invalid member");
  }
  return {
    id: value.id,
    userId: value.userId,
    projectId: value.projectId,
    role: value.role,
    user: {
      id: value.user.id,
      username: value.user.username,
      avatarUrl: value.user.avatarUrl,
      campus: value.user.campus,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProjectMemberRole(value: unknown): value is ProjectMember["role"] {
  return value === "ADMIN" || value === "MEMBER" || value === "OWNER";
}

// POST   /api/projects/:projectId/members
//  => add a user to a project
//  => body: { userId }
//  => only ADMIN members can add users
//  => backend enforces the permission check (frontend must not be trusted)
export function addMember(projectId: string, input: { userId: string }) {
  return apiClient<unknown>(`/projects/${projectId}/members`, {
    method: "POST",
    body: input,
  }).then(parseProjectMember);
}

// DELETE /api/projects/:projectId/members/:userId
//  => remove a user from a project
//  => only ADMIN members can remove users
//  => both IDs come from the URL, no request body required
export function removeMember(projectId: string, userId: string) {
  return apiClient<void>(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}

// IMPORTANT:
// The frontend hides member-management controls for non-ADMIN users,
// but authorization is always enforced by the backend.
// Never rely only on UI permissions because API calls can be made manually.

// This follows the same runtime-validation pattern as projectsApi.ts:
// API responses treated as unknown and validated before being used by React.
