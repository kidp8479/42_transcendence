import { apiClient } from "./apiClient";

export interface User {
  username: string;
  email: string;
  avatarUrl: string;
  campus: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUser(
  value: unknown
): User | null {
  if (!isRecord(value)) {
    return null;
  }

  const { username, email, avatarUrl, campus } = value;
  if (
    typeof username !== "string" ||
    typeof email !== "string" ||
    typeof avatarUrl !== "string" ||
    typeof campus !== "string"
  ) { 
    return null;
  }

  return { username, email, avatarUrl, campus };
}


// PATCH /users/me
export async function updateMe(
  dto: Partial<User>
): Promise<User> {

  return apiClient<unknown>(
    `/users/me`, { method: "PATCH", body: dto }
  ).then((payload) => {
    const parsed = parseUser(payload);
    if (parsed === null) {
      throw new Error("Item response is invalid");
    }
    return parsed;
  })
}
