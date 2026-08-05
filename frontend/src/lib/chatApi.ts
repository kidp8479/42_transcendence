// chatApi.ts
// Typed API client for the per-project group chat.
// One chat per Project (see ChatMessage in schema.prisma) - there is no
// separate "Conversation" model, the project id in the URL is the room id.

import { apiClient } from "@/lib/apiClient";

export interface ChatMessageAuthor {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  // null when the author's account was deleted since (ChatMessage.userId is
  // SetNull on User delete, see schema.prisma) - the message itself survives.
  author: ChatMessageAuthor | null;
}

export const CHAT_MESSAGE_CONTENT_MAX_LENGTH = 4000;

// GET /projects/:projectId/chat - a page of history, oldest-first.
// Pass `before` (a message id already loaded) to fetch the page strictly
// older than it, for loading earlier history on demand.
export function fetchChatMessages(
  projectId: string,
  options?: { before?: string; take?: number }
) {
  const params = new URLSearchParams();
  if (options?.before !== undefined) {
    params.set("before", options.before);
  }
  if (options?.take !== undefined) {
    params.set("take", String(options.take));
  }
  const query = params.toString();
  return apiClient<unknown>(
    `/projects/${projectId}/chat${query ? `?${query}` : ""}`
  ).then(parseChatMessages);
}

// POST /projects/:projectId/chat
export function createChatMessage(projectId: string, content: string) {
  return apiClient<unknown>(`/projects/${projectId}/chat`, {
    method: "POST",
    body: { content },
  }).then((payload) => {
    const parsed = parseChatMessage(payload);
    if (parsed === null) {
      throw new Error("Chat message response is invalid");
    }
    return parsed;
  });
}

// DELETE /projects/:projectId/chat/:id - only the message's own author can
// delete it (enforced backend-side, see chat.service.ts).
export function deleteChatMessage(projectId: string, id: string) {
  return apiClient<void>(`/projects/${projectId}/chat/${id}`, {
    method: "DELETE",
  });
}

// GET /chat/unread - project ids (among the caller's own project
// memberships) that have at least one message they haven't seen yet.
// Backs the red-dot unread badge - see chatUnreadState.ts.
export function fetchUnreadChatProjectIds(): Promise<string[]> {
  return apiClient<unknown>("/chat/unread").then((value) => {
    if (
      !Array.isArray(value) ||
      value.some((entry) => typeof entry !== "string")
    ) {
      throw new Error("Unread chat response is invalid");
    }
    return value as string[];
  });
}

function parseChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    throw new Error("Chat messages response is invalid");
  }
  const parsed = value.map(parseChatMessage);
  if (parsed.some((message) => message === null)) {
    throw new Error("Chat messages response contains an invalid message");
  }
  return parsed as ChatMessage[];
}

// Exported for useLiveItemSync("chat", parseChatMessage, ...), same contract
// as parseEvaluationChecklistItem: null on any missing/mistyped field.
export function parseChatMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, projectId, content, createdAt, user } = value;
  if (
    typeof id !== "string" ||
    typeof projectId !== "string" ||
    typeof content !== "string" ||
    typeof createdAt !== "string" ||
    (user !== null && user !== undefined && !isValidAuthor(user))
  ) {
    return null;
  }
  return {
    id,
    projectId,
    content,
    createdAt,
    author: isValidAuthor(user) ? user : null,
  };
}

function isValidAuthor(value: unknown): value is ChatMessageAuthor {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.username === "string" &&
    (value.avatarUrl === null || typeof value.avatarUrl === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
