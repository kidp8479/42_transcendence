import { Button, Modal, ModalBody, ModalHeader } from "flowbite-react";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import {
  darkSurfaceModalCancelButtonClass,
  darkSurfaceModalTheme,
} from "@/lib/flowbite";

interface LeaveProjectModalProps {
  show: boolean;
  isLeaving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

// Centered, icon-led layout matching the delete-account confirmation in
// user-settings.tsx (darkSurfaceModalTheme, Flowbite's solid color="red"
// button) - the reference style for destructive confirmations, chosen over
// this component's own previous left-aligned/muted-red-outline layout.
export function LeaveProjectModal({
  show,
  isLeaving,
  onClose,
  onConfirm,
}: LeaveProjectModalProps) {
  return (
    <Modal
      show={show}
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
            Are you sure you want to leave this project?
          </h3>
          <p className="text-sm text-text-secondary">
            You&apos;ll need to be re-invited to rejoin.
          </p>

          <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:flex-row">
            <Button
              className={darkSurfaceModalCancelButtonClass}
              disabled={isLeaving}
              onClick={(e) => {
                e.currentTarget.blur();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              disabled={isLeaving}
              onClick={(e) => {
                e.currentTarget.blur();
                void onConfirm();
              }}
            >
              {isLeaving ? "Leaving..." : "Leave"}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
