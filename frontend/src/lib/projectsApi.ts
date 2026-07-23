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