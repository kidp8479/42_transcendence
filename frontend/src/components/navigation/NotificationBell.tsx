// Notification bell and dropdown: fetches the authenticated user's
// notifications on mount, then stays live via the shared WebSocket
// connection (see realtimeSocket.ts) for anything created afterwards.
import { Dropdown, DropdownHeader } from "flowbite-react";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { HiOutlineBell } from "react-icons/hi2";
import { darkDropdownTheme } from "../../lib/flowbite";
import { getRealtimeSocket } from "../../lib/realtimeSocket";
import {
  deleteAllNotifications,
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type Notification,
} from "../../lib/notificationsApi";
import { useToast } from "../../hooks/useToast";

export function NotificationBell() {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  // initial fetch - runs once on mount, independent of the WebSocket below
  useEffect(() => {
    let cancelled = false;

    getNotifications()
      .then((fetched) => {
        if (!cancelled) {
          setNotifications(fetched);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showToast({ type: "error", message: errorMessage(error) });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // live updates - separate effect from the fetch above, since this one's
  // job is only to attach/detach the socket listener, not to fetch anything
  useEffect(() => {
    const socket = getRealtimeSocket();

    function handleNewNotification(notification: Notification) {
      setNotifications((current) => [notification, ...current]);
    }

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, []);

  async function handleMarkAsRead(notificationId: string) {
    try {
      const updated = await markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === updated.id ? updated : notification
        )
      );
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
    }
  }

  async function handleMarkAllAsRead() {
    setMarkingAllAsRead(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true }))
      );
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
    } finally {
      setMarkingAllAsRead(false);
    }
  }

  async function handleDelete(notificationId: string) {
    try {
      await deleteNotification(notificationId);
      setNotifications((current) =>
        current.filter((notification) => notification.id !== notificationId)
      );
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await deleteAllNotifications();
      setNotifications([]);
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <Dropdown
      arrowIcon={false}
      dismissOnClick={false}
      inline
      placement="bottom-end"
      theme={darkDropdownTheme}
      renderTrigger={() => (
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `Open notifications, ${unreadCount} unread`
              : "Open notifications"
          }
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-transparent text-text-secondary transition hover:border-surface-border hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <HiOutlineBell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-control-error px-1 text-[10px] font-semibold leading-none text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}
    >
      <DropdownHeader>
        <div className="flex min-w-64 items-center justify-between gap-4">
          <span className="font-semibold">Notifications</span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 ? (
              <button
                type="button"
                disabled={markingAllAsRead}
                onClick={() => void handleMarkAllAsRead()}
                className="text-xs font-medium text-brand-400 hover:text-brand-300 focus:outline-none focus:underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            ) : (
              <span className="rounded-md bg-status-completed/15 px-1 py-0.5 text-[10px] font-semibold text-status-completed">
                Up to date
              </span>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                disabled={deletingAll}
                onClick={() => void handleDeleteAll()}
                className="text-xs font-medium text-control-error hover:text-red-400 focus:outline-none focus:underline disabled:opacity-50"
              >
                Delete all
              </button>
            )}
          </div>
        </div>
      </DropdownHeader>

      <div className="max-h-80 max-w-80 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-4 text-left text-sm leading-5 text-text-secondary">
            Loading notifications...
          </p>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-4 text-left text-sm leading-5 text-text-secondary">
            No new notifications. Project updates will appear here.
          </p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={
                "flex items-start justify-between gap-2 border-b border-surface-border px-4 py-3 last:border-b-0 " +
                (notification.isRead ? "" : "bg-surface-overlay")
              }
            >
              <button
                type="button"
                disabled={notification.isRead}
                onClick={() => void handleMarkAsRead(notification.id)}
                className="flex-1 text-left focus:outline-none disabled:cursor-default"
              >
                <p className="text-sm text-text-primary">
                  {notification.message}
                </p>
                <span className="text-xs text-text-secondary">
                  {dayjs(notification.createdAt).format("D MMM, HH:mm")}
                </span>
              </button>
              <button
                type="button"
                aria-label="Delete notification"
                onClick={() => void handleDelete(notification.id)}
                className="text-xs text-text-secondary hover:text-control-error focus:outline-none focus:underline"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </Dropdown>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Notification request failed";
}
