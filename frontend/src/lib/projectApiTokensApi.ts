import { apiClient } from "./apiClient";

export type ProjectApiTokenPermission = "READ" | "READ_WRITE";

export interface ProjectApiToken {
  id: string;
  projectId: string;
  label: string;
  permission: ProjectApiTokenPermission;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedProjectApiToken {
  token: ProjectApiToken;
  apiKey: string;
}

export function listProjectApiTokens(projectId: string) {
  return apiClient<unknown>(`/projects/${projectId}/api-tokens`).then(
    parseProjectApiTokens
  );
}

export function createProjectApiToken(
  projectId: string,
  input: {
    label: string;
    permission: ProjectApiTokenPermission;
    expiresAt: string;
  }
) {
  return apiClient<unknown>(`/projects/${projectId}/api-tokens`, {
    method: "POST",
    body: input,
  }).then(parseCreatedProjectApiToken);
}

export function revokeProjectApiToken(projectId: string, tokenId: string) {
  return apiClient<unknown>(
    `/projects/${projectId}/api-tokens/${tokenId}/revoke`,
    { method: "POST" }
  ).then(parseProjectApiToken);
}

export function deleteProjectApiToken(projectId: string, tokenId: string) {
  return apiClient<void>(`/projects/${projectId}/api-tokens/${tokenId}`, {
    method: "DELETE",
  });
}

function parseCreatedProjectApiToken(value: unknown): CreatedProjectApiToken {
  if (!isRecord(value) || typeof value.apiKey !== "string") {
    throw new Error(
      "Project API token API returned an invalid create response"
    );
  }
  return { token: parseProjectApiToken(value.token), apiKey: value.apiKey };
}

function parseProjectApiTokens(value: unknown): ProjectApiToken[] {
  if (!Array.isArray(value)) {
    throw new Error("Project API token API returned an invalid list response");
  }
  return value.map(parseProjectApiToken);
}

function parseProjectApiToken(value: unknown): ProjectApiToken {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.projectId !== "string" ||
    typeof value.label !== "string" ||
    !isPermission(value.permission) ||
    typeof value.createdAt !== "string" ||
    typeof value.expiresAt !== "string" ||
    !isNullableString(value.lastUsedAt) ||
    !isNullableString(value.revokedAt)
  ) {
    throw new Error("Project API token API returned an invalid token");
  }
  return {
    id: value.id,
    projectId: value.projectId,
    label: value.label,
    permission: value.permission,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    lastUsedAt: value.lastUsedAt,
    revokedAt: value.revokedAt,
  };
}

function isPermission(value: unknown): value is ProjectApiTokenPermission {
  return value === "READ" || value === "READ_WRITE";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
