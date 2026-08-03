import { apiClient } from "./apiClient";

export const maxProjectNameLength = 100;
export const maxProjectDescriptionLength = 1000;

export type ProjectStatus = "IN_PROGRESS" | "REVIEW" | "COMPLETED";

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  // Both nullable in the DB (Project.description/deadline in
  // schema.prisma) - deadline is never seeded today, so callers must
  // handle null rather than assume every project has one.
  description: string | null;
  deadline: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER"; // the role of the authenticated user in this project
  // 0-100, computed backend-side from EvaluationChecklistItem.isChecked.
  progress: number;
  // count of ProjectMember rows for this project.
  memberCount: number;
  isArchived: boolean;
}

// GET /projects => every project the authenticated user is a member of
export function listProjects() {
  return apiClient<unknown>("/projects").then(parseProjects);
}

// GET /projects/:id => one project, only if the caller is a member of it
export function getProject(id: string) {
  return apiClient<unknown>(`/projects/${id}`).then(parseProject);
}

// POST /projects => create a project; the caller becomes its first member
export function createProject(input: { name: string; description?: string }) {
  return apiClient<unknown>("/projects", { method: "POST", body: input }).then(
    parseProject
  );
}

// DELETE /projects/:id => remove a project; caller must be ADMIN (see projects.service)
export function deleteProject(id: string) {
  return apiClient<void>(`/projects/${id}`, { method: "DELETE" });
}

// PATCH /projects/:id => partial update; only provided fields are changed; caller must be ADMIN
export function updateProject(
  id: string,
  input: {
    name?: string;
    description?: string;
    status?: ProjectStatus;
    isArchived?: boolean;
    deadline?: string | null;
  }
) {
  return apiClient<unknown>(`/projects/${id}`, {
    method: "PATCH",
    body: input,
  }).then(parseProject);
}

function parseProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) {
    throw new Error("Projects API returned an invalid response");
  }
  return value.map(parseProject);
}

function parseProject(value: unknown): Project {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isProjectStatus(value.status) ||
    (value.description !== null && typeof value.description !== "string") ||
    (value.deadline !== null && typeof value.deadline !== "string") ||
    !isProjectMemberRole(value.role) ||
    typeof value.progress !== "number" ||
    typeof value.memberCount !== "number" ||
    typeof value.isArchived !== "boolean"
  ) {
    throw new Error("Projects API returned an invalid project");
  }
  return {
    id: value.id,
    name: value.name,
    status: value.status,
    description: value.description,
    deadline: value.deadline,
    role: value.role,
    progress: value.progress,
    memberCount: value.memberCount,
    isArchived: value.isArchived,
  };
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === "IN_PROGRESS" || value === "REVIEW" || value === "COMPLETED";
}

function isProjectMemberRole(value: unknown): value is Project["role"] {
  return value === "OWNER" || value === "ADMIN" || value === "MEMBER";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
