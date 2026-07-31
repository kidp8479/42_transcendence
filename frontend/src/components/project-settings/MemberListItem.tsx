import { Avatar } from "flowbite-react";
import { HiX } from "react-icons/hi";

interface MemberListItemProps {
  username: string;
  avatarUrl?: string | null;
  onRemove?: () => void;
}

export function MemberListItem({
  username,
  avatarUrl,
  onRemove,
}: MemberListItemProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-overlay px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar img={avatarUrl ?? undefined} rounded />

        <span className="font-medium text-text-primary">{username}</span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="text-text-secondary hover:text-text-primary"
        aria-label={`Remove ${username}`}
      >
        <HiX className="h-5 w-5" />
      </button>
    </div>
  );
}
