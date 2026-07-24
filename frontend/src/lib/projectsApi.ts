import { apiClient } from "./apiClient";

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
  role: "ADMIN" | "MEMBER"; // the role of the authenticated user in this project
  // 0-100, computed backend-side from EvaluationChecklistItem.isChecked.
  progress: number;
  // count of ProjectMember rows for this project.
  memberCount: number;
}

// GET /projects => every project the authenticated user is a member of
export function listProjects() {
  return apiClient<Project[]>("/projects");
}

// GET /projects/:id => one project, only if the caller is a member of it
export function getProject(id: string) {
  return apiClient<Project>(`/projects/${id}`);
}

// POST /projects => create a project; the caller becomes its first member
export function createProject(input: { name: string; description?: string }) {
  return apiClient<Project>("/projects", { method: "POST", body: input });
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
  return apiClient<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: input,
  });
}
