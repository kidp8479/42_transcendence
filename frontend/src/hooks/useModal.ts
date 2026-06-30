/**
 * Custom hook to access the global modal system.
 * Provides a simple API to open and close modals
 * without directly interacting with React context.
 *
 * This hook is a convenience wrapper around ModalContext.
 * It should be used anywhere in the app where modals need to be triggered.
 *
 * Returns:
 * - activeModal: currently open modal type (if any)
 * - openModal: function to open a modal
 * - closeModal: function to close the active modal
 */
