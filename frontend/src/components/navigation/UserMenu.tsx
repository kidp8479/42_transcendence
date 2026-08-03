// Session-aware avatar menu with account navigation and logout.
import {
  Avatar,
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from "flowbite-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineCog6Tooth,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import { logout, type AuthSession } from "../../lib/auth";
import { authSessionResource } from "../../lib/authState";
import { darkDropdownTheme } from "../../lib/flowbite";

interface UserMenuProps {
  session: AuthSession;
}

export function UserMenu({ session }: UserMenuProps) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const initials = session.user.username.slice(0, 2).toUpperCase();

  async function handleLogout() {
    setLogoutError("");
    setLoggingOut(true);
    try {
      await logout(session.csrfToken);
      authSessionResource.setAnonymous();
      await navigate({ to: "/" });
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Unable to sign out"
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="relative">
      <Dropdown
        arrowIcon={false}
        inline
        placement="bottom-end"
        theme={darkDropdownTheme}
        renderTrigger={() => (
          <button
            type="button"
            aria-label="Open account menu"
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-raised"
          >
            <Avatar
              alt={`${session.user.username}'s avatar`}
              bordered
              color="success"
              img={session.user.avatarUrl ?? undefined}
              placeholderInitials={initials}
              rounded
              size="sm"
              theme={{
                root: {
                  initials: {
                    base: "relative inline-flex items-center justify-center overflow-hidden bg-surface-overlay",
                    text: "font-medium text-text-primary",
                  },
                },
              }}
            />
          </button>
        )}
      >
        <DropdownHeader>
          <span className="block text-xs font-normal text-text-secondary">
            Signed in as
          </span>
          <span className="block truncate text-sm font-semibold text-text-primary">
            {session.user.username}
          </span>
        </DropdownHeader>
        <DropdownItem
          icon={HiOutlineSquares2X2}
          onClick={() => void navigate({ to: "/dashboard" })}
        >
          Dashboard
        </DropdownItem>
        <DropdownItem
          icon={HiOutlineCog6Tooth}
          onClick={() => void navigate({ to: "/user-settings" })}
        >
          Settings
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem
          disabled={loggingOut}
          icon={HiOutlineArrowRightOnRectangle}
          onClick={() => void handleLogout()}
        >
          {loggingOut ? "Signing out..." : "Sign out"}
        </DropdownItem>
      </Dropdown>

      {logoutError && (
        <p
          role="alert"
          className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-error bg-surface-overlay px-3 py-2 text-sm text-error shadow-xl"
        >
          {logoutError}
        </p>
      )}
    </div>
  );
}
