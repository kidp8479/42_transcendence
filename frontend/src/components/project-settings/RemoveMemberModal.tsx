import { Button, Modal } from "flowbite-react";
import type { ProjectMember } from "@/lib/projectMembersApi";

interface RemoveMemberModalProps {
  member: ProjectMember | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RemoveMemberModal({
  member,
  onClose,
  onConfirm,
}: RemoveMemberModalProps) {
  return (
    <Modal
      show={member !== null}
      size="md"
      onClose={onClose}
      popup
      className="
		[&>div>div]:!bg-surface-raised
		[&>div>div]:!border
		[&>div>div]:!border-control-bg
	  "
    >
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Remove member
        </h3>

        <p className="text-xs text-text-secondary">
          Are you sure you want to remove{" "}
          <span className="font-semibold text-text-primary">
            {member?.user.username}
          </span>{" "}
          from this project?
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            color="none"
            onClick={onClose}
            className="
		      !h-8
			  !px-3
              !py-1
			  !text-xs
			  !rounded-md
			  !border
			  !border-control-border
			  !bg-surface-overlay
		      !text-text-secondary
			  hover:!bg-surface-raised
			  hover:!border-brand-700
			  hover:!text-brand-700
			  focus:!ring-0
			  transition-colors
			"
          >
            Cancel
          </Button>

          <Button
            color="none"
            onClick={onConfirm}
            className="
			  !h-8
			  !px-3
			  !py-1
			  !text-xs
			  !rounded-md
			  border
			  border-red-500/30
		      bg-red-500/10
			  text-red-400
			  hover:bg-red-500/20
			  dark:border-red-500/30
			  dark:bg-red-500/10
			  dark:text-red-500
			  dark:hover:bg-red-500/20
			  focus-visible:!outline-none
			  focus-visible:!ring-2
			  focus-visible:!ring-red-500
			  dark:focus:!ring-red-500
			  inline-flex
			  items-center
			  gap-2
			"
          >
            Remove
          </Button>
        </div>
      </div>
    </Modal>
  );
}
