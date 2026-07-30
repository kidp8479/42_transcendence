// explicit style on purpose (no destructuring/shorthand), same as calendarEventsApi.ts
import { apiClient } from "@/lib/apiClient";

// mirrors what NotificationsService returns (backend/src/notifications/notifications.service.ts)
export interface Notification {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

// GET all - every notification belonging to the authenticated user, most
// recent first (backend orders by createdAt desc, no query params to send)
export async function getNotifications(): Promise<Notification[]> {
  const payload = await apiClient<unknown>("/notifications");
  if (!Array.isArray(payload)) {
    throw new Error("Notifications response is invalid");
  }

  const parsed = payload.map(parseNotification);
  if (parsed.some((notification) => notification === null)) {
    throw new Error("Notifications response contains invalid items");
  }

  return parsed as Notification[];
}

// PATCH - marks a single notification as read (no request body, the URL says it all)
export async function markNotificationAsRead(
  notificationId: string
): Promise<Notification> {
  const payload = await apiClient<unknown>(
    "/notifications/" + notificationId + "/read",
    { method: "PATCH" }
  );

  const parsed = parseNotification(payload);
  if (parsed === null) {
    throw new Error("Notification mark-as-read response was invalid");
  }
  return parsed;
}

// PATCH - marks every unread notification as read in one request (no id,
// no request body). The backend uses a Prisma updateMany, which returns a
// count instead of the updated rows, so this returns that count rather
// than a Notification like the other wrappers.
export async function markAllNotificationsAsRead(): Promise<number> {
  const payload = await apiClient<unknown>("/notifications/read-all", {
    method: "PATCH",
  });

  if (!isRecord(payload) || typeof payload.count !== "number") {
    throw new Error("Mark-all-as-read response was invalid");
  }
  return payload.count;
}

// DELETE - the backend returns the deleted notification's own body (200, not 204)
export async function deleteNotification(
  notificationId: string
): Promise<Notification> {
  const payload = await apiClient<unknown>("/notifications/" + notificationId, {
    method: "DELETE",
  });

  const parsed = parseNotification(payload);
  if (parsed === null) {
    throw new Error("Notification deletion response was invalid");
  }
  return parsed;
}

// DELETE - deletes every notification belonging to the authenticated user,
// read or unread. Same count-not-rows return shape as markAllNotificationsAsRead.
export async function deleteAllNotifications(): Promise<number> {
  const payload = await apiClient<unknown>("/notifications", {
    method: "DELETE",
  });

  if (!isRecord(payload) || typeof payload.count !== "number") {
    throw new Error("Delete-all response was invalid");
  }
  return payload.count;
}

function parseNotification(value: unknown): Notification | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const userId = value.userId;
  const message = value.message;
  const isRead = value.isRead;
  const link = value.link;
  const createdAt = value.createdAt;

  if (typeof id !== "string") {
    return null;
  }
  if (typeof userId !== "string") {
    return null;
  }
  if (typeof message !== "string") {
    return null;
  }
  if (typeof isRead !== "boolean") {
    return null;
  }
  if (link !== null && typeof link !== "string") {
    return null;
  }
  if (typeof createdAt !== "string") {
    return null;
  }

  return {
    id: id,
    userId: userId,
    message: message,
    isRead: isRead,
    link: link,
    createdAt: createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
