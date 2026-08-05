import { Button, Modal, ModalBody, ModalHeader } from "flowbite-react";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import type { ProjectMember } from "@/lib/projectMembersApi";
import {
  darkSurfaceModalCancelButtonClass,
  darkSurfaceModalTheme,
} from "@/lib/flowbite";

interface RemoveMemberModalProps {
  member: ProjectMember | null;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

// Centered, icon-led layout matching the other destructive confirmations
// on this page - LeaveProjectModal.tsx and DangerZoneSection's delete
// modal, both sharing this same darkSurfaceModalTheme/color="red" style.
export function RemoveMemberModal({
  member,
  isRemoving,
  onClose,
  onConfirm,
}: RemoveMemberModalProps) {
  return (
    <Modal
      show={member !== null}
      dismissible
      size="md"
      theme={darkSurfaceModalTheme}
      onClose={onClose}
      popup
    >
      <ModalHeader />
      <ModalBody>
        <div className="flex flex-col items-center gap-4 pb-2 text-center">
          <HiOutlineExclamationTriangle className="h-10 w-10 text-control-error" />

          <h3 className="text-lg font-semibold text-text-primary">
            Are you sure you want to remove{" "}
            <span className="font-semibold">{member?.user.username}</span> from
            this project?
          </h3>

          <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:flex-row">
            <Button
              className={darkSurfaceModalCancelButtonClass}
              disabled={isRemoving}
              onClick={(e) => {
                e.currentTarget.blur();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              disabled={isRemoving}
              onClick={(e) => {
                e.currentTarget.blur();
                void onConfirm();
              }}
            >
              {isRemoving ? "Removing..." : "Remove"}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
