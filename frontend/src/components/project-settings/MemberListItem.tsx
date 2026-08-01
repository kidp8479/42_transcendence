import { Avatar, Dropdown, DropdownItem } from "flowbite-react";
import { RiMoreLine } from "react-icons/ri";
import { LiaTrashAltSolid } from "react-icons/lia";
import { LuShieldPlus, LuShieldMinus } from "react-icons/lu";

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
              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
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
          className="!bg-surface-raised"
          label={
            <RiMoreLine className="h-4 w-4 text-text-secondary hover:text-text-primary" />
          }
        >
          {currentUserRole === "OWNER" && role === "MEMBER" && (
            <DropdownItem
              className="!text-xs hover:!bg-transparent focus:!bg-transparent"
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
              className="hover:!bg-transparent focus:!bg-transparent"
              onClick={() => onRoleChange(userId, "MEMBER")}
            >
              <div className="flex items-center gap-2">
                <LuShieldMinus className="h-4 w-4" />
                <span className="text-xs">Demote to Member</span>
              </div>
            </DropdownItem>
          )}
          <DropdownItem
            className="!text-xs !text-red-700 hover:!bg-transparent focus:!bg-transparent"
            onClick={() => onRemove(userId)}
          >
            <div className="flex items-center gap-2 text-red-700">
              <LiaTrashAltSolid className="h-4 w-4" />
              <span className="text-xs">Remove from project</span>
            </div>
          </DropdownItem>
        </Dropdown>
      )}
    </div>
  );
}
