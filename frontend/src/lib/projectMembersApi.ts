// explicit style on purpose (no destructuring/shorthand), same as discoveryBlocks.ts
import { apiClient } from "@/lib/apiClient";

// mirrors ProjectMembersService.findAll's include: the member row + its user info
export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: "ADMIN" | "MEMBER";
  username: string;
  avatarUrl: string | null;
}

// GET all - only findAll is implemented on the backend for now; add/remove
// member management belongs to the Project Settings ticket
export async function listProjectMembers(
  projectId: string
): Promise<ProjectMember[]> {
  const payload = await apiClient<unknown>(
    "/projects/" + projectId + "/members"
  );
  if (!Array.isArray(payload)) {
    throw new Error("Project members response is invalid");
  }

  const parsed = payload.map(parseProjectMember);
  if (parsed.some((member) => member === null)) {
    throw new Error("Project member response contains invalid items");
  }

  return parsed as ProjectMember[];
}

function parseProjectMember(value: unknown): ProjectMember | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const userId = value.userId;
  const projectId = value.projectId;
  const role = value.role;
  const user = value.user;

  if (typeof id !== "string") {
    return null;
  }
  if (typeof userId !== "string") {
    return null;
  }
  if (typeof projectId !== "string") {
    return null;
  }
  if (role !== "ADMIN" && role !== "MEMBER") {
    return null;
  }
  if (!isRecord(user)) {
    return null;
  }

  const username = user.username;
  const avatarUrl = user.avatarUrl;
  if (typeof username !== "string") {
    return null;
  }
  if (avatarUrl !== null && typeof avatarUrl !== "string") {
    return null;
  }

  return {
    id: id,
    userId: userId,
    projectId: projectId,
    role: role,
    username: username,
    avatarUrl: avatarUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
