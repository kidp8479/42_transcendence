import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import { useModal } from "../../hooks/useModal";
import { AuthModal } from "./auth/AuthModal";

/**
 * Renders the active global modal above every route.
 */
export function ModalLayer() {
  const { activeModal, closeModal } = useModal();

  return (
    <Modal
      aria-labelledby="auth-modal-title"
      dismissible
      popup
      show={activeModal !== null}
      size="md"
      theme={{
        content: {
          inner:
            "relative flex max-h-[90dvh] flex-col rounded-2xl border border-surface-border bg-surface-raised shadow-2xl",
        },
      }}
      onClose={closeModal}
    >
      <ModalHeader />
      <ModalBody>
        {activeModal?.type === "auth" && (
          <AuthModal initialView={activeModal.view} />
        )}
      </ModalBody>
    </Modal>
  );
}
