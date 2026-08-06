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
// Pass `before` + `beforeCreatedAt` (the id and createdAt of a message
// already loaded, e.g. messages[0]) to fetch the page strictly older than
// it, for loading earlier history on demand. Sent as plain values rather
// than a server-side cursor lookup, so paging still works even if that
// message has since been deleted - see chat.service.ts's findAll.
export function fetchChatMessages(
  projectId: string,
  options?: { before?: string; beforeCreatedAt?: string; take?: number }
) {
  const params = new URLSearchParams();
  if (options?.before !== undefined) {
    params.set("before", options.before);
  }
  if (options?.beforeCreatedAt !== undefined) {
    params.set("beforeCreatedAt", options.beforeCreatedAt);
  }
  if (options?.take !== undefined) {
    params.set("take", String(options.take));
  }
  const query = params.toString();
  return apiClient<unknown>(
    `/projects/${projectId}/chat${query ? `?${query}` : ""}`
  ).then(parseChatMessages);
}

// PATCH /projects/:projectId/chat/read - explicit "mark this conversation
// read" action. Call only after the fetched messages have actually been
// applied to local state (not merely once the GET resolves), so a client
// that unmounts mid-fetch never marks messages read it didn't end up
// showing.
//
// lastRead identifies the newest message the caller actually fetched (id +
// createdAt) - never let the server stamp its own "now" here, since a
// message from someone else can land in the gap between the caller's
// history GET and this PATCH, and "now" would be after that insert,
// wrongly marking a message the caller never rendered as read. Omit
// entirely when the conversation had zero messages to observe.
export function markChatRead(
  projectId: string,
  lastRead?: { id: string; createdAt: string }
) {
  return apiClient<void>(`/projects/${projectId}/chat/read`, {
    method: "PATCH",
    body: lastRead
      ? { lastReadMessageId: lastRead.id, lastReadAt: lastRead.createdAt }
      : {},
  });
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
