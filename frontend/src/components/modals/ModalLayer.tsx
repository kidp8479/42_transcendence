/**
 * Global modal system root.
 * Responsible for rendering all modals via a React portal so they
 * appear above the entire app layout (layouts, pages, navigation).
 *
 * This component acts as the single "modal host" for the application.
 * All modals (AuthModal, etc.) are rendered through this layer.
 *
 * Handles:
 * - Modal overlay (backdrop)
 * - Z-index stacking above layouts
 * - Centered modal positioning
 * - Click-outside / escape behavior (if implemented)
 * - Preventing UI interaction with underlying pages
 *
 * NOTE:
 * This component is mounted in __root.tsx alongside ModalProvider, so modals
 * are accessible from both public and authenticated routes.
 *
 * It does NOT define specific modals itself.
 * It only provides the rendering surface for them.
 */
