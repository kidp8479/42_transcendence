// The root route, the one component that is always rendered, for every URL.
// Think of it as the outermost box that contains the entire app.
// Every other route (_public, _authenticated, and their pages) renders inside its <Outlet />.
/*
 * TODO: Replace the Fragment wrapper with:
 *
 * <ModalProvider>
 *   <Outlet />
 *   <ModalLayer />
 *   <TanStackRouterDevtools />
 * </ModalProvider>
 *
 * once the modal system is implemented.
 *
 *   Why in __root.tsx?
 * - Modals are a global UI system, not a page or layout feature.
 * - Both _public and _authenticated routes need access to modals.
 * - Placing the modal system at the root ensures a single shared
 *   modal state across the entire application.
 * - ModalLayer renders above all pages and layouts, allowing
 *   popups (Sign In, Create Account, Forgot Password, etc.)
 *   to appear anywhere in the app.
 */

import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});
