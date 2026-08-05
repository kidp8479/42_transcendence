import {
  Avatar,
  Dropdown,
  DropdownDivider,
  DropdownItem,
} from "flowbite-react";
import { RiMoreLine } from "react-icons/ri";
import { LiaTrashAltSolid } from "react-icons/lia";
import { LuShieldPlus, LuShieldMinus } from "react-icons/lu";
import { darkDropdownTheme } from "@/lib/flowbite";

// Scoped to this row's "..." menu only - rounds the item hover highlight
// and insets it from the panel edges (rectangular/edge-to-edge by default in
// darkDropdownTheme, shared with NotificationBell and UserMenu) to match the
// cogwheel dropdown (components/projects/ProjectCard.tsx), without touching
// that shared theme.
const roundedDropdownItemTheme = {
  container: "mx-1",
  base: "rounded-md text-xs",
};

interface MemberListItemProps {
  username: string;
  avatarUrl?: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  currentUserRole?: "OWNER" | "ADMIN" | "MEMBER";
  userId: string;
  onRoleChange: (userId: string, role: "ADMIN" | "MEMBER") => void;
  onRemove: (userId: string) => void;
}

export function MemberListItem({
  username,
  avatarUrl,
  role,
  currentUserRole,
  userId,
  onRoleChange,
  onRemove,
}: MemberListItemProps) {
  const canManageMember =
    (currentUserRole === "OWNER" && role !== "OWNER") ||
    (currentUserRole === "ADMIN" && role === "MEMBER");

  return (
    <div className="flex items-center justify-between rounded-md bg-surface-overlay px-3 py-2">
      <div className="flex items-center gap-2.5">
        <Avatar
          img={avatarUrl ?? undefined}
          rounded
          placeholderInitials={username.charAt(0).toUpperCase()}
          size="xs"
        />
        <span className="text-sm text-text-primary">{username}</span>
        <span
          className={`rounded-full border px-1.5 py-0 text-[9.5px] font-medium ${
            role === "OWNER"
              ? "border-teal-500/30 bg-teal-500/10 text-teal-400"
              : role === "ADMIN"
                ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                : "border-blue-500/30 bg-blue-500/10 text-blue-400"
          }`}
        >
          {role}
        </span>
      </div>

      {canManageMember && (
        <Dropdown
          inline
          arrowIcon={false}
          theme={darkDropdownTheme}
          // Scoped here instead of the shared darkDropdownTheme, which other
          // consumers still rely on - see the matching comment in
          // components/projects/ProjectCard.tsx for why border-solid and
          // !border-surface-border both need to be spelled out locally.
          className="border-solid !border-surface-border dark:border-solid dark:!border-surface-border"
          // renderTrigger, not label+aria-label: Flowbite's inline Dropdown
          // trigger drops any aria-label passed as a top-level prop (only
          // ...a11yProps make it onto the real <button>, not the rest of
          // buttonProps) - axe-core caught this as a nameless button.
          // renderTrigger hands back a real element Flowbite clones props
          // onto directly, same fix already used in NotificationBell.tsx.
          renderTrigger={(dropdownTheme) => (
            <button
              type="button"
              aria-label={`Manage ${username}`}
              className={dropdownTheme?.inlineWrapper}
            >
              <RiMoreLine className="h-4 w-4 text-text-secondary hover:text-text-primary" />
            </button>
          )}
        >
          {(currentUserRole === "OWNER" || currentUserRole === "ADMIN") &&
            role === "MEMBER" && (
              <DropdownItem
                theme={roundedDropdownItemTheme}
                onClick={() => onRoleChange(userId, "ADMIN")}
              >
                <div className="flex items-center gap-2">
                  <LuShieldPlus className="h-4 w-4" />
                  <span className="text-xs">Promote to Admin</span>
                </div>
              </DropdownItem>
            )}
          {currentUserRole === "OWNER" && role === "ADMIN" && (
            <DropdownItem
              theme={roundedDropdownItemTheme}
              onClick={() => onRoleChange(userId, "MEMBER")}
            >
              <div className="flex items-center gap-2">
                <LuShieldMinus className="h-4 w-4" />
                <span className="text-xs">Demote to Member</span>
              </div>
            </DropdownItem>
          )}
          <DropdownDivider />
          <DropdownItem
            theme={roundedDropdownItemTheme}
            className="!text-red-400"
            onClick={() => onRemove(userId)}
          >
            <div className="flex items-center gap-2 text-red-400">
              <LiaTrashAltSolid className="h-4 w-4" />
              <span className="text-xs">Remove from project</span>
            </div>
          </DropdownItem>
        </Dropdown>
      )}
    </div>
  );
}
