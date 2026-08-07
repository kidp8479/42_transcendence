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
  // ISO timestamp, Prisma-managed (@updatedAt) - the version an edit was
  // based on. Sent back on a details save so the backend can detect a
  // concurrent edit; see updateProjectDetails below.
  updatedAt: string;
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
// name/description are NOT accepted here - use updateProjectDetails() below,
// which enforces the optimistic-concurrency check. The backend now rejects
// them on this route (whitelist + forbidNonWhitelisted), so this type isn't
// just documentation - sending them would 400.
export function updateProject(
  id: string,
  input: {
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

// PATCH /projects/:id/details => name/description only, OWNER/ADMIN-only.
// Separate from updateProject() above (see projects.controller.ts for why)
// - includes updatedAt, the version this edit was based on, so a save
// based on stale data is rejected (409, ApiError.status) instead of
// silently overwriting a concurrent edit from someone else.
//
// description is `string | null`, not optional: this call site always has
// an opinion (the edit form's current value or null for "cleared"), and
// sending null - not omitting the key - is what tells the backend to
// actually clear an existing description rather than leave it untouched.
export function updateProjectDetails(
  id: string,
  input: { name: string; description: string | null; updatedAt: string }
) {
  return apiClient<unknown>(`/projects/${id}/details`, {
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
    typeof value.isArchived !== "boolean" ||
    typeof value.updatedAt !== "string"
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
    updatedAt: value.updatedAt,
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
