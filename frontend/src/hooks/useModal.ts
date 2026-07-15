import { useContext } from "react";
import { ModalContext } from "../components/modals/ModalProvider";

/**
 * Accesses the global modal state.
 *
 * Returns:
 * - activeModal: currently open modal and its view, if any
 * - openAuthModal: opens the authentication modal in sign-in or sign-up mode
 * - closeModal: closes the active modal
 */
export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used inside ModalProvider");
  }
  return context;
}
