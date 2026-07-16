// Notification bell and dropdown. Notification data is a follow-up integration.
import { Badge, Dropdown, DropdownHeader } from "flowbite-react";
import { HiOutlineBell } from "react-icons/hi2";
import { darkDropdownTheme } from "../../lib/flowbite";

export function NotificationBell() {
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
          aria-label="Open notifications"
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-transparent text-text-secondary transition hover:border-surface-border hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <HiOutlineBell className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    >
      <DropdownHeader>
        <div className="flex min-w-64 items-center justify-between gap-4">
          <span className="font-semibold">Notifications</span>
          <Badge color="success" size="xs">
            Up to date
          </Badge>
        </div>
      </DropdownHeader>
      <div className="max-w-72 px-4 py-4">
        <p className="text-left text-sm leading-5 text-text-secondary">
          No new notifications. Project updates will appear here.
        </p>
      </div>
    </Dropdown>
  );
}
