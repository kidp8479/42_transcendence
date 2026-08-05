import { Button, Modal } from "flowbite-react";

// KNOWN DUPLICATION: this modal's structure and styling (no icon,
// left-aligned text, muted-red confirm button, one-off inline Modal
// className overrides) is hand-duplicated in RemoveMemberModal.tsx and
// DangerZoneSection.tsx's delete modal, and also diverges from the
// unrelated delete-account modal in user-settings.tsx (which uses a
// centered layout, a warning icon, Flowbite's solid color="red" button, and
// a shared theme object). A future style or logic fix applied to just this
// file is easy to leave silently unfixed in the other two - check
// RemoveMemberModal.tsx and DangerZoneSection.tsx before assuming a change
// here is complete. Not unified yet on purpose: doing so means touching
// shared modal theming across several components, scoped as its own
// follow-up branch rather than bundled into feature work.

interface LeaveProjectModalProps {
  show: boolean;
  isLeaving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function LeaveProjectModal({
  show,
  isLeaving,
  onClose,
  onConfirm,
}: LeaveProjectModalProps) {
  return (
    <Modal
      show={show}
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
          Leave project
        </h3>

        <p className="text-xs text-text-secondary">
          Are you sure you want to leave this project? You&apos;ll need to be
          re-invited to rejoin.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            color="none"
            onClick={onClose}
            disabled={isLeaving}
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
            onClick={() => void onConfirm()}
            disabled={isLeaving}
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
            {isLeaving ? "Leaving..." : "Leave"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
