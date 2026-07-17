// Shared projects API helpers used by authenticated layouts/components.
//
// Why this file exists:
// - keeps network + parsing logic out of route files/components
// - gives a single typed contract for sidebar project rows
// - centralizes unauthorized handling semantics
export type ProjectStatus = "IN_PROGRESS" | "REVIEW" | "COMPLETED";

export interface SidebarProject {
  id: string;
  name: string;
  status: ProjectStatus;
}

export class ProjectsUnauthorizedError extends Error {
  constructor() {
    super("Authentication is required to load projects");
    this.name = "ProjectsUnauthorizedError";
  }
}

export async function fetchSidebarProjects(): Promise<SidebarProject[]> {
  // The backend derives the current user from the session cookie; no user id
  // is sent by the frontend for this endpoint.
  const response = await fetch(`${import.meta.env.VITE_API_URL}/projects`, {
    credentials: "include",
  });

  if (response.status === 401) {
    throw new ProjectsUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error("Failed to load sidebar projects");
  }

  // Parse as unknown first, then validate each item to keep runtime safety.
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Projects response is invalid");
  }

  const parsed = payload.map(parseSidebarProject);
  if (parsed.some((project) => project === null)) {
    throw new Error("Projects response contains invalid project items");
  }

  return parsed as SidebarProject[];
}

function parseSidebarProject(value: unknown): SidebarProject | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, name, status } = value;
  if (typeof id !== "string" || typeof name !== "string") {
    return null;
  }
  if (
    status !== "IN_PROGRESS" &&
    status !== "REVIEW" &&
    status !== "COMPLETED"
  ) {
    return null;
  }

  return { id, name, status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
