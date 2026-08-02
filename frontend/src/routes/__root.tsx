import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useSyncExternalStore } from "react";
import { RootErrorComponent } from "../components/errors/RootErrorComponent";
import { ModalLayer } from "../components/modals/ModalLayer";
import { ModalProvider } from "../components/modals/ModalProvider";
import { Footer } from "../components/navigation/Footer";
import { HeaderAuthenticated } from "../components/navigation/HeaderAuthenticated";
import { HeaderPublic } from "../components/navigation/HeaderPublic";
import { SidebarProvider } from "../components/navigation/SidebarProvider";
import { ToastProvider } from "../components/toast/ToastProvider";
import { authSessionResource, type AppRouterContext } from "../lib/authState";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context }) => ({
    authState: await context.auth.resolve(),
  }),
  component: RootLayout,
  // Falls back to this whenever a route's own loader/component throws and
  // doesn't define its own errorComponent - covers every route in the app,
  // not just Discovery's.
  errorComponent: RootErrorComponent,
});

function RootLayout() {
  const { authState: initialAuthState } = Route.useRouteContext();
  const authState = useSyncExternalStore(
    (listener) => authSessionResource.subscribe(listener),
    () => authSessionResource.getState() ?? initialAuthState,
    () => initialAuthState
  );

  return (
    <ModalProvider>
      <ToastProvider>
        <SidebarProvider>
          {/* h-dvh, not min-h-screen: a min-height only sets a floor, so no
              descendant ever gets a definite height and every `flex-1 min-h-0`
              below stays inert. A real height is what lets each area scroll
              inside itself with the header and footer always visible, and what
              bounds the Kanban board so its columns scroll instead of the page.
              dvh over vh: on mobile 100vh exceeds the visible viewport and
              would push the footer off screen. */}
          <div className="flex h-dvh flex-col bg-surface-base text-text-primary">
            {authState.status === "authenticated" ? (
              <HeaderAuthenticated session={authState.session} />
            ) : (
              <HeaderPublic
                authUnavailable={authState.status === "unavailable"}
              />
            )}
            <div className="flex flex-col flex-1 min-h-0">
              <Outlet />
            </div>
            <Footer />
          </div>
        </SidebarProvider>
      </ToastProvider>
      <ModalLayer />
      <TanStackRouterDevtools />
    </ModalProvider>
  );
}
