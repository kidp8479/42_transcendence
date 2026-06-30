/**
 * Global modal state provider.
 * Manages the application-wide modal state and provides a centralized API
 * for opening and closing modals from any component.
 *
 * This component acts as the single source of truth for modal state.
 * It does NOT render any UI or modal components directly.
 *
 * Instead, it exposes state and actions that are consumed by ModalLayer,
 * which is responsible for rendering the actual modal UI.
 *
 * Handles:
 * - Tracking the currently active modal
 * - Providing openModal() to trigger a modal from anywhere in the app
 * - Providing closeModal() to dismiss the active modal
 * - Preventing prop drilling for modal state management
 *
 * NOTE:
 * This provider must wrap the application (or layout level) where modals
 * need to be accessible.
 *
 * It works in conjunction with ModalLayer.tsx to separate state management
 * from rendering logic.
 */
