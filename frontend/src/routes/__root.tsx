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
          <div className="flex min-h-screen flex-col bg-surface-base text-text-primary">
            {authState.status === "authenticated" ? (
              <HeaderAuthenticated session={authState.session} />
            ) : (
              <HeaderPublic
                authUnavailable={authState.status === "unavailable"}
              />
            )}
            <div className="flex min-h-0 flex-1 flex-col">
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
